-- ============================================================
-- US-028 · E5-G7 — IA no prontuário: transcrição de áudio e
-- resumo automático do histórico clínico (CFM/LGPD)
-- Aplicar no Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- Tabela de gravações/transcrições de consulta (CA-01, CA-02, CA-04, CA-05)
-- Cada linha representa um ciclo: consentimento -> gravação ->
-- transcrição -> estruturação por IA -> revisão -> aprovação -> prontuário
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prontuarios_gravacoes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  cliente_id           UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  profissional         TEXT NOT NULL,

  -- Consentimento explícito do paciente (CA-04) — obrigatório antes de iniciar
  consentimento_aceito BOOLEAN NOT NULL DEFAULT FALSE,
  consentimento_em     TIMESTAMPTZ,

  -- Estado do ciclo de vida da transcrição
  status               TEXT NOT NULL DEFAULT 'aguardando_consentimento'
                       CHECK (status IN (
                         'aguardando_consentimento',
                         'gravando',
                         'transcrevendo',
                         'em_revisao',
                         'aprovada',
                         'descartada'
                       )),

  -- Texto bruto transcrito (editável pelo profissional antes de aprovar)
  transcricao_bruta    TEXT,

  -- Estruturação automática por IA nas seções do prontuário (CA-02)
  estrutura_queixa     TEXT,
  estrutura_historico  TEXT,
  estrutura_exame      TEXT,
  estrutura_conduta    TEXT,
  estrutura_prescricao TEXT,

  -- Sugestões de CID-10 — apenas sugestão, profissional decide (CA-02)
  cid10_sugestoes      TEXT[],

  -- Vínculo com a evolução clínica gerada após aprovação (US-021)
  evolucao_id          UUID REFERENCES public.prontuarios_evolucoes(id) ON DELETE SET NULL,

  -- Privacidade dos dados de IA (CA-05): controle de exclusão do áudio original
  audio_excluido_em    TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gravacoes_cliente ON public.prontuarios_gravacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_gravacoes_user ON public.prontuarios_gravacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_gravacoes_status ON public.prontuarios_gravacoes(status);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at_gravacoes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_gravacoes_updated_at ON public.prontuarios_gravacoes;
CREATE TRIGGER trg_gravacoes_updated_at
  BEFORE UPDATE ON public.prontuarios_gravacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_gravacoes();

-- RLS: cada usuário (clínica) só acessa suas próprias gravações
ALTER TABLE public.prontuarios_gravacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gravacoes_select_own" ON public.prontuarios_gravacoes;
CREATE POLICY "gravacoes_select_own" ON public.prontuarios_gravacoes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "gravacoes_insert_own" ON public.prontuarios_gravacoes;
CREATE POLICY "gravacoes_insert_own" ON public.prontuarios_gravacoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gravacoes_update_own" ON public.prontuarios_gravacoes;
CREATE POLICY "gravacoes_update_own" ON public.prontuarios_gravacoes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gravacoes_delete_own" ON public.prontuarios_gravacoes;
CREATE POLICY "gravacoes_delete_own" ON public.prontuarios_gravacoes
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.prontuarios_gravacoes IS 'US-028: ciclo de vida de gravação/transcrição/estruturação por IA de consultas — consentimento obrigatório (CFM/LGPD), revisão humana obrigatória antes de gravar no prontuário';
COMMENT ON COLUMN public.prontuarios_gravacoes.consentimento_aceito IS 'Consentimento explícito do paciente para gravação de áudio — obrigatório antes de iniciar (CA-04)';
COMMENT ON COLUMN public.prontuarios_gravacoes.audio_excluido_em IS 'Timestamp de exclusão do áudio original pelo profissional após aprovação — dados de IA não são retidos (CA-05)';

-- ------------------------------------------------------------
-- Resumo de histórico clínico gerado por IA (CA-03)
-- Cacheado em clientes para exibição no topo do prontuário
-- ------------------------------------------------------------
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS resumo_clinico_ia            TEXT,
  ADD COLUMN IF NOT EXISTS resumo_clinico_ia_gerado_em  TIMESTAMPTZ;

COMMENT ON COLUMN public.clientes.resumo_clinico_ia IS 'US-028 (CA-03): resumo em linguagem natural do histórico clínico do paciente, gerado por IA a partir das evoluções do prontuário — exibido no topo do prontuário';
COMMENT ON COLUMN public.clientes.resumo_clinico_ia_gerado_em IS 'Timestamp da última geração do resumo clínico por IA';
