-- SALA-005: Tabela de auditoria de mudanças de sala em agendamentos

CREATE TABLE IF NOT EXISTS public.appointment_changes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE CASCADE NOT NULL,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  alterado_por text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_changes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'appointment_changes' AND policyname = 'appointment_changes_tenant_all'
  ) THEN
    CREATE POLICY "appointment_changes_tenant_all" ON public.appointment_changes
      FOR ALL USING (user_id = get_tenant_id())
      WITH CHECK (user_id = get_tenant_id());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointment_changes_agendamento_id
  ON public.appointment_changes(agendamento_id, created_at DESC);
