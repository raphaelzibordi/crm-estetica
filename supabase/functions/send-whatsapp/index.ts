import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowlist de origens — defina ALLOWED_ORIGINS como CSV nas secrets da função
// (ex.: "https://app.lumia.app,https://lumia.vercel.app"). Em dev local, usar VITE.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = corsHeadersFor(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Autentica o chamador via JWT (anon key + Authorization header) ──
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ success: false, reason: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await authedClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, reason: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. userId vem do token, NUNCA do body. clienteId/userId no body são ignorados ──
    const { mensagemId, mensagem, telefone } = await req.json();
    const userId = user.id;

    if (!mensagemId || !mensagem || !telefone) {
      return new Response(JSON.stringify({ success: false, reason: 'invalid_payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. service_role apenas após autenticar ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Confirma que a mensagem pertence ao usuário autenticado (defesa em profundidade)
    const { data: msgOwner, error: msgErr } = await supabase
      .from('whatsapp_mensagens')
      .select('user_id')
      .eq('id', mensagemId)
      .maybeSingle();

    if (msgErr || !msgOwner || msgOwner.user_id !== userId) {
      return new Response(JSON.stringify({ success: false, reason: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca configuração do WhatsApp do tenant autenticado
    const { data: cfg, error: cfgErr } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (cfgErr || !cfg?.ativo || !cfg.zapi_instance || !cfg.zapi_token) {
      await supabase
        .from('whatsapp_mensagens')
        .update({ status: 'falha', error_msg: 'WhatsApp não configurado', updated_at: new Date().toISOString() })
        .eq('id', mensagemId);
      return new Response(JSON.stringify({ success: false, reason: 'not_configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normaliza o telefone
    const num   = String(telefone).replace(/\D/g, '');
    const phone = num.startsWith('55') ? num : `55${num}`;

    // Envia via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${cfg.zapi_instance}/token/${cfg.zapi_token}/send-text`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.zapi_client_token) headers['client-token'] = cfg.zapi_client_token;

    const zapiRes = await fetch(zapiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, message: mensagem }),
    });

    const zapiData = await zapiRes.json().catch(() => ({}));

    if (zapiRes.ok) {
      await supabase
        .from('whatsapp_mensagens')
        .update({
          status:         'enviado',
          provider_msg_id: zapiData.zaapId ?? zapiData.messageId ?? null,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', mensagemId);

      return new Response(JSON.stringify({ success: true, providerMsgId: zapiData.zaapId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const errMsg = zapiData.error ?? zapiData.message ?? `HTTP ${zapiRes.status}`;
      await supabase
        .from('whatsapp_mensagens')
        .update({ status: 'falha', error_msg: errMsg, updated_at: new Date().toISOString() })
        .eq('id', mensagemId);

      return new Response(JSON.stringify({ success: false, reason: errMsg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err: unknown) {
    console.error('[send-whatsapp] erro interno:', err);
    return new Response(JSON.stringify({ success: false, reason: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
