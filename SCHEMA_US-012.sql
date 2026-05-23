-- =====================================================================
-- LUMIA CRM · US-012 — Gestão de Orçamentos em Aberto com Follow-up
-- E3 — CRM e Funil de Leads · P1 — Crítico · Sprint 5-6 · Esforço M
-- ---------------------------------------------------------------------
-- 4 tabelas:
--   orcamentos              → orçamentos enviados a clientes/leads
--   orcamento_itens         → itens de cada orçamento
--   orcamento_followup_config → sequência de follow-up configurável
--   orcamento_followup_log  → histórico de follow-ups disparados
--
-- Multi-tenant: isolado por user_id (owner da clínica).
-- RLS aplicado em todas as tabelas.
-- Execute via Supabase SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. orcamentos — orçamentos enviados a clientes ou leads
-- ---------------------------------------------------------------------
create table if not exists public.orcamentos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  -- Destinatário: cliente existente OU lead (ao menos um deve ser preenchido)
  cliente_id        uuid references public.clientes(id) on delete set null,
  lead_id           uuid references public.leads(id) on delete set null,
  nome_cliente      text not null,
  telefone          text not null default '',
  -- Profissional responsável pelo orçamento
  profissional_id   uuid references public.equipe(id) on delete set null,
  profissional_nome text,
  data_envio        date not null default current_date,
  validade          date not null,
  status            text not null default 'aberto'
                    check (status in ('aberto', 'aprovado', 'perdido', 'expirado')),
  motivo_perda      text check (motivo_perda in ('preco', 'concorrente', 'nao_respondeu', 'outro')),
  valor_total       numeric(10,2) not null default 0,
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_orcamentos_user
  on public.orcamentos(user_id, status, data_envio desc);
create index if not exists idx_orcamentos_cliente
  on public.orcamentos(cliente_id);
create index if not exists idx_orcamentos_lead
  on public.orcamentos(lead_id);

alter table public.orcamentos enable row level security;
alter table public.orcamentos force row level security;

create policy "orcamentos_select" on public.orcamentos
  for select using (auth.uid() = user_id);
create policy "orcamentos_insert" on public.orcamentos
  for insert with check (auth.uid() = user_id);
create policy "orcamentos_update" on public.orcamentos
  for update using (auth.uid() = user_id);
create policy "orcamentos_delete" on public.orcamentos
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. orcamento_itens — itens/procedimentos de cada orçamento
-- ---------------------------------------------------------------------
create table if not exists public.orcamento_itens (
  id              uuid primary key default gen_random_uuid(),
  orcamento_id    uuid not null references public.orcamentos(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  procedimento_id uuid references public.procedimentos(id) on delete set null,
  descricao       text not null,
  quantidade      int not null default 1 check (quantidade > 0),
  valor_unitario  numeric(10,2) not null default 0 check (valor_unitario >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists idx_orcamento_itens_orcamento
  on public.orcamento_itens(orcamento_id);

alter table public.orcamento_itens enable row level security;
alter table public.orcamento_itens force row level security;

create policy "orcamento_itens_select" on public.orcamento_itens
  for select using (auth.uid() = user_id);
create policy "orcamento_itens_insert" on public.orcamento_itens
  for insert with check (auth.uid() = user_id);
create policy "orcamento_itens_update" on public.orcamento_itens
  for update using (auth.uid() = user_id);
create policy "orcamento_itens_delete" on public.orcamento_itens
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. orcamento_followup_config — sequência de follow-up por clínica
-- ---------------------------------------------------------------------
create table if not exists public.orcamento_followup_config (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  dias_apos_envio   int not null check (dias_apos_envio > 0),
  canal             text not null check (canal in ('whatsapp', 'email', 'ambos')),
  mensagem_template text not null,
  -- Variáveis suportadas: {{nome}}, {{procedimentos}}, {{valor}}, {{validade}}, {{clinica}}
  ativo             boolean not null default true,
  ordem             int not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_followup_config_user
  on public.orcamento_followup_config(user_id, ordem);

alter table public.orcamento_followup_config enable row level security;
alter table public.orcamento_followup_config force row level security;

create policy "followup_config_select" on public.orcamento_followup_config
  for select using (auth.uid() = user_id);
create policy "followup_config_insert" on public.orcamento_followup_config
  for insert with check (auth.uid() = user_id);
create policy "followup_config_update" on public.orcamento_followup_config
  for update using (auth.uid() = user_id);
create policy "followup_config_delete" on public.orcamento_followup_config
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. orcamento_followup_log — registro de follow-ups disparados
-- ---------------------------------------------------------------------
create table if not exists public.orcamento_followup_log (
  id           uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  config_id    uuid references public.orcamento_followup_config(id) on delete set null,
  canal        text not null,
  mensagem     text not null,
  enviado_em   timestamptz not null default now(),
  status       text not null default 'pendente'
               check (status in ('pendente', 'enviado', 'falha'))
);

create index if not exists idx_followup_log_orcamento
  on public.orcamento_followup_log(orcamento_id, enviado_em desc);

alter table public.orcamento_followup_log enable row level security;
alter table public.orcamento_followup_log force row level security;

create policy "followup_log_select" on public.orcamento_followup_log
  for select using (auth.uid() = user_id);
create policy "followup_log_insert" on public.orcamento_followup_log
  for insert with check (auth.uid() = user_id);
create policy "followup_log_delete" on public.orcamento_followup_log
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. Função: expirar orçamentos vencidos (chamar via cron ou ao abrir painel)
-- ---------------------------------------------------------------------
create or replace function public.expirar_orcamentos_vencidos()
returns int language plpgsql security definer as $$
declare
  rows_updated int;
begin
  update public.orcamentos
  set    status     = 'expirado',
         updated_at = now()
  where  status     = 'aberto'
    and  validade   < current_date;
  get diagnostics rows_updated = row_count;
  return rows_updated;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Trigger: recalcular valor_total ao inserir/atualizar itens
-- ---------------------------------------------------------------------
create or replace function public.recalcular_valor_total_orcamento()
returns trigger language plpgsql security definer as $$
begin
  update public.orcamentos
  set    valor_total = (
           select coalesce(sum(quantidade * valor_unitario), 0)
           from   public.orcamento_itens
           where  orcamento_id = coalesce(new.orcamento_id, old.orcamento_id)
         ),
         updated_at = now()
  where  id = coalesce(new.orcamento_id, old.orcamento_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalcular_valor_total on public.orcamento_itens;
create trigger trg_recalcular_valor_total
  after insert or update or delete on public.orcamento_itens
  for each row execute function public.recalcular_valor_total_orcamento();
