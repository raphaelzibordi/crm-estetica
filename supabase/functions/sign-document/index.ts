import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function extractClientIp(req: Request): string | null {
  // Supabase Edge Runtime injeta x-forwarded-for com a cadeia de proxies.
  // O primeiro elemento é o IP original do cliente.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip');
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = corsHeadersFor(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const token = String(body.token ?? '').trim();
    const assinatura = String(body.assinatura ?? '');
    const dispositivo = body.dispositivo ? String(body.dispositivo).slice(0, 500) : null;

    if (!token || !assinatura) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetros ausentes.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IP capturado SERVER-SIDE — nunca confiar em campo enviado pelo cliente.
    const ip = extractClientIp(req);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await admin.rpc('sign_document_internal', {
      p_token: token,
      p_assinatura: assinatura,
      p_ip: ip,
      p_dispositivo: dispositivo,
    });

    if (error) {
      // P0001 com hint de rate-limit → 429
      const isRateLimit =
        typeof error.message === 'string' && error.message.includes('rate_limit_exceeded');
      console.error('[sign-document] rpc error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: isRateLimit
            ? 'Muitas tentativas. Aguarde alguns instantes.'
            : 'Não foi possível processar a assinatura.',
        }),
        {
          status: isRateLimit ? 429 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[sign-document] erro interno:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
