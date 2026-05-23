-- =====================================================================
-- LUMIA CRM · US-011 — Pipeline Visual de Leads (Kanban CRM)
-- E3 — CRM e Funil de Leads · P1 — Crítico · Sprint 5-6 · Esforço L
-- ---------------------------------------------------------------------
-- 4 tabelas:
--   funil_etapas    → colunas configuráveis do Kanban por clínica
--   leads           → prospects que ainda não se tornaram pacientes
--   lead_historico  → trilha imutável de cada movimentação de lead
--   lead_automacoes → ações automáticas disparadas por etapa
--
-- Multi-tenant: isolado por user_id (owner da clínica).
-- RLS aplicado em todas as tabelas.
-- Execute via Supabase SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. funil_etapas — colunas configuráveis do funil por clínica
-- ---------------------------------------------------------------------
create table if not exists public.funil_etapas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nome        text not null,
  ordem       int  not null default 0,
  cor         text not null default '#6B7280',  -- hex color para o header da coluna
  -- tipo controla comportamento terminal:
  --   ativo      → lead em andamento normal
  --   convertido → lead convertido em paciente (etapa final positiva)
  --   perdido    → lead perdido — sai do funil ativo, fica no histórico
  tipo        text not null default 'ativo'
               check (tipo in ('ativo', 'convertido', 'perdido')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_funil_etapas_user
  on public.funil_etapas (user_id, ordem);

alter table public.funil_etapas enable row level security;
alter table public.funil_etapas force row level security;

create policy "funil_etapas_select" on public.funil_etapas
  for select using (auth.uid() = user_id);
create policy "funil_etapas_insert" on public.funil_etapas
  for insert with check (auth.uid() = user_id);
create policy "funil_etapas_update" on public.funil_etapas
  for update using (auth.uid() = user_id);
create policy "funil_etapas_delete" on public.funil_etapas
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. leads — prospects não convertidos em pacientes
-- ---------------------------------------------------------------------
-- Um lead NÃO é um paciente até ser explicitamente convertido (CA-05).
-- Após conversão, cliente_id é preenchido e etapa.tipo = 'convertido'.
create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  nome                  text not null,
  telefone              text,
  email                 text,
  procedimento_interesse text,
  origem                text not null default 'outro'
                          check (origem in ('instagram', 'google', 'indicacao', 'whatsapp', 'tiktok', 'outro')),
  observacoes           text,
  etapa_id              uuid not null references public.funil_etapas(id) on delete restrict,
  etapa_entrada_em      timestamptz not null default now(),  -- quando entrou na etapa atual
  responsavel_id        uuid,           -- equipe.id (nullable)
  responsavel_nome      text,           -- snapshot do nome
  cliente_id            uuid,           -- preenchido após conversão (clientes.id)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_leads_user_etapa
  on public.leads (user_id, etapa_id);
create index if not exists idx_leads_user_created
  on public.leads (user_id, created_at desc);
create index if not exists idx_leads_user_sem_movimento
  on public.leads (user_id, etapa_entrada_em);

alter table public.leads enable row level security;
alter table public.leads force row level security;

create policy "leads_select" on public.leads
  for select using (auth.uid() = user_id);
create policy "leads_insert" on public.leads
  for insert with check (auth.uid() = user_id);
create policy "leads_update" on public.leads
  for update using (auth.uid() = user_id);
create policy "leads_delete" on public.leads
  for delete using (auth.uid() = user_id);

-- Atualiza updated_at automaticamente
create or replace function public.leads_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.leads_set_updated_at();

-- ---------------------------------------------------------------------
-- 3. lead_historico — trilha imutável de movimentações (CA-03)
-- ---------------------------------------------------------------------
-- Registro append-only: cada linha é uma movimentação de etapa.
-- Também usado para registrar tarefas geradas por automações (CA-04).
create table if not exists public.lead_historico (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  lead_id             uuid not null references public.leads(id) on delete cascade,
  etapa_anterior_id   uuid references public.funil_etapas(id) on delete set null,
  etapa_nova_id       uuid not null references public.funil_etapas(id) on delete restrict,
  usuario_nome        text not null,    -- snapshot do usuário que moveu
  observacao          text,             -- nota livre ou título de tarefa automática
  tipo                text not null default 'movimentacao'
                        check (tipo in ('movimentacao', 'tarefa', 'nota', 'automacao')),
  created_at          timestamptz not null default now()
);

create index if not exists idx_lead_historico_lead
  on public.lead_historico (lead_id, created_at desc);
create index if not exists idx_lead_historico_user
  on public.lead_historico (user_id, created_at desc);

alter table public.lead_historico enable row level security;
alter table public.lead_historico force row level security;

create policy "lead_historico_select" on public.lead_historico
  for select using (auth.uid() = user_id);
create policy "lead_historico_insert" on public.lead_historico
  for insert with check (auth.uid() = user_id);

-- Imutabilidade: histórico é trilha de auditoria — não se edita, não se deleta
revoke update, delete on public.lead_historico from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. lead_automacoes — ações configuradas por etapa (CA-04)
-- ---------------------------------------------------------------------
-- Automações disparadas quando um lead entra em uma etapa.
-- WhatsApp/email dependem de E3-G4 (ainda não implementado) — registram
-- intenção no lead_historico como tipo='automacao' até a integração existir.
create table if not exists public.lead_automacoes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  etapa_id      uuid not null references public.funil_etapas(id) on delete cascade,
  -- tipo da ação:
  --   whatsapp → envia mensagem WhatsApp (requer E3-G4)
  --   email    → envia e-mail (requer integração futura)
  --   tarefa   → cria lembrete/tarefa para recepcionista no lead_historico
  tipo          text not null check (tipo in ('whatsapp', 'email', 'tarefa')),
  -- gatilho:
  --   ao_entrar  → dispara imediatamente quando o lead entra na etapa
  --   apos_dias  → dispara após N dias parado na etapa (checado diariamente)
  gatilho       text not null default 'ao_entrar'
                  check (gatilho in ('ao_entrar', 'apos_dias')),
  dias_espera   int,                    -- apenas quando gatilho = 'apos_dias'
  mensagem      text,                   -- texto para whatsapp/email
  tarefa_titulo text,                   -- título da tarefa (tipo = 'tarefa')
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_lead_automacoes_etapa
  on public.lead_automacoes (etapa_id);
create index if not exists idx_lead_automacoes_user
  on public.lead_automacoes (user_id);

alter table public.lead_automacoes enable row level security;
alter table public.lead_automacoes force row level security;

create policy "lead_automacoes_select" on public.lead_automacoes
  for select using (auth.uid() = user_id);
create policy "lead_automacoes_insert" on public.lead_automacoes
  for insert with check (auth.uid() = user_id);
create policy "lead_automacoes_update" on public.lead_automacoes
  for update using (auth.uid() = user_id);
create policy "lead_automacoes_delete" on public.lead_automacoes
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- NOTAS DE INTEGRAÇÃO
-- ---------------------------------------------------------------------
-- CA-04 (Automações WhatsApp/Email): dependem de E3-G4 (integração
-- WhatsApp via Twilio/Z-API) ainda não implementada. Até lá, automações
-- do tipo 'whatsapp' e 'email' são registradas no lead_historico como
-- tipo='automacao' com observacao = 'Enviado via WhatsApp: {mensagem}'
-- para fins de auditoria. Não há envio real.
--
-- CA-05 (Conversão): ao converter, leads.cliente_id é preenchido com o
-- UUID do novo registro em clientes. O fluxo de agendamento é aberto
-- via setCurrentTab('agenda') + dados pré-preenchidos na UI.
--
-- Leads sem movimentação ≥ 30 dias: detectado client-side via
-- leads.etapa_entrada_em — badge de alerta renderizado no card.
--
-- Funil por clínica: user_id = owner_id do tenant. Leads são da clínica,
-- não do profissional. responsavel_id é apenas o atendente responsável
-- pelo contato, sem isolamento de dados.
-- =====================================================================
