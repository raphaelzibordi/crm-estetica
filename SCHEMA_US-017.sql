-- =====================================================================
-- LUMIA CRM · US-017 — WhatsApp Integrado
-- E4 — Automação de Marketing · P1 — Crítico · Sprint 5-6 · Esforço M
-- ---------------------------------------------------------------------
-- Novas tabelas:
--   whatsapp_config    → credenciais e configuração por clínica
--   whatsapp_mensagens → histórico completo de mensagens enviadas/recebidas
--   whatsapp_opt_out   → pacientes que optaram por não receber mensagens
--
-- Alteração:
--   templates_mensagens → + categoria (cobranca|relacionamento|marketing|operacional)
--
-- Multi-tenant: isolado por user_id. RLS em todas as tabelas.
-- Execute via Supabase SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensão da tabela de templates: adiciona categoria
-- ---------------------------------------------------------------------
alter table public.templates_mensagens
  add column if not exists categoria text
    check (categoria in ('cobranca', 'relacionamento', 'marketing', 'operacional'))
    default 'relacionamento';

-- ---------------------------------------------------------------------
-- 2. whatsapp_config — credenciais e configurações por clínica
-- ---------------------------------------------------------------------
create table if not exists public.whatsapp_config (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  -- Provider: zapi | 360dialog | twilio
  provider       text not null default 'zapi'
                 check (provider in ('zapi', '360dialog', 'twilio')),
  -- Credenciais Z-API
  zapi_instance  text,
  zapi_token     text,
  zapi_client_token text,
  -- Número oficial exibido (informativo)
  numero_oficial text,
  -- Controle de horário de envio
  hora_inicio    time not null default '08:00',
  hora_fim       time not null default '20:00',
  -- Integração ativa
  ativo          boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.whatsapp_config enable row level security;
alter table public.whatsapp_config force row level security;

create policy "wa_config_select" on public.whatsapp_config
  for select using (auth.uid() = user_id);
create policy "wa_config_insert" on public.whatsapp_config
  for insert with check (auth.uid() = user_id);
create policy "wa_config_update" on public.whatsapp_config
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. whatsapp_mensagens — log completo de mensagens
-- ---------------------------------------------------------------------
create table if not exists public.whatsapp_mensagens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  -- Direção: out = enviada pelo sistema, in = resposta do paciente
  direcao         text not null default 'out'
                  check (direcao in ('out', 'in')),
  conteudo        text not null,
  status          text not null default 'enviando'
                  check (status in ('enviando', 'enviado', 'entregue', 'lido', 'falha', 'agendado', 'cancelado')),
  -- Referência ao provider (para webhook de status)
  provider_msg_id text,
  -- Agrupador para disparos em lote
  batch_id        uuid,
  -- Quem enviou (para log)
  usuario_nome    text not null default '',
  -- Mensagem agendada para horário permitido
  agendado_para   timestamptz,
  error_msg       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_wa_mensagens_user
  on public.whatsapp_mensagens(user_id, created_at desc);
create index if not exists idx_wa_mensagens_cliente
  on public.whatsapp_mensagens(cliente_id, created_at desc);
create index if not exists idx_wa_mensagens_batch
  on public.whatsapp_mensagens(batch_id)
  where batch_id is not null;

alter table public.whatsapp_mensagens enable row level security;
alter table public.whatsapp_mensagens force row level security;

create policy "wa_mensagens_select" on public.whatsapp_mensagens
  for select using (auth.uid() = user_id);
create policy "wa_mensagens_insert" on public.whatsapp_mensagens
  for insert with check (auth.uid() = user_id);
create policy "wa_mensagens_update" on public.whatsapp_mensagens
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. whatsapp_opt_out — pacientes que não querem receber mensagens
-- ---------------------------------------------------------------------
create table if not exists public.whatsapp_opt_out (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  motivo      text default 'solicitacao_cliente',
  opt_out_at  timestamptz not null default now(),
  unique(user_id, cliente_id)
);

create index if not exists idx_wa_opt_out_user
  on public.whatsapp_opt_out(user_id, cliente_id);

alter table public.whatsapp_opt_out enable row level security;
alter table public.whatsapp_opt_out force row level security;

create policy "wa_opt_out_select" on public.whatsapp_opt_out
  for select using (auth.uid() = user_id);
create policy "wa_opt_out_insert" on public.whatsapp_opt_out
  for insert with check (auth.uid() = user_id);
create policy "wa_opt_out_delete" on public.whatsapp_opt_out
  for delete using (auth.uid() = user_id);
