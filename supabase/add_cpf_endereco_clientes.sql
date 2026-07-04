-- ============================================================
-- MIGRATION: Adicionar CPF e Endereço à tabela clientes
-- Execute este script no SQL Editor do Supabase
-- Data: 2026-07-04
-- ============================================================

-- Adiciona a coluna CPF (opcional, texto livre para aceitar formatação)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf TEXT DEFAULT NULL;

-- Adiciona a coluna Endereço (opcional, texto livre)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS endereco TEXT DEFAULT NULL;

-- Comentários descritivos nas colunas
COMMENT ON COLUMN public.clientes.cpf     IS 'CPF do paciente no formato 000.000.000-00 (opcional)';
COMMENT ON COLUMN public.clientes.endereco IS 'Endereço completo do paciente: rua, número, bairro, cidade (opcional)';
