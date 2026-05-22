-- ============================================================
-- US-023 · E5 — Anamnese Digital Personalizada
-- Aplicar no Supabase SQL Editor
-- ============================================================

-- Modelos de formulário configuráveis por procedimento
CREATE TABLE IF NOT EXISTS anamnese_formularios (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome            TEXT        NOT NULL,
  procedimento_id UUID        REFERENCES procedimentos(id) ON DELETE SET NULL,
  campos          JSONB       NOT NULL DEFAULT '[]',
  -- Estrutura de cada campo em "campos":
  -- { id: uuid, tipo: 'texto_livre'|'multipla_escolha'|'sim_nao'|'escala_numerica'|'assinatura_consentimento',
  --   label: text, obrigatorio: bool, opcoes?: string[] }
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE anamnese_formularios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anamnese_formularios_tenant" ON anamnese_formularios
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS anamnese_formularios_user_idx ON anamnese_formularios (user_id);
CREATE INDEX IF NOT EXISTS anamnese_formularios_proc_idx ON anamnese_formularios (procedimento_id);

-- ============================================================

-- Instâncias de anamnese aplicadas (respostas vinculadas ao prontuário)
CREATE TABLE IF NOT EXISTS anamnese_respostas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cliente_id      UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  formulario_id   UUID        NOT NULL REFERENCES anamnese_formularios(id) ON DELETE RESTRICT,
  agendamento_id  UUID        REFERENCES agendamentos(id) ON DELETE SET NULL,
  -- Respostas: mapa campo_id -> valor (string | string[] | number | boolean)
  respostas       JSONB       NOT NULL DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente', 'preenchido', 'assinado')),
  -- Token para acesso público sem login (CA-02: envio pré-consulta)
  token_publico   UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_expira_em TIMESTAMPTZ,               -- 48h após envio; NULL = não enviado
  -- Assinatura digital (base64 PNG do canvas)
  assinatura_data TEXT,
  assinado_em     TIMESTAMPTZ,
  -- Revisão pelo profissional
  revisado_por    TEXT,
  revisado_em     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE anamnese_respostas ENABLE ROW LEVEL SECURITY;

-- Acesso autenticado (dono + equipe do tenant)
CREATE POLICY "anamnese_respostas_tenant" ON anamnese_respostas
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT owner_id FROM usuarios WHERE id = auth.uid() AND owner_id IS NOT NULL
    )
  );

-- Acesso público via token (paciente preenche sem login) — somente UPDATE em respostas/status
-- Implementado via RPC abaixo para contornar limitações de RLS em requests sem JWT.

CREATE INDEX IF NOT EXISTS anamnese_respostas_user_idx    ON anamnese_respostas (user_id);
CREATE INDEX IF NOT EXISTS anamnese_respostas_cliente_idx ON anamnese_respostas (cliente_id);
CREATE INDEX IF NOT EXISTS anamnese_respostas_status_idx  ON anamnese_respostas (status);
CREATE INDEX IF NOT EXISTS anamnese_respostas_token_idx   ON anamnese_respostas (token_publico);

-- ============================================================
-- RPC: Preenchimento público via token (CA-02 — sem login)
-- ============================================================
CREATE OR REPLACE FUNCTION preencher_anamnese_publica(
  p_token     UUID,
  p_respostas JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   UUID;
  v_exp  TIMESTAMPTZ;
BEGIN
  SELECT id, token_expira_em
    INTO v_id, v_exp
    FROM anamnese_respostas
   WHERE token_publico = p_token
     AND status != 'assinado'
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN json_build_object('ok', false, 'erro', 'Token inválido ou anamnese já assinada.');
  END IF;

  IF v_exp IS NOT NULL AND v_exp < now() THEN
    RETURN json_build_object('ok', false, 'erro', 'Link expirado. Solicite um novo envio à recepção.');
  END IF;

  UPDATE anamnese_respostas
     SET respostas = p_respostas,
         status    = 'preenchido'
   WHERE id = v_id;

  RETURN json_build_object('ok', true);
END;
$$;
