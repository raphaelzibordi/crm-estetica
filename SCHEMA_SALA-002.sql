-- SALA-002: Tabela de salas de atendimento e associação com agendamentos

-- Tabela de salas de atendimento
CREATE TABLE IF NOT EXISTS public.salas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salas' AND policyname = 'salas_tenant_all'
  ) THEN
    CREATE POLICY "salas_tenant_all" ON public.salas
      FOR ALL USING (user_id = get_tenant_id())
      WITH CHECK (user_id = get_tenant_id());
  END IF;
END $$;

-- room_id FK em agendamentos
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.salas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_salas_user_id ON public.salas(user_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_room_id ON public.agendamentos(room_id, data);
