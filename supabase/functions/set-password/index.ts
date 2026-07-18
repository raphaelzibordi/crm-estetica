// Define a senha do usuário durante o fluxo de primeiro acesso / redefinição
// (tela DefinirSenha, chamada com o access_token da sessão de recovery/invite).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { password } = await req.json();
    if (!password || typeof password !== 'string' || password.length < 8) {
      return json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, 400);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sessão inválida.' }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Sessão inválida ou expirada.' }, 401);

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[set-password]', msg);
    return json({ error: msg }, 500);
  }
});
