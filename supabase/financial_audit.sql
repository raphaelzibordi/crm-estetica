-- =====================================================================
-- LUMIA CRM · Robustez Financeira: Auditoria + Lock Retroativo + Estornos
-- ---------------------------------------------------------------------
-- Este script estende o módulo financeiro com 3 pilares:
--   1. Trilha de auditoria (audit_logs) — quem, quando, IP, antes/depois
--   2. Lock retroativo — lançamentos de dias anteriores são imutáveis
--   3. Estornos justificados — único caminho para corrigir o passado
--
-- Execute via Supabase SQL Editor após backup. RLS é forçado em todas
-- as tabelas. Multi-tenant: tudo isolado por user_id (tenant owner).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS necessárias (pgcrypto p/ gen_random_uuid)
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABELA: audit_logs
-- ---------------------------------------------------------------------
-- Registra TODA mutação relevante (INSERT/UPDATE/DELETE) sobre tabelas
-- sensíveis. Esquema imutável: linhas só podem ser inseridas, nunca
-- editadas/excluídas (garantido por RLS + ausência de UPDATE/DELETE).
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete restrict,
  -- Quem executou de fato a ação (recepção, gestor, equipe)
  actor_id        uuid not null references auth.users(id) on delete restrict,
  actor_role      text,                -- 'dono' | 'equipe' (snapshot do papel no momento)
  -- O quê
  table_name      text not null,      -- ex: 'agendamentos'
  record_id       uuid not null,      -- id da linha afetada
  action          text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'CHECKOUT', 'ESTORNO')),
  -- Snapshot do estado
  before_data     jsonb,              -- estado anterior (UPDATE/DELETE)
  after_data      jsonb,              -- estado novo (INSERT/UPDATE)
  diff            jsonb,              -- delta calculado (apenas chaves alteradas)
  -- Contexto de segurança
  client_ip       inet,               -- IP do cliente que originou a ação
  user_agent      text,               -- User-Agent do navegador/app
  request_id      text,               -- id de correlação (opcional, para tracing)
  reason          text,               -- justificativa (obrigatório em ESTORNO)
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_logs_user      on public.audit_logs (user_id, created_at desc);
create index if not exists idx_audit_logs_record    on public.audit_logs (table_name, record_id);
create index if not exists idx_audit_logs_actor     on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

-- Leitura: dono do tenant vê tudo do próprio tenant
create policy "audit_logs_select_owner" on public.audit_logs
  for select using (auth.uid() = user_id);

-- Inserção: apenas o dono ou alguém autenticado do mesmo tenant
create policy "audit_logs_insert_self" on public.audit_logs
  for insert with check (auth.uid() = actor_id);

-- IMUTABILIDADE: ninguém pode editar/deletar logs
revoke update, delete on public.audit_logs from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. TABELA: estornos_financeiros
-- ---------------------------------------------------------------------
-- Único mecanismo permitido para corrigir lançamentos de dias passados.
-- Mantém o agendamento original INTACTO; o estorno é um lançamento
-- compensatório com justificativa e ligação ao original.
create table if not exists public.estornos_financeiros (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete restrict,
  agendamento_original_id uuid not null references public.agendamentos(id) on delete restrict,
  -- Snapshot do que estava errado
  valor_original          numeric(12,2) not null,
  metodo_original         text,
  -- Correção
  valor_corrigido         numeric(12,2) not null,
  metodo_corrigido        text,
  delta_valor             numeric(12,2) generated always as (valor_corrigido - valor_original) stored,
  -- Auditoria contábil
  motivo                  text not null check (length(motivo) >= 20),
  responsavel_id          uuid not null references auth.users(id),
  aprovado_por_id         uuid references auth.users(id), -- opcional (dual-control)
  data_lancamento         date not null default current_date,
  data_referencia         date not null,                  -- a qual dia se refere a correção
  created_at              timestamptz not null default now()
);

create index if not exists idx_estornos_user        on public.estornos_financeiros (user_id, data_referencia desc);
create index if not exists idx_estornos_original    on public.estornos_financeiros (agendamento_original_id);

alter table public.estornos_financeiros enable row level security;
alter table public.estornos_financeiros force row level security;

