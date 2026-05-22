-- =====================================================================
-- LUMIA CRM · US-036 — Repasse entre Clínica e Profissional Autônomo
-- E6 — Gestão Financeira · P2 — Importante · Sprint 5-6
-- ---------------------------------------------------------------------
-- 3 modelos suportados:
--   percentual    → profissional recebe X% do faturamento dos seus atendimentos
--   fixo_periodo  → profissional paga valor fixo mensal à clínica (aluguel de sala)
--   fixo_sessao   → profissional paga valor fixo por sessão à clínica
--
-- Execute via Supabase SQL Editor. RLS aplicado em todas as tabelas.
-- Multi-tenant: isolado por user_id (tenant owner).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. repasse_regras — configuração do modelo de repasse por profissional
-- ---------------------------------------------------------------------
-- Um profissional pode ter apenas um modelo ativo por vez.
-- Mudanças não retroagem: apenas atendimentos futuros são afetados.
create table if not exists public.repasse_regras (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete restrict,
  profissional_id   uuid not null,     -- equipe.id
  profissional_nome text not null,     -- snapshot do nome no momento da criação
  modelo            text not null check (modelo in ('percentual', 'fixo_periodo', 'fixo_sessao')),
  valor             numeric(12,2) not null check (valor > 0),
  -- percentual   : % que o profissional recebe (ex: 60 = 60% do faturamento)
  -- fixo_periodo : valor fixo mensal que o profissional paga à clínica
  -- fixo_sessao  : valor fixo por sessão que o profissional paga à clínica
  data_inicio       date not null,
  data_fim          date,              -- null = vigência indeterminada
  ativo             boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists idx_repasse_regras_user on public.repasse_regras (user_id);
create index if not exists idx_repasse_regras_prof on public.repasse_regras (user_id, profissional_id);

alter table public.repasse_regras enable row level security;
alter table public.repasse_regras force row level security;

create policy "repasse_regras_select" on public.repasse_regras
  for select using (auth.uid() = user_id);

create policy "repasse_regras_insert" on public.repasse_regras
  for insert with check (auth.uid() = user_id);

create policy "repasse_regras_update" on public.repasse_regras
  for update using (auth.uid() = user_id);

create policy "repasse_regras_delete" on public.repasse_regras
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. fechamentos_repasse — fechamento de período (imutável após inserção)
-- ---------------------------------------------------------------------
-- Integrado à trava contábil (E6): após fechamento, os dados são imutáveis.
-- Único caminho de correção: criar novo fechamento para o mesmo período
-- com observações explicando o ajuste (trilha de auditoria).
create table if not exists public.fechamentos_repasse (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete restrict,
  profissional_id            uuid not null,
  profissional_nome          text not null,
  modelo                     text not null check (modelo in ('percentual', 'fixo_periodo', 'fixo_sessao')),
  data_inicio                date not null,
  data_fim                   date not null,
  total_atendimentos         int not null default 0,
  faturamento_bruto          numeric(12,2) not null default 0,
  -- soma dos valor_liquido dos atendimentos do profissional no período
  valor_repasse_profissional numeric(12,2) not null default 0,
  -- percentual   : o que a clínica transfere ao profissional
  -- fixo_periodo : 0 (fluxo invertido — profissional paga à clínica)
  -- fixo_sessao  : 0 (fluxo invertido — profissional paga à clínica)
  valor_retencao_clinica     numeric(12,2) not null default 0,
  -- percentual   : faturamento_bruto - valor_repasse_profissional
  -- fixo_periodo : valor fixo mensal acordado
  -- fixo_sessao  : total_atendimentos × valor_por_sessao
  itens_snapshot             jsonb not null default '[]',
  -- [{agendamento_id, data, procedimento, valor_liquido, valor_repasse}]
  -- snapshot imutável dos atendimentos incluídos no fechamento
  fechado_em                 timestamptz not null default now(),
  fechado_por                text not null,
  observacoes                text,
  notificacao_enviada        boolean not null default false,
  created_at                 timestamptz not null default now()
);

create index if not exists idx_fechamentos_repasse_user
  on public.fechamentos_repasse (user_id, fechado_em desc);
create index if not exists idx_fechamentos_repasse_prof
  on public.fechamentos_repasse (user_id, profissional_id);

alter table public.fechamentos_repasse enable row level security;
alter table public.fechamentos_repasse force row level security;

create policy "fechamentos_repasse_select" on public.fechamentos_repasse
  for select using (auth.uid() = user_id);

create policy "fechamentos_repasse_insert" on public.fechamentos_repasse
  for insert with check (auth.uid() = user_id);

-- Imutabilidade: fechamentos são registros contábeis — não podem ser editados
revoke update, delete on public.fechamentos_repasse from anon, authenticated;

-- =====================================================================
-- SEPARAÇÃO CONTÁBIL (CA-05) — alimenta o DRE (E7-G1)
-- ---------------------------------------------------------------------
-- Os campos de fechamentos_repasse mapeiam para o DRE da seguinte forma:
--   faturamento_bruto           → receita_bruta_total (atendimentos do parceiro)
--   valor_repasse_profissional  → custo_repasse_parceiros (saída — percentual)
--   valor_retencao_clinica      → receita_liquida_clinica (percentual) ou
--                                 receita_aluguel (fixo_periodo/fixo_sessao)
--
-- Query sugerida para o DRE (E7-G1):
--   SELECT
--     SUM(faturamento_bruto)          AS receita_bruta_parceiros,
--     SUM(valor_repasse_profissional) AS custo_repasse_parceiros,
--     SUM(valor_retencao_clinica)     AS retencao_liquida_clinica
--   FROM fechamentos_repasse
--   WHERE user_id = $uid
--     AND data_inicio >= $inicio
--     AND data_fim <= $fim;
-- =====================================================================
