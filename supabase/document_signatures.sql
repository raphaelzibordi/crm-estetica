-- ============================================================
-- US-025 — Assinatura Digital de Contratos e Consentimentos
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ── Modelos de documentos (editáveis pelo gestor) ─────────────────
CREATE TABLE IF NOT EXISTS public.document_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  tipo        text NOT NULL DEFAULT 'outro',  -- contrato | tcle | termo_anestesia | termo_fotografias | prescricao | outro
  conteudo    text NOT NULL DEFAULT '',
  variaveis   text[] NOT NULL DEFAULT '{}',
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_templates_user_id_idx ON public.document_templates(user_id);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_templates_select" ON public.document_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "document_templates_insert" ON public.document_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "document_templates_update" ON public.document_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "document_templates_delete" ON public.document_templates
  FOR DELETE USING (auth.uid() = user_id);

-- ── Documentos assinados (imutáveis por regra de negócio) ─────────
-- Nota: RLS permite INSERT e SELECT. UPDATE é restrito ao tenant e
-- somente para campos de assinatura (status pendente → assinado).
-- Conteúdo (conteudo_final, hash_integridade) nunca é alterado após criação.
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id           uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  modelo_id            uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  titulo               text NOT NULL,
  conteudo_final       text NOT NULL,
  hash_integridade     text NOT NULL,
  assinatura_data      text,               -- base64 PNG da assinatura
  assinatura_metodo    text,               -- 'presencial' | 'remoto'
  assinado_em          timestamptz,
  assinado_ip          text,
  assinado_dispositivo text,
  profissional         text NOT NULL DEFAULT '',
  status               text NOT NULL DEFAULT 'pendente',  -- pendente | assinado | expirado
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_signatures_user_id_idx     ON public.document_signatures(user_id);
CREATE INDEX IF NOT EXISTS document_signatures_cliente_id_idx  ON public.document_signatures(cliente_id);

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_signatures_select" ON public.document_signatures
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "document_signatures_insert" ON public.document_signatures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE permitido somente pelo tenant (conteúdo imutável via lógica de aplicação)
CREATE POLICY "document_signatures_update" ON public.document_signatures
  FOR UPDATE USING (auth.uid() = user_id);

-- ── Links de assinatura remota (token com expiração de 48h) ──────
CREATE TABLE IF NOT EXISTS public.document_signature_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id  uuid NOT NULL REFERENCES public.document_signatures(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  expira_em     timestamptz NOT NULL,
  usado_em      timestamptz,
  cancelado_em  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_signature_links_token_idx      ON public.document_signature_links(token);
CREATE INDEX IF NOT EXISTS document_signature_links_documento_idx  ON public.document_signature_links(documento_id);

ALTER TABLE public.document_signature_links ENABLE ROW LEVEL SECURITY;

-- O tenant pode ler e criar links dos próprios documentos
CREATE POLICY "doc_links_select" ON public.document_signature_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_signatures ds
      WHERE ds.id = document_signature_links.documento_id
        AND ds.user_id = auth.uid()
    )
  );

CREATE POLICY "doc_links_insert" ON public.document_signature_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_signatures ds
      WHERE ds.id = document_signature_links.documento_id
        AND ds.user_id = auth.uid()
    )
  );

-- ── RPC pública: retorna conteúdo do documento pelo token ─────────
CREATE OR REPLACE FUNCTION public.get_document_for_signing(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link  record;
  v_doc   record;
BEGIN
  SELECT * INTO v_link
  FROM public.document_signature_links
  WHERE token = p_token
    AND expira_em > now()
    AND usado_em IS NULL
    AND cancelado_em IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Link inválido ou expirado.');
  END IF;

  SELECT * INTO v_doc
  FROM public.document_signatures
  WHERE id = v_link.documento_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Documento não encontrado.');
  END IF;

  IF v_doc.status = 'assinado' THEN
    RETURN json_build_object('success', false, 'error', 'Este documento já foi assinado.');
  END IF;

  RETURN json_build_object(
    'success',    true,
    'titulo',     v_doc.titulo,
    'conteudo',   v_doc.conteudo_final,
    'profissional', v_doc.profissional,
    'hash',       v_doc.hash_integridade,
    'expira_em',  v_link.expira_em
  );
END;
$$;

-- ── RPC pública: efetua assinatura via token ──────────────────────
CREATE OR REPLACE FUNCTION public.sign_document_by_token(
  p_token       text,
  p_assinatura  text,
  p_ip          text DEFAULT NULL,
  p_dispositivo text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
BEGIN
  SELECT * INTO v_link
  FROM public.document_signature_links
  WHERE token = p_token
    AND expira_em > now()
    AND usado_em IS NULL
    AND cancelado_em IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Link inválido ou expirado.');
  END IF;

  UPDATE public.document_signatures
  SET
    assinatura_data      = p_assinatura,
    assinatura_metodo    = 'remoto',
    assinado_em          = now(),
    assinado_ip          = p_ip,
    assinado_dispositivo = p_dispositivo,
    status               = 'assinado'
  WHERE id = v_link.documento_id
    AND status = 'pendente';

  UPDATE public.document_signature_links
  SET usado_em = now()
  WHERE id = v_link.id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_for_signing(text)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_document_by_token(text, text, text, text) TO anon, authenticated;