create policy "estornos_select_owner" on public.estornos_financeiros
  for select using (auth.uid() = user_id);

create policy "estornos_insert_owner" on public.estornos_financeiros
  for insert with check (auth.uid() = user_id);

-- Estornos também são imutáveis após criados (auditoria contábil)
revoke update, delete on public.estornos_financeiros from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. COLUNAS DE AUDITORIA em agendamentos
-- ---------------------------------------------------------------------
-- Quem fez o checkout, quando, e de qual IP. Snapshot no próprio
-- registro para queries rápidas sem JOIN. audit_logs guarda o histórico
-- completo; estas colunas refletem o ÚLTIMO checkout.
alter table public.agendamentos
  add column if not exists checkout_by_id    uuid references auth.users(id),
  add column if not exists checkout_at       timestamptz,
  add column if not exists checkout_ip       inet,
  add column if not exists checkout_locked   boolean not null default false;

create index if not exists idx_ag_checkout_locked
  on public.agendamentos (user_id, data) where checkout_locked = true;

-- ---------------------------------------------------------------------
-- 4. TRIGGER: registrar checkout + travar lançamento
-- ---------------------------------------------------------------------
-- Quando status passa para 'finalizada' (= checkout do paciente):
--   • preenche checkout_by_id, checkout_at, checkout_ip
--   • marca checkout_locked = true (a partir daí o registro é imutável
--     em relação a valor/metodo_pagamento — exceto via estorno)
create or replace function public.tg_agendamento_checkout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip inet;
begin
  -- request.headers é injetado pelo PostgREST com o IP real do client
  begin
    v_ip := nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '')::inet;
  exception when others then
    v_ip := inet_client_addr();
  end;

  if new.status = 'finalizada' and (old.status is distinct from 'finalizada') then
    new.checkout_by_id := auth.uid();
    new.checkout_at    := now();
    new.checkout_ip    := v_ip;
    new.checkout_locked := true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agendamento_checkout on public.agendamentos;
create trigger trg_agendamento_checkout
  before update on public.agendamentos
  for each row execute function public.tg_agendamento_checkout();

-- ---------------------------------------------------------------------
-- 5. TRIGGER: bloquear edição/exclusão retroativa
-- ---------------------------------------------------------------------
-- Regra de negócio: após o checkout E em data anterior a hoje, valor e
-- método de pagamento NÃO podem ser editados nem deletados.
-- Caminho oficial para correção: criar registro em estornos_financeiros.
create or replace function public.tg_block_retroactive_edit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.checkout_locked and old.data < current_date then
      raise exception 'Lançamento financeiro travado (data %). Use estornos_financeiros para corrigir.', old.data
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  -- UPDATE: permite alterar status para reabertura administrativa? NÃO.
  -- Bloqueia QUALQUER alteração em valor/metodo após lock + data passada.
  if old.checkout_locked and old.data < current_date then
    if new.valor is distinct from old.valor
       or new.metodo_pagamento is distinct from old.metodo_pagamento
       or new.status is distinct from old.status then
      raise exception 'Lançamento financeiro do dia % está bloqueado. Crie um estorno justificado para corrigir.', old.data
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_retroactive_edit on public.agendamentos;
create trigger trg_block_retroactive_edit
  before update or delete on public.agendamentos
  for each row execute function public.tg_block_retroactive_edit();

-- ---------------------------------------------------------------------
-- 6. TRIGGER: gravar audit_log automaticamente em agendamentos/estornos
-- ---------------------------------------------------------------------
create or replace function public.tg_write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip          inet;
  v_user_agent  text;
  v_actor_role  text;
  v_action      text;
  v_before      jsonb;
  v_after       jsonb;
  v_diff        jsonb;
  v_record_id   uuid;
  v_tenant_uid  uuid;
