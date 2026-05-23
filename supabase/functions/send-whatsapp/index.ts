import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { mensagemId, clienteId, mensagem, telefone, userId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Busca configuração do WhatsApp
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
    const num   = telefone.replace(/\D/g, '');
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
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return new Response(JSON.stringify({ success: false, reason: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
