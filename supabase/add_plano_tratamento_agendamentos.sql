-- ============================================================
-- MIGRATION: Vincular agendamentos ao plano de tratamento de origem
-- Execute este script no SQL Editor do Supabase
-- Data: 2026-07-18
--
-- Contexto: src/lib/api.ts (createAgendamento) já insere plano_tratamento_id
-- e plano_procedimento_nome desde a feature de Planos de Tratamento
-- (src/components/PlanoTratamento.tsx), mas essas colunas nunca foram
-- criadas na tabela agendamentos deste projeto — todo INSERT falhava com
-- PGRST204 ("coluna não encontrada no schema cache"), quebrando 100% da
-- criação de agendamentos. Esta migração fecha o gap.
-- ============================================================

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS plano_tratamento_id UUID REFERENCES public.planos_tratamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plano_procedimento_nome TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_agendamentos_plano_tratamento_id
  ON public.agendamentos(plano_tratamento_id)
  WHERE plano_tratamento_id IS NOT NULL;

COMMENT ON COLUMN public.agendamentos.plano_tratamento_id IS 'Plano de tratamento (protocolo) que originou este agendamento, se houver';
COMMENT ON COLUMN public.agendamentos.plano_procedimento_nome IS 'Nome do procedimento específico do plano de tratamento vinculado a este agendamento';
