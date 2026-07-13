import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CRM_URL = 'https://app.luminaclin.com';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { membroId } = await req.json();
    if (!membroId || typeof membroId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetro membroId ausente.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve o usuário chamador (dono) a partir do JWT recebido.
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace(/^Bearer\s+/i, '')
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Sessão inválida.' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Confirma que o membro pertence ao dono chamador — nunca confiar em ID vindo do client.
    const { data: membro, error: membroErr } = await supabase
      .from('equipe')
      .select('id, email, user_id')
      .eq('id', membroId)
      .maybeSingle();

    if (membroErr || !membro) {
      return new Response(JSON.stringify({ success: false, error: 'Membro não encontrado.' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (membro.user_id !== user.id) {
      return new Response(JSON.stringify({ success: false, error: 'Acesso negado.' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!membro.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este membro não possui e-mail cadastrado.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const redirectTo = `${CRM_URL}/definir-senha`;

    let linkData = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: membro.email,
      options: { redirectTo },
    });

    if (linkData.error && /already.*registered|already been registered/i.test(linkData.error.message)) {
      // Conta já existe (ex: reenvio de link) — gera link de redefinição em vez de convite.
      linkData = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: membro.email,
        options: { redirectTo },
      });
    }

    if (linkData.error || !linkData.data?.properties?.action_link) {
      console.error('[invite-team-member] generateLink error:', linkData.error);
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível gerar o link de acesso.' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, link: linkData.data.properties.action_link }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[invite-team-member] erro interno:', msg);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
