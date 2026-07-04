-- ============================================================
-- MIGRATION: Adicionar CEP à tabela clientes
-- Execute este script no SQL Editor do Supabase
-- Data: 2026-07-04
-- ============================================================

-- Adiciona a coluna CEP (opcional, texto livre para aceitar formatação)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cep TEXT DEFAULT NULL;

-- Comentários descritivos na coluna
COMMENT ON COLUMN public.clientes.cep IS 'CEP do paciente no formato 00000-000 (opcional)';
