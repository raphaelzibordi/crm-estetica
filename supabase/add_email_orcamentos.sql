-- ============================================================
-- MIGRATION: Adicionar coluna email à tabela orcamentos
-- Execute este script no SQL Editor do Supabase
-- Data: 2026-07-18
--
-- Contexto: src/lib/api.ts (createOrcamento e updateOrcamentoStatus) sempre
-- leu/gravou a coluna orcamentos.email — usada para follow-up por e-mail
-- (ver CANAL_LABELS em Orcamentos.tsx: whatsapp/email/ambos) e para criar
-- o cadastro do paciente automaticamente ao aprovar um orçamento sem
-- cliente vinculado. A coluna nunca existia neste projeto, quebrando com
-- PGRST204 tanto a criação quanto a aprovação de QUALQUER orçamento.
-- ============================================================

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

COMMENT ON COLUMN public.orcamentos.email IS 'E-mail do cliente/lead para follow-up e para criar o cadastro do paciente ao aprovar o orçamento';
