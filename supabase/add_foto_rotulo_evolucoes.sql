-- ============================================================
-- MIGRATION: Adicionar foto do rótulo à tabela prontuarios_evolucoes
-- Execute este script no SQL Editor do Supabase
-- Data: 2026-07-05
-- ============================================================

-- Adiciona a coluna para armazenar a foto do rótulo do produto (dados técnicos)
ALTER TABLE public.prontuarios_evolucoes
  ADD COLUMN IF NOT EXISTS foto_rotulo_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.prontuarios_evolucoes.foto_rotulo_url IS 'Foto do rótulo do produto utilizado, anexada na evolução clínica (data URL base64)';
