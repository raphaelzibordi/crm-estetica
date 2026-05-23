-- ============================================================
-- US-0444 · E8 — Gestão de Estoque Fracionado de Insumos
-- Aplicar no Supabase SQL Editor
-- ============================================================

-- Estende a tabela existente com campos de custo, fornecedor, validade
ALTER TABLE estoque
  ALTER COLUMN quantidade      TYPE NUMERIC(10,3),
  ALTER COLUMN quantidade_minima TYPE NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS custo_unitario  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_medio     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fornecedor      TEXT          NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validade        DATE,
  ADD COLUMN IF NOT EXISTS observacoes     TEXT          NOT NULL DEFAULT '';

-- ============================================================

-- Vínculo insumo ↔ procedimento (consumo fracionado configurado)
CREATE TABLE IF NOT EXISTS estoque_vinculos_procedimentos (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  produto_id        UUID        NOT NULL REFERENCES estoque(id) ON DELETE CASCADE,
  procedimento_nome TEXT        NOT NULL,
  quantidade        NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (quantidade > 0),
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, produto_id, procedimento_nome)
);

ALTER TABLE estoque_vinculos_procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_vinculos_tenant" ON estoque_vinculos_procedimentos
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS estoque_vinculos_user_idx      ON estoque_vinculos_procedimentos (user_id);
CREATE INDEX IF NOT EXISTS estoque_vinculos_produto_idx   ON estoque_vinculos_procedimentos (produto_id);
CREATE INDEX IF NOT EXISTS estoque_vinculos_proc_idx      ON estoque_vinculos_procedimentos (procedimento_nome);

-- ============================================================

-- Trilha de auditoria de todos os movimentos de estoque
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  produto_id      UUID          NOT NULL REFERENCES estoque(id) ON DELETE CASCADE,
  tipo            TEXT          NOT NULL
                                CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'devolucao', 'vencimento')),
  quantidade      NUMERIC(10,3) NOT NULL,          -- positivo = entrada, negativo = saída
  custo_unitario  NUMERIC(10,2) NOT NULL DEFAULT 0,
  referencia      TEXT,                             -- procedimento, fornecedor, etc.
  agendamento_id  UUID          REFERENCES agendamentos(id) ON DELETE SET NULL,
  profissional    TEXT,
  justificativa   TEXT,
  criado_por      TEXT          NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE estoque_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_movimentos_tenant" ON estoque_movimentos
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS estoque_movimentos_user_idx    ON estoque_movimentos (user_id);
CREATE INDEX IF NOT EXISTS estoque_movimentos_produto_idx ON estoque_movimentos (produto_id);
CREATE INDEX IF NOT EXISTS estoque_movimentos_tipo_idx    ON estoque_movimentos (tipo);
CREATE INDEX IF NOT EXISTS estoque_movimentos_data_idx    ON estoque_movimentos (created_at DESC);