begin
  -- IP e User-Agent (via PostgREST headers)
  begin
    v_ip         := nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '')::inet;
    v_user_agent := current_setting('request.headers', true)::jsonb ->> 'user-agent';
  exception when others then
    v_ip := inet_client_addr();
  end;

  -- Papel do ator (snapshot no momento)
  select role into v_actor_role from public.usuarios where id = auth.uid() limit 1;

  -- Ação base
  if tg_op = 'INSERT' then
    v_action    := 'INSERT';
    v_before    := null;
    v_after     := to_jsonb(new);
    v_record_id := new.id;
    v_tenant_uid := new.user_id;
  elsif tg_op = 'UPDATE' then
    -- Reclassifica como CHECKOUT se for transição p/ finalizada
    if tg_table_name = 'agendamentos'
       and new.status = 'finalizada'
       and (old.status is distinct from 'finalizada') then
      v_action := 'CHECKOUT';
    else
      v_action := 'UPDATE';
    end if;
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);
    -- diff = apenas chaves alteradas
    select jsonb_object_agg(key, value) into v_diff
    from jsonb_each(v_after)
    where v_before -> key is distinct from value;
    v_record_id := new.id;
    v_tenant_uid := new.user_id;
  else  -- DELETE
    v_action    := 'DELETE';
    v_before    := to_jsonb(old);
    v_after     := null;
    v_record_id := old.id;
    v_tenant_uid := old.user_id;
  end if;

  -- Estornos têm ação específica
  if tg_table_name = 'estornos_financeiros' and tg_op = 'INSERT' then
    v_action := 'ESTORNO';
  end if;

  insert into public.audit_logs (
    user_id, actor_id, actor_role,
    table_name, record_id, action,
    before_data, after_data, diff,
    client_ip, user_agent, reason
  ) values (
    v_tenant_uid, coalesce(auth.uid(), v_tenant_uid), v_actor_role,
    tg_table_name, v_record_id, v_action,
    v_before, v_after, v_diff,
    v_ip, v_user_agent,
    -- Acesso dinâmico via jsonb: 'motivo' só existe em estornos_financeiros.
    -- new.motivo (campo estático) quebra o trigger em QUALQUER outra tabela
    -- que não tenha essa coluna (ex.: agendamentos), pois o PL/pgSQL resolve
    -- o nome do campo do RECORD no PREPARE da instrução, não em runtime da CASE.
    case when v_action = 'ESTORNO' then (to_jsonb(new) ->> 'motivo') else null end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_agendamentos on public.agendamentos;
create trigger trg_audit_agendamentos
  after insert or update or delete on public.agendamentos
  for each row execute function public.tg_write_audit_log();

drop trigger if exists trg_audit_estornos on public.estornos_financeiros;
create trigger trg_audit_estornos
  after insert on public.estornos_financeiros
  for each row execute function public.tg_write_audit_log();

-- ---------------------------------------------------------------------
-- 7. VIEW: faturamento consolidado (bruto + estornos aplicados)
-- ---------------------------------------------------------------------
-- A consulta histórica deve SEMPRE passar por esta view para refletir
-- o valor real após correções. Front-end consome via api.ts.
create or replace view public.v_faturamento_consolidado as
select
  a.user_id,
  a.data,
  a.id            as agendamento_id,
  a.procedimento,
  a.profissional,
  a.cliente_id,
  a.metodo_pagamento,
  a.valor         as valor_bruto,
  coalesce(sum(e.delta_valor), 0) as estornos_aplicados,
  a.valor + coalesce(sum(e.delta_valor), 0) as valor_liquido,
  a.checkout_at,
  a.checkout_by_id,
  a.checkout_ip
from public.agendamentos a
left join public.estornos_financeiros e
  on e.agendamento_original_id = a.id
where a.status = 'finalizada'
group by a.id;

-- =====================================================================
-- USO NO FRONT-END (api.ts)
-- ---------------------------------------------------------------------
-- Para query histórica por intervalo:
--   .from('v_faturamento_consolidado')
--   .select('*')
--   .eq('user_id', uid)
--   .gte('data', startDate)
--   .lte('data', endDate)
--
-- Para registrar um estorno (único caminho de correção retroativa):
--   .from('estornos_financeiros').insert({
--     user_id, agendamento_original_id,
--     valor_original, metodo_original,
--     valor_corrigido, metodo_corrigido,
--     motivo, responsavel_id, data_referencia
--   })
--   ↑ tg_write_audit_log dispara automaticamente.
-- =====================================================================
