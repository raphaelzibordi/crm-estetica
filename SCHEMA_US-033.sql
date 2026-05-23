-- ============================================================
-- US-033 · E6 — Contas a pagar e a receber com gestão
--           financeira prospectiva e compromissos futuros
-- Aplicar no Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. categorias_despesa — categorias de contas a pagar
-- ──────────────────────────────────────────────────────────
create table if not exists public.categorias_despesa (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,
  cor        text not null default '#6366f1',
  sistema    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_categorias_despesa_user
  on public.categorias_despesa(user_id);

alter table public.categorias_despesa enable row level security;
alter table public.categorias_despesa force row level security;

create policy "categorias_despesa_select" on public.categorias_despesa
  for select using (auth.uid() = user_id);
create policy "categorias_despesa_insert" on public.categorias_despesa
  for insert with check (auth.uid() = user_id);
create policy "categorias_despesa_update" on public.categorias_despesa
  for update using (auth.uid() = user_id and sistema = false);
create policy "categorias_despesa_delete" on public.categorias_despesa
  for delete using (auth.uid() = user_id and sistema = false);

-- ──────────────────────────────────────────────────────────
-- 2. contas_pagar — contas a pagar com recorrência
-- ──────────────────────────────────────────────────────────
create table if not exists public.contas_pagar (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  categoria_id       uuid references public.categorias_despesa(id) on delete set null,
  fornecedor         text not null,
  descricao          text,
  valor              numeric(10,2) not null check (valor > 0),
  data_vencimento    date not null,
  data_pagamento     date,
  status             text not null default 'pendente'
                     check (status in ('pendente', 'pago', 'vencido')),
  recorrencia        text not null default 'unica'
                     check (recorrencia in ('unica', 'mensal', 'anual')),
  comprovante_url    text,
  observacoes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_contas_pagar_user
  on public.contas_pagar(user_id, status, data_vencimento);
create index if not exists idx_contas_pagar_categoria
  on public.contas_pagar(categoria_id);

alter table public.contas_pagar enable row level security;
alter table public.contas_pagar force row level security;

create policy "contas_pagar_select" on public.contas_pagar
  for select using (auth.uid() = user_id);
create policy "contas_pagar_insert" on public.contas_pagar
  for insert with check (auth.uid() = user_id);
create policy "contas_pagar_update" on public.contas_pagar
  for update using (auth.uid() = user_id);
create policy "contas_pagar_delete" on public.contas_pagar
  for delete using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 3. Adicionar campo forma_recebimento em contas_receber
--    (existente desde US-013)
-- ──────────────────────────────────────────────────────────
alter table public.contas_receber
  add column if not exists forma_recebimento text
    check (forma_recebimento in ('pix', 'credito', 'debito', 'dinheiro', 'outro'));

-- ──────────────────────────────────────────────────────────
-- 4. Funções auxiliares
-- ──────────────────────────────────────────────────────────

-- Marca contas_pagar vencidas automaticamente
create or replace function public.atualizar_contas_pagar_vencidas()
returns int language plpgsql security definer as $$
declare
  rows_updated int;
begin
  update public.contas_pagar
  set    status     = 'vencido',
         updated_at = now()
  where  status          = 'pendente'
    and  data_vencimento < current_date;
  get diagnostics rows_updated = row_count;
  return rows_updated;
end;
$$;

-- Trigger updated_at em contas_pagar
create or replace function public.set_updated_at_contas_pagar()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_updated_at_contas_pagar on public.contas_pagar;
create trigger tg_updated_at_contas_pagar
  before update on public.contas_pagar
  for each row execute function public.set_updated_at_contas_pagar();

-- ──────────────────────────────────────────────────────────
-- 5. Índice de performance para alertas de vencimento
-- ──────────────────────────────────────────────────────────
create index if not exists idx_contas_pagar_alerta
  on public.contas_pagar(user_id, data_vencimento)
  where status = 'pendente';

create index if not exists idx_contas_receber_alerta
  on public.contas_receber(user_id, data_vencimento)
  where status = 'pendente';
