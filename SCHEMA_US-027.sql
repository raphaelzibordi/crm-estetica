-- ============================================================
-- US-027 · E5 — Templates de Prescrições e Documentos Médicos
-- Aplicar no Supabase SQL Editor
-- ============================================================

-- Biblioteca de templates reutilizáveis
CREATE TABLE IF NOT EXISTS prescricao_templates (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_por_user_id    UUID        NOT NULL,  -- auth.uid() de quem criou (owner ou membro equipe)
  criado_por_nome       TEXT        NOT NULL DEFAULT '',
  nome                  TEXT        NOT NULL,
  categoria             TEXT        NOT NULL DEFAULT 'outro'
                                    CHECK (categoria IN (
                                      'prescricao',
                                      'orientacao_pos_procedimento',
                                      'recomendacao_dermatologica',
                                      'recomendacao_estetica',
                                      'outro'
                                    )),
  conteudo              TEXT        NOT NULL DEFAULT '',
  variaveis             TEXT[]      NOT NULL DEFAULT '{}',
  compartilhado         BOOLEAN     NOT NULL DEFAULT false,
  permissao_edicao      TEXT        NOT NULL DEFAULT 'somente_criador'
                                    CHECK (permissao_edicao IN ('somente_criador', 'qualquer_profissional')),
  ativo                 BOOLEAN     NOT NULL DEFAULT true,
  uso_count             INT         NOT NULL DEFAULT 0,
  ultimo_uso_em         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prescricao_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescricao_templates_tenant" ON prescricao_templates
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS prescricao_templates_user_idx      ON prescricao_templates (user_id);
CREATE INDEX IF NOT EXISTS prescricao_templates_categoria_idx ON prescricao_templates (categoria);
CREATE INDEX IF NOT EXISTS prescricao_templates_ativo_idx     ON prescricao_templates (ativo);

-- ============================================================

-- Histórico de versões (salva conteúdo anterior antes de cada edição)
CREATE TABLE IF NOT EXISTS prescricao_template_versoes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID        NOT NULL REFERENCES prescricao_templates(id) ON DELETE CASCADE,
  versao              INT         NOT NULL,
  conteudo_anterior   TEXT        NOT NULL,
  editado_por_nome    TEXT        NOT NULL DEFAULT '',
  editado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prescricao_template_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescricao_template_versoes_tenant" ON prescricao_template_versoes
  USING (
    template_id IN (
      SELECT id FROM prescricao_templates
      WHERE user_id = auth.uid()
        OR user_id IN (SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL)
    )
  );

CREATE INDEX IF NOT EXISTS prescricao_template_versoes_template_idx ON prescricao_template_versoes (template_id);

-- ============================================================

-- Log de usos por template (para CA-06 — Relatório de uso)
CREATE TABLE IF NOT EXISTS prescricao_template_usos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID        NOT NULL REFERENCES prescricao_templates(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cliente_id    UUID        REFERENCES clientes(id) ON DELETE SET NULL,
  procedimento  TEXT,
  usado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prescricao_template_usos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescricao_template_usos_tenant" ON prescricao_template_usos
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS prescricao_template_usos_template_idx ON prescricao_template_usos (template_id);
CREATE INDEX IF NOT EXISTS prescricao_template_usos_user_idx     ON prescricao_template_usos (user_id);
CREATE INDEX IF NOT EXISTS prescricao_template_usos_cliente_idx  ON prescricao_template_usos (cliente_id);
