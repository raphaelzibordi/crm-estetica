-- ============================================================
-- CRIAR TABELA: procedimentos
-- Execute este script no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.procedimentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  descricao   text,
  preco       numeric(10,2) NOT NULL DEFAULT 0,
  duracao_minutos   integer NOT NULL DEFAULT 60,
  validade_dias     integer NOT NULL DEFAULT 90,
  sala_requerida    text,
  profissional_responsavel text,
  created_at  timestamptz DEFAULT now()
);

-- Índice para filtrar por usuário rapidamente
CREATE INDEX IF NOT EXISTS procedimentos_user_id_idx ON public.procedimentos(user_id);

-- Row Level Security
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: cada usuário vê e manipula apenas seus próprios registros
CREATE POLICY "procedimentos_select" ON public.procedimentos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "procedimentos_insert" ON public.procedimentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "procedimentos_update" ON public.procedimentos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "procedimentos_delete" ON public.procedimentos
  FOR DELETE USING (auth.uid() = user_id);
