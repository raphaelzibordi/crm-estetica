-- =====================================================================
-- LUMIA CRM · US-013 — CRC: Central de Relacionamento
-- E3 — CRM e Funil de Leads · P2 — Importante · Sprint 5-6 · Esforço L
-- ---------------------------------------------------------------------
-- Novas tabelas:
--   contas_receber  → contas em aberto / inadimplentes
--   crc_acoes       → registro de ações de relacionamento
--
-- Alteração:
--   clientes        → + crc_nao_retorna (flag "não retorna mais")
--
-- Multi-tenant: isolado por user_id.
-- RLS aplicado em todas as tabelas.
-- Execute via Supabase SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Adicionar flag "não retorna mais" na tabela de clientes
-- ---------------------------------------------------------------------
alter table public.clientes
  add column if not exists crc_nao_retorna boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. contas_receber — controle de inadimplência (simplificado, pre-E6)
-- ---------------------------------------------------------------------
create table if not exists public.contas_receber (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  descricao       text not null,
  valor           numeric(10,2) not null check (valor > 0),
  data_vencimento date not null,
  data_pagamento  date,
  status          text not null default 'pendente'
                  check (status in ('pendente', 'pago', 'vencido')),
  agendamento_id  uuid references public.agendamentos(id) on delete set null,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_contas_receber_user
  on public.contas_receber(user_id, status, data_vencimento);
create index if not exists idx_contas_receber_cliente
  on public.contas_receber(cliente_id);

alter table public.contas_receber enable row level security;
alter table public.contas_receber force row level security;

create policy "contas_receber_select" on public.contas_receber
  for select using (auth.uid() = user_id);
create policy "contas_receber_insert" on public.contas_receber
  for insert with check (auth.uid() = user_id);
create policy "contas_receber_update" on public.contas_receber
  for update using (auth.uid() = user_id);
create policy "contas_receber_delete" on public.contas_receber
  for delete using (auth.uid() = user_id);

-- Função para marcar automaticamente contas vencidas
create or replace function public.atualizar_status_contas_vencidas()
returns int language plpgsql security definer as $$
declare
  rows_updated int;
begin
  update public.contas_receber
  set    status     = 'vencido',
         updated_at = now()
  where  status      = 'pendente'
    and  data_vencimento < current_date;
  get diagnostics rows_updated = row_count;
  return rows_updated;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. crc_acoes — log imutável de ações de relacionamento
-- ---------------------------------------------------------------------
create table if not exists public.crc_acoes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  tipo         text not null
               check (tipo in ('mensagem_whatsapp', 'ligacao', 'reagendamento', 'cobranca', 'nao_retorna', 'outro')),
  contexto     text not null
               check (contexto in ('falta', 'inadimplente', 'sem_reagendamento')),
  observacao   text,
  usuario_nome text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_crc_acoes_user
  on public.crc_acoes(user_id, created_at desc);
create index if not exists idx_crc_acoes_cliente
  on public.crc_acoes(cliente_id, created_at desc);

alter table public.crc_acoes enable row level security;
alter table public.crc_acoes force row level security;

create policy "crc_acoes_select" on public.crc_acoes
  for select using (auth.uid() = user_id);
create policy "crc_acoes_insert" on public.crc_acoes
  for insert with check (auth.uid() = user_id);
