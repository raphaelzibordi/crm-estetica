-- ============================================================
-- US-021 · E5 — Prontuário Eletrônico (conformidade CFM)
-- Assinatura digital + imutabilidade das evoluções clínicas
-- Aplicar no Supabase SQL Editor
-- ============================================================

-- Campos de assinatura digital e aditamento (correção por nova entrada)
ALTER TABLE public.prontuarios_evolucoes
  ADD COLUMN IF NOT EXISTS assinado_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinado_por     TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_hash  TEXT,
  ADD COLUMN IF NOT EXISTS aditamento_de    UUID REFERENCES public.prontuarios_evolucoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evolucoes_aditamento_de ON public.prontuarios_evolucoes(aditamento_de);

-- ------------------------------------------------------------
-- Imutabilidade: uma vez assinado, o registro não pode ser
-- editado nem excluído (CA-03/CA-04). Correções só por aditamento.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_alteracao_evolucao_assinada()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.assinado_em IS NOT NULL THEN
      RAISE EXCEPTION 'Registro assinado em %. Prontuários assinados são imutáveis e não podem ser excluídos (CFM 1.638/2002).', OLD.assinado_em;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: bloqueia qualquer alteração em registro já assinado,
  -- exceto a própria transição de assinatura (assinado_em estava nulo).
  IF OLD.assinado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Registro assinado em %. Prontuários assinados são imutáveis — registre uma correção por aditamento.', OLD.assinado_em;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_bloquear_alteracao_evolucao_assinada ON public.prontuarios_evolucoes;
CREATE TRIGGER trg_bloquear_alteracao_evolucao_assinada
  BEFORE UPDATE OR DELETE ON public.prontuarios_evolucoes
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_alteracao_evolucao_assinada();

COMMENT ON COLUMN public.prontuarios_evolucoes.assinado_em IS 'Timestamp da assinatura digital — registro torna-se imutável a partir deste momento (CFM 1.638/2002)';
COMMENT ON COLUMN public.prontuarios_evolucoes.assinado_por IS 'Nome do profissional que assinou digitalmente o registro';
COMMENT ON COLUMN public.prontuarios_evolucoes.assinatura_hash IS 'Hash SHA-256 do conteúdo + identidade + timestamp no momento da assinatura, para verificação de integridade';
COMMENT ON COLUMN public.prontuarios_evolucoes.aditamento_de IS 'Referência ao registro original quando esta entrada é uma correção/aditamento (registros assinados não podem ser editados, apenas aditados)';
