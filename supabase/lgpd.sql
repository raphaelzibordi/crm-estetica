-- US-047: LGPD — conformidade completa
-- Tabelas para consentimento explícito, trilha de auditoria de dados e solicitações LGPD

-- ─────────────────────────────────────────────────────────────────────────────
-- Versões de termos de privacidade
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lgpd_termos_versoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  versao       TEXT NOT NULL DEFAULT '1.0',
  texto        TEXT NOT NULL,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lgpd_termos_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lgpd_termos_owner" ON public.lgpd_termos_versoes
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Consentimentos explícitos dos pacientes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lgpd_consentimentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id            UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  versao_termo          TEXT NOT NULL DEFAULT '1.0',
  tipo                  TEXT NOT NULL DEFAULT 'servico'
                          CHECK (tipo IN ('servico', 'marketing')),
  aceito                BOOLEAN NOT NULL DEFAULT true,
  ip_address            TEXT,
  metodo                TEXT NOT NULL DEFAULT 'checkbox'
                          CHECK (metodo IN ('checkbox', 'assinatura_digital', 'responsavel_legal')),
  responsavel_legal_nome TEXT,
  responsavel_legal_cpf  TEXT,
  termo_texto            TEXT,
  revogado_em            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lgpd_consentimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lgpd_consentimentos_owner" ON public.lgpd_consentimentos
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lgpd_consentimentos_cliente
  ON public.lgpd_consentimentos(user_id, cliente_id, tipo);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trilha de auditoria imutável — acessos a dados pessoais
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lgpd_acessos_dados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  ator_id     UUID NOT NULL REFERENCES auth.users(id),
  cliente_id  UUID NOT NULL REFERENCES public.clientes(id),
  tipo_dado   TEXT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lgpd_acessos_dados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lgpd_acessos_owner_select" ON public.lgpd_acessos_dados
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lgpd_acessos_insert" ON public.lgpd_acessos_dados
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = ator_id);

-- Imutabilidade: sem UPDATE ou DELETE
REVOKE UPDATE, DELETE ON public.lgpd_acessos_dados FROM authenticated;

CREATE INDEX IF NOT EXISTS idx_lgpd_acessos_cliente
  ON public.lgpd_acessos_dados(user_id, cliente_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Solicitações LGPD (acesso, exclusão, portabilidade, revogação)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lgpd_solicitacoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id       UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL
                     CHECK (tipo IN ('acesso', 'exclusao', 'portabilidade', 'revogacao_consentimento')),
  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'em_processamento', 'concluida', 'rejeitada')),
  motivo           TEXT,
  resposta         TEXT,
  processado_por   UUID REFERENCES auth.users(id),
  processado_em    TIMESTAMPTZ,
  prazo_legal      TIMESTAMPTZ,
  dados_exportados JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lgpd_solicitacoes_owner" ON public.lgpd_solicitacoes
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_pendentes
  ON public.lgpd_solicitacoes(user_id, status, created_at DESC);
