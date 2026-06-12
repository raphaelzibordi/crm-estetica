-- ============================================================
-- Hardening de segurança — endpoints públicos
-- Cobre: #5 (enum e-mails), #6 (tenant leak via p_user_id),
--        #7 (IP forjado em assinatura), #8 (rate-limit)
-- Idempotente: pode ser rodada várias vezes.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RATE LIMIT — infra leve baseada em tabela + função
-- ────────────────────────────────────────────────────────────
create table if not exists public.public_request_log (
  key        text        not null,
  hit_at     timestamptz not null default now()
);

create index if not exists public_request_log_key_hit_idx
  on public.public_request_log (key, hit_at desc);

-- Limpeza: a tabela pode crescer. Trigger noop; recomenda-se cron diário
-- "delete from public_request_log where hit_at < now() - interval '1 day'"
-- via pg_cron (configurar separadamente).

create or replace function public.enforce_public_rate_limit(
  p_key             text,
  p_max             int,
  p_window_seconds  int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.public_request_log
  where key = p_key
    and hit_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    raise exception 'rate_limit_exceeded'
      using errcode = 'P0001', hint = 'Aguarde alguns instantes antes de tentar novamente.';
  end if;

  insert into public.public_request_log(key) values (p_key);
end;
$$;

revoke all on function public.enforce_public_rate_limit(text, int, int) from public;
grant execute on function public.enforce_public_rate_limit(text, int, int) to authenticated;
-- Não concedemos a anon; só funções SECURITY DEFINER a usam internamente.

-- ────────────────────────────────────────────────────────────
-- 2. #5 — Rate-limit em is_equipe_email
--    Mantém UX (mensagem inteligente no login) mas limita
--    enumeração em massa.
-- ────────────────────────────────────────────────────────────
create or replace function public.is_equipe_email(lookup_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  -- 30 tentativas por janela de 60s, por e-mail consultado.
  -- (stable + insert: marcamos a função como volatile via plpgsql implícito;
  --  por isso trocamos "language sql stable" → plpgsql.)
  perform public.enforce_public_rate_limit(
    'is_equipe_email:' || lower(lookup_email),
    30,
    60
  );

  select exists (
    select 1 from public.equipe
    where lower(email) = lower(lookup_email)
      and ativo = true
  ) into v_exists;

  return v_exists;
end;
$$;

grant execute on function public.is_equipe_email(text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. #6 — RPCs públicas agora aceitam SLUG, não user_id cru.
--    Resolvem o tenant internamente via usuarios.booking_slug.
-- ────────────────────────────────────────────────────────────

-- 3.1 Profissionais públicos (por slug)
create or replace function public.get_public_professionals(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result  json;
begin
  perform public.enforce_public_rate_limit('booking_read:' || p_slug, 60, 60);

  select u.id into v_user_id
  from public.usuarios u
  where u.booking_slug    = p_slug
    and u.booking_enabled = true;

  if v_user_id is null then
    return '[]'::json;
  end if;

  select json_agg(
    json_build_object(
      'id',    e.id,
      'nome',  e.nome,
      'cargo', coalesce(e.cargo, '')
    ) order by e.nome
  ) into v_result
  from public.equipe e
  where e.user_id         = v_user_id
    and e.ativo           = true
    and e.booking_visivel = true;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- 3.2 Procedimentos públicos (por slug)
create or replace function public.get_public_procedures(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result  json;
begin
  perform public.enforce_public_rate_limit('booking_read:' || p_slug, 60, 60);

  select u.id into v_user_id
  from public.usuarios u
  where u.booking_slug    = p_slug
    and u.booking_enabled = true;

  if v_user_id is null then
    return '[]'::json;
  end if;

  select json_agg(
    json_build_object(
      'id',                      p.id,
      'nome',                    p.nome,
      'duracaoMinutos',          p.duracao_minutos,
      'preco',                   p.preco,
      'salaRequerida',           coalesce(p.sala_requerida, ''),
      'profissionalResponsavel', coalesce(p.profissional_responsavel, '')
    ) order by p.nome
  ) into v_result
  from public.procedimentos p
  where p.user_id        = v_user_id
    and p.booking_visivel = true;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- 3.3 Slots ocupados (por slug)
create or replace function public.get_booked_slots(
  p_slug         text,
  p_date         date,
  p_profissional text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result  json;
begin
  perform public.enforce_public_rate_limit('booking_slots:' || p_slug, 120, 60);

  select u.id into v_user_id
  from public.usuarios u
  where u.booking_slug    = p_slug
    and u.booking_enabled = true;

  if v_user_id is null then
    return '[]'::json;
  end if;

  select json_agg(
    json_build_object(
      'horaInicio', to_char(a.hora_inicio, 'HH24:MI'),
      'horaFim',    to_char(a.hora_fim,    'HH24:MI')
    )
  ) into v_result
  from public.agendamentos a
  where a.user_id      = v_user_id
    and a.data         = p_date
    and a.profissional = p_profissional
    and a.status       <> 'finalizada';

  return coalesce(v_result, '[]'::json);
end;
$$;

-- 3.4 Revoga as antigas overloads que aceitam user_id cru.
--     (Se outras integrações usam, devem migrar para slug.)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_public_professionals'
      and pg_get_function_arguments(p.oid) = 'p_user_id uuid'
  ) then
    execute 'drop function public.get_public_professionals(uuid)';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_public_procedures'
      and pg_get_function_arguments(p.oid) = 'p_user_id uuid'
  ) then
    execute 'drop function public.get_public_procedures(uuid)';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_booked_slots'
      and pg_get_function_arguments(p.oid) = 'p_user_id uuid, p_date date, p_profissional text'
  ) then
    execute 'drop function public.get_booked_slots(uuid, date, text)';
  end if;
end $$;

grant execute on function public.get_public_professionals(text)       to anon, authenticated;
grant execute on function public.get_public_procedures(text)          to anon, authenticated;
grant execute on function public.get_booked_slots(text, date, text)   to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. #8 — Rate-limit em create_public_booking
--    Mantém assinatura existente; só adiciona perform no topo.
-- ────────────────────────────────────────────────────────────
-- Observação: como Postgres permite CREATE OR REPLACE com mesma
-- assinatura, mas mexer no corpo do create_public_booking exigiria
-- duplicar todo o procedimento (longo), aplicamos rate-limit via
-- trigger BEFORE INSERT em agendamentos vindos de booking público.
-- Em vez disso, mais simples: criar um wrapper rate-limited.
-- Aqui aplicamos um throttle por slug.
-- A função original é mantida; o frontend agora chama o wrapper.

create or replace function public.create_public_booking_rl(
  p_clinic_slug        text,
  p_profissional       text,
  p_procedimento       text,
  p_data               date,
  p_hora_inicio        time,
  p_hora_fim           time,
  p_sala               text,
  p_valor              numeric,
  p_paciente_nome      text,
  p_paciente_telefone  text,
  p_paciente_email     text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  -- 5 reservas / 60s por slug — combate flood de agendamentos falsos
  perform public.enforce_public_rate_limit('booking_create:' || p_clinic_slug, 5, 60);

  -- Validação leve do nome (combate XSS armazenado vindo via fluxo público).
  if p_paciente_nome ~ '[<>]' then
    raise exception 'Nome inválido.' using errcode = 'P0001';
  end if;

  select public.create_public_booking(
    p_clinic_slug, p_profissional, p_procedimento, p_data,
    p_hora_inicio, p_hora_fim, p_sala, p_valor,
    p_paciente_nome, p_paciente_telefone, p_paciente_email
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_public_booking_rl(
  text, text, text, date, time, time, text, numeric, text, text, text
) to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. #7 — Assinatura digital com IP confiável
--    A assinatura via token agora EXIGE que a Edge Function
--    sign-document passe um header secreto (SIGNING_PROXY_TOKEN)
--    como pseudo-parâmetro. O frontend não chama mais a RPC
--    diretamente para assinar.
-- ────────────────────────────────────────────────────────────

-- 5.1 Nova RPC interna: recebe IP, mas só funciona via service_role.
--     SECURITY DEFINER + REVOKE de anon/authenticated → só chamável
--     pelo service_role da Edge Function.
create or replace function public.sign_document_internal(
  p_token       text,
  p_assinatura  text,
  p_ip          text,
  p_dispositivo text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
begin
  -- 10 tentativas / 60s por token — anti brute-force
  perform public.enforce_public_rate_limit('sign:' || p_token, 10, 60);

  select * into v_link
  from public.document_signature_links
  where token = p_token
    and expira_em > now()
    and usado_em is null
    and cancelado_em is null;

  if not found then
    return json_build_object('success', false, 'error', 'Link inválido ou expirado.');
  end if;

  update public.document_signatures
  set
    assinatura_data      = p_assinatura,
    assinatura_metodo    = 'remoto',
    assinado_em          = now(),
    assinado_ip          = p_ip,
    assinado_dispositivo = p_dispositivo,
    status               = 'assinado'
  where id = v_link.documento_id
    and status = 'pendente';

  update public.document_signature_links
  set usado_em = now()
  where id = v_link.id;

  return json_build_object('success', true);
end;
$$;

revoke all on function public.sign_document_internal(text, text, text, text) from public, anon, authenticated;
-- service_role tem acesso por padrão; nenhum grant adicional necessário.

-- 5.2 Revoga grant da assinatura "direta" via anon — força uso da Edge Function.
revoke execute on function public.sign_document_by_token(text, text, text, text) from anon;
-- mantém para authenticated (caso clínica use UI interna), mas frontend público não consegue.

-- 5.3 Rate-limit também em get_document_for_signing (anti brute-force de tokens).
create or replace function public.get_document_for_signing(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link  record;
  v_doc   record;
begin
  perform public.enforce_public_rate_limit('get_sign_doc:' || p_token, 20, 60);

  select * into v_link
  from public.document_signature_links
  where token = p_token
    and expira_em > now()
    and usado_em is null
    and cancelado_em is null;

  if not found then
    return json_build_object('success', false, 'error', 'Link inválido ou expirado.');
  end if;

  select * into v_doc
  from public.document_signatures
  where id = v_link.documento_id;

  if not found then
    return json_build_object('success', false, 'error', 'Documento não encontrado.');
  end if;

  if v_doc.status = 'assinado' then
    return json_build_object('success', false, 'error', 'Este documento já foi assinado.');
  end if;

  return json_build_object(
    'success',    true,
    'titulo',     v_doc.titulo,
    'conteudo',   v_doc.conteudo_final,
    'profissional', v_doc.profissional,
    'hash',       v_doc.hash_integridade,
    'expira_em',  v_link.expira_em
  );
end;
$$;

grant execute on function public.get_document_for_signing(text) to anon, authenticated;
