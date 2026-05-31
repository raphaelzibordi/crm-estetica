-- ══════════════════════════════════════════════════════════════════
-- US-048: Suporte a Multiclínicas com Consolidação por Rede
-- ══════════════════════════════════════════════════════════════════

-- ── Tabela de Redes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.redes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome                 TEXT NOT NULL,
  descricao            TEXT,
  paciente_compartilhado BOOLEAN NOT NULL DEFAULT false,
  desconto_volume_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo                BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de Unidades (clínicas dentro da rede) ──────────────────
CREATE TABLE IF NOT EXISTS public.unidades (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rede_id    UUID NOT NULL REFERENCES public.redes(id) ON DELETE CASCADE,
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  cnpj       TEXT,
  endereco   TEXT,
  telefone   TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de Acesso por Unidade (RBAC estendido) ─────────────────
CREATE TABLE IF NOT EXISTS public.unidade_usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('gestor_rede', 'dono', 'equipe', 'visualizador')),
  permissoes  JSONB NOT NULL DEFAULT '{}',
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (unidade_id, user_id)
);

-- ── Coluna unidade_id nas tabelas principais (nullable, retrocompat) ─
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL;

-- ── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_redes_owner_id       ON public.redes(owner_id);
CREATE INDEX IF NOT EXISTS idx_unidades_rede_id     ON public.unidades(rede_id);
CREATE INDEX IF NOT EXISTS idx_unidades_owner_id    ON public.unidades(owner_id);
CREATE INDEX IF NOT EXISTS idx_unidade_usuarios_uid ON public.unidade_usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_unidade ON public.agendamentos(unidade_id) WHERE unidade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_unidade     ON public.clientes(unidade_id) WHERE unidade_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.redes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidade_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redes_owner_all" ON public.redes
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "unidades_rede_owner_all" ON public.unidades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.redes r
      WHERE r.id = unidades.rede_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "unidades_member_select" ON public.unidades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.unidade_usuarios uu
      WHERE uu.unidade_id = unidades.id
        AND uu.user_id = auth.uid()
        AND uu.ativo = true
    )
  );

CREATE POLICY "unidade_usuarios_rede_owner_all" ON public.unidade_usuarios
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.unidades u
      JOIN public.redes r ON r.id = u.rede_id
      WHERE u.id = unidade_usuarios.unidade_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "unidade_usuarios_self_select" ON public.unidade_usuarios
  FOR SELECT USING (auth.uid() = user_id);

-- ── Trigger updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_redes_updated_at
  BEFORE UPDATE ON public.redes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_unidades_updated_at
  BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Função consolidada de métricas da rede (SECURITY DEFINER) ────
CREATE OR REPLACE FUNCTION public.get_rede_metricas(
  p_rede_id    UUID,
  p_data_inicio DATE,
  p_data_fim    DATE
)
RETURNS TABLE (
  unidade_id             UUID,
  unidade_nome           TEXT,
  faturamento            NUMERIC,
  total_agendamentos     BIGINT,
  agendamentos_finalizados BIGINT,
  ticket_medio           NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.redes
    WHERE id = p_rede_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não é dono desta rede';
  END IF;

  RETURN QUERY
  SELECT
    u.id                                                                AS unidade_id,
    u.nome                                                              AS unidade_nome,
    COALESCE(SUM(a.valor) FILTER (WHERE a.status = 'finalizada'), 0)   AS faturamento,
    COUNT(a.id)                                                         AS total_agendamentos,
    COUNT(a.id) FILTER (WHERE a.status = 'finalizada')                 AS agendamentos_finalizados,
    CASE
      WHEN COUNT(a.id) FILTER (WHERE a.status = 'finalizada') > 0
      THEN COALESCE(SUM(a.valor) FILTER (WHERE a.status = 'finalizada'), 0)
           / COUNT(a.id) FILTER (WHERE a.status = 'finalizada')
      ELSE 0
    END                                                                 AS ticket_medio
  FROM public.unidades u
  LEFT JOIN public.agendamentos a
    ON  a.user_id    = u.owner_id
    AND a.unidade_id = u.id
    AND a.data BETWEEN p_data_inicio AND p_data_fim
  WHERE u.rede_id = p_rede_id
  GROUP BY u.id, u.nome
  ORDER BY faturamento DESC;
END;
$$;

-- ── Função: pacientes compartilhados entre unidades da rede ───────
CREATE OR REPLACE FUNCTION public.get_rede_clientes(
  p_rede_id UUID,
  p_search  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  nome             TEXT,
  telefone         TEXT,
  email            TEXT,
  data_ultima_visita DATE,
  status_retencao  TEXT,
  unidades_visitadas TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.redes
    WHERE id = p_rede_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não é dono desta rede';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.nome,
    c.telefone,
    c.email,
    c.data_ultima_visita,
    c.status_retencao,
    ARRAY_AGG(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL) AS unidades_visitadas
  FROM public.clientes c
  JOIN public.unidades u ON u.owner_id = c.user_id AND u.rede_id = p_rede_id
  LEFT JOIN public.agendamentos a
    ON a.cliente_id = c.id AND a.unidade_id = u.id
  WHERE u.rede_id = p_rede_id
    AND (p_search IS NULL OR c.nome ILIKE '%' || p_search || '%')
  GROUP BY c.id, c.nome, c.telefone, c.email, c.data_ultima_visita, c.status_retencao
  ORDER BY c.nome;
END;
$$;
