-- ============================================================
-- US-026 · E5 — Plano de Tratamento Multi-Etapas
-- Aplicar no Supabase SQL Editor
-- ============================================================

-- Planos de tratamento vinculados ao paciente
CREATE TABLE IF NOT EXISTS planos_tratamento (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cliente_id             UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome_protocolo         TEXT        NOT NULL,
  objetivo               TEXT        NOT NULL DEFAULT '',
  procedimentos          TEXT        NOT NULL DEFAULT '',
  total_sessoes          INT         NOT NULL DEFAULT 1 CHECK (total_sessoes >= 1),
  frequencia_recomendada TEXT        NOT NULL DEFAULT '',
  frequencia_dias        INT,        -- janela em dias para alerta de continuidade (CA-05)
  observacoes_iniciais   TEXT        NOT NULL DEFAULT '',
  status                 TEXT        NOT NULL DEFAULT 'ativo'
                                     CHECK (status IN ('ativo', 'concluido', 'encerrado_antecipado')),
  motivo_encerramento    TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE planos_tratamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_tratamento_tenant" ON planos_tratamento
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS planos_tratamento_user_idx    ON planos_tratamento (user_id);
CREATE INDEX IF NOT EXISTS planos_tratamento_cliente_idx ON planos_tratamento (cliente_id);
CREATE INDEX IF NOT EXISTS planos_tratamento_status_idx  ON planos_tratamento (status);

-- ============================================================

-- Sessões individuais do plano de tratamento
CREATE TABLE IF NOT EXISTS sessoes_tratamento (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  plano_id             UUID        NOT NULL REFERENCES planos_tratamento(id) ON DELETE CASCADE,
  numero_sessao        INT         NOT NULL,
  data_realizada       DATE,
  agendamento_id       UUID        REFERENCES agendamentos(id) ON DELETE SET NULL,
  observacoes_clinicas TEXT        NOT NULL DEFAULT '',
  materiais_usados     TEXT        NOT NULL DEFAULT '',
  foto_antes           TEXT,       -- base64 PNG/JPEG
  foto_depois          TEXT,       -- base64 PNG/JPEG
  nivel_resposta       INT         CHECK (nivel_resposta BETWEEN 1 AND 5),
  realizada            BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plano_id, numero_sessao)
);

ALTER TABLE sessoes_tratamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessoes_tratamento_tenant" ON sessoes_tratamento
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS sessoes_tratamento_user_idx  ON sessoes_tratamento (user_id);
CREATE INDEX IF NOT EXISTS sessoes_tratamento_plano_idx ON sessoes_tratamento (plano_id);

-- ============================================================
-- View: Planos com alerta de continuidade (CA-05)
-- Retorna planos ativos cuja próxima sessão está vencida
-- ============================================================
CREATE OR REPLACE VIEW vw_planos_alerta_continuidade AS
SELECT
  pt.id                   AS plano_id,
  pt.user_id,
  pt.cliente_id,
  c.nome                  AS cliente_nome,
  c.telefone              AS cliente_telefone,
  pt.nome_protocolo,
  pt.total_sessoes,
  pt.frequencia_dias,
  COALESCE(
    MAX(st.data_realizada),
    pt.created_at::DATE
  )                       AS ultima_sessao,
  COUNT(st.id) FILTER (WHERE st.realizada)  AS sessoes_realizadas,
  pt.total_sessoes - COUNT(st.id) FILTER (WHERE st.realizada) AS sessoes_restantes
FROM planos_tratamento pt
JOIN clientes c ON c.id = pt.cliente_id
LEFT JOIN sessoes_tratamento st ON st.plano_id = pt.id
WHERE pt.status = 'ativo'
  AND pt.frequencia_dias IS NOT NULL
GROUP BY pt.id, pt.user_id, pt.cliente_id, c.nome, c.telefone,
         pt.nome_protocolo, pt.total_sessoes, pt.frequencia_dias, pt.created_at
HAVING
  CURRENT_DATE - COALESCE(MAX(st.data_realizada), pt.created_at::DATE) > pt.frequencia_dias
  AND COUNT(st.id) FILTER (WHERE st.realizada) < pt.total_sessoes;
