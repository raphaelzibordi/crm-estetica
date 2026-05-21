-- =================================================================
-- US-007b: Confirmações Automáticas de Consultas (WhatsApp/SMS)
-- Reduz o esforço manual de recepção de 30-40% para ~5%
-- =================================================================

-- Campos de confirmação na tabela agendamentos
alter table public.agendamentos
  add column if not exists confirmacao_metodo      text,                    -- 'whatsapp' | 'sms' | null
  add column if not exists confirmacao_enviada_em  timestamp with time zone,
  add column if not exists confirmacao_status      text,                    -- 'pendente' | 'enviada' | 'entregue' | 'lido'
  add column if not exists confirmacao_telefone    text;                    -- WhatsApp/SMS para envio

-- Campos de configuração de confirmações na tabela usuarios
alter table public.usuarios
  add column if not exists confirmacao_habilitada     boolean not null default true,
  add column if not exists confirmacao_metodo_padrao  text not null default 'whatsapp',  -- 'whatsapp' | 'sms' | 'ambos'
  add column if not exists confirmacao_horas_antes    integer not null default 48,       -- Enviar primeiro lembrete X horas antes
  add column if not exists confirmacao_horas_antes_2  integer not null default 2;        -- Enviar segundo lembrete X horas antes

-- Tabela de histórico/log de confirmações (para auditoria)
create table if not exists public.confirmacoes_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  agendamento_id uuid references public.agendamentos(id) on delete cascade not null,
  metodo text not null,                     -- 'whatsapp' | 'sms'
  telefone text not null,
  mensagem text,
  status text not null,                     -- 'enviada' | 'entregue' | 'erro'
  erro_mensagem text,
  enviada_em timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.confirmacoes_log enable row level security;

drop policy if exists "confirmacoes_log_all" on public.confirmacoes_log;
create policy "confirmacoes_log_all" on public.confirmacoes_log for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

create index if not exists idx_confirmacoes_agendamento on public.confirmacoes_log(agendamento_id);
create index if not exists idx_confirmacoes_user_status on public.confirmacoes_log(user_id, status);

-- =================================================================
-- RPC: Busca configurações de confirmação do usuário
-- =================================================================
create or replace function public.get_confirmation_settings(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'confirmacaoHabilitada',   u.confirmacao_habilitada,
    'confirmacaoMetodoPadrao', u.confirmacao_metodo_padrao,
    'confirmacaoHorasAntes',   u.confirmacao_horas_antes,
    'confirmacaoHorasAntes2',  u.confirmacao_horas_antes_2
  ) into v_result
  from public.usuarios u
  where u.id = p_user_id;
  return v_result;
end;
$$;

-- =================================================================
-- RPC: Atualiza configurações de confirmação
-- =================================================================
create or replace function public.update_confirmation_settings(
  p_user_id uuid,
  p_habilitada boolean,
  p_metodo_padrao text,
  p_horas_antes integer,
  p_horas_antes_2 integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usuarios
  set
    confirmacao_habilitada = p_habilitada,
    confirmacao_metodo_padrao = p_metodo_padrao,
    confirmacao_horas_antes = p_horas_antes,
    confirmacao_horas_antes_2 = p_horas_antes_2
  where id = p_user_id;

  return json_build_object(
    'confirmacaoHabilitada',   p_habilitada,
    'confirmacaoMetodoPadrao', p_metodo_padrao,
    'confirmacaoHorasAntes',   p_horas_antes,
    'confirmacaoHorasAntes2',  p_horas_antes_2
  );
end;
$$;

-- =================================================================
-- RPC: Registra envio de confirmação (chamado após WhatsApp/SMS enviado)
-- =================================================================
create or replace function public.log_confirmation_sent(
  p_user_id uuid,
  p_agendamento_id uuid,
  p_metodo text,
  p_telefone text,
  p_mensagem text,
  p_status text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.confirmacoes_log (user_id, agendamento_id, metodo, telefone, mensagem, status)
  values (p_user_id, p_agendamento_id, p_metodo, p_telefone, p_mensagem, p_status)
  returning id into v_log_id;

  -- Atualiza flag no agendamento
  update public.agendamentos
  set
    confirmacao_metodo = p_metodo,
    confirmacao_enviada_em = timezone('utc'::text, now()),
    confirmacao_status = p_status,
    confirmacao_telefone = p_telefone
  where id = p_agendamento_id;

  return json_build_object(
    'logId', v_log_id,
    'status', 'registrado'
  );
end;
$$;

-- =================================================================
-- RPC: Lista agendamentos pendentes de confirmação (próximos X horas)
-- =================================================================
create or replace function public.get_pending_confirmations(p_user_id uuid, p_horas_proximas integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_agg(
    json_build_object(
      'agendamentoId',  a.id,
      'clienteNome',    c.nome,
      'clienteTelefone', c.telefone,
      'clienteEmail',   c.email,
      'data',           a.data,
      'horaInicio',     to_char(a.hora_inicio, 'HH24:MI'),
      'profissional',   a.profissional,
      'procedimento',   a.procedimento,
      'confirmacaoStatus', a.confirmacao_status
    )
  ) into v_result
  from public.agendamentos a
  join public.clientes c on c.id = a.cliente_id
  where a.user_id = p_user_id
    and a.data >= current_date
    and a.data <= (current_date + interval '180 days')
    and a.status not in ('cancelada', 'finalizada')
    and (a.confirmacao_status is null or a.confirmacao_status = 'pendente')
    and a.data + a.hora_inicio - (interval '1 hour' * p_horas_proximas) <= now()
    and a.data + a.hora_inicio > now();
  return coalesce(v_result, '[]'::json);
end;
$$;

-- =================================================================
-- US-007c: Controle de Faltas e Desmarcações com Histórico
-- Rastreamento de no-shows e cancellations por paciente
-- =================================================================

-- Campos para rastreamento de presença na tabela agendamentos
alter table public.agendamentos
  add column if not exists presenca_status      text,                    -- 'compareceu' | 'faltou' | 'desmarcou' | null
  add column if not exists falta_motivo         text,                    -- Motivo da falta/desmarcação (opcional)
  add column if not exists falta_registrada_em  timestamp with time zone; -- Quando foi registrada a falta

-- Índice para buscar histórico de presença de um paciente
create index if not exists idx_agendamentos_cliente_presenca
  on public.agendamentos(cliente_id, data desc)
  where presenca_status is not null;

-- Índice para buscar faltas de um paciente (sem cláusula de data para evitar erro de IMMUTABLE)
create index if not exists idx_agendamentos_falta_status
  on public.agendamentos(cliente_id, presenca_status)
  where presenca_status = 'faltou';

-- =================================================================
-- RPC: Registra presença/falta de um agendamento
-- =================================================================
create or replace function public.register_attendance(
  p_agendamento_id uuid,
  p_presenca_status text,  -- 'compareceu' | 'faltou' | 'desmarcou'
  p_motivo text            -- Opcional
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_user_id uuid;
begin
  -- Busca agendamento e valida
  select cliente_id, user_id into v_cliente_id, v_user_id
  from public.agendamentos
  where id = p_agendamento_id;

  if v_cliente_id is null then
    raise exception 'Agendamento não encontrado.'
      using errcode = 'P0001';
  end if;

  if p_presenca_status not in ('compareceu', 'faltou', 'desmarcou') then
    raise exception 'Status de presença inválido.'
      using errcode = 'P0001';
  end if;

  -- Atualiza agendamento
  update public.agendamentos
  set
    presenca_status = p_presenca_status,
    falta_motivo = p_motivo,
    falta_registrada_em = timezone('utc'::text, now())
  where id = p_agendamento_id;

  return json_build_object(
    'agendamentoId', p_agendamento_id,
    'presencaStatus', p_presenca_status,
    'registradaEm', timezone('utc'::text, now())
  );
end;
$$;

-- =================================================================
-- RPC: Busca histórico de presença de um paciente
-- =================================================================
create or replace function public.get_attendance_history(
  p_cliente_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_agg(
    json_build_object(
      'agendamentoId',    a.id,
      'data',             a.data,
      'horaInicio',       to_char(a.hora_inicio, 'HH24:MI'),
      'profissional',     a.profissional,
      'procedimento',     a.procedimento,
      'presencaStatus',   a.presenca_status,
      'faltaMotivo',      a.falta_motivo,
      'faltaRegistradaEm', a.falta_registrada_em
    ) order by a.data desc
  ) into v_result
  from public.agendamentos a
  where a.cliente_id = p_cliente_id
    and a.user_id = p_user_id
  limit 100;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- =================================================================
-- RPC: Calcula score de risco de falta para um paciente
-- Retorna número de faltas nos últimos 60 dias
-- =================================================================
create or replace function public.get_no_show_count_60days(
  p_cliente_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_total integer;
begin
  select count(*) filter (where presenca_status = 'faltou')
  into v_count
  from public.agendamentos
  where cliente_id = p_cliente_id
    and user_id = p_user_id
    and data >= current_date - interval '60 days'
    and data <= current_date;

  select count(*)
  into v_total
  from public.agendamentos
  where cliente_id = p_cliente_id
    and user_id = p_user_id
    and data >= current_date - interval '60 days'
    and data <= current_date
    and presenca_status in ('compareceu', 'faltou');

  return json_build_object(
    'faltasUltimos60dias', v_count,
    'totalComparecimentos', coalesce(v_total, 0),
    'temRisco', v_count >= 2
  );
end;
$$;

-- =================================================================
-- RPC: Gera relatório de faltas por período
-- =================================================================
create or replace function public.get_no_show_report(
  p_user_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
  v_total_faltas integer;
  v_total_agendamentos integer;
  v_taxa_faltas numeric;
begin
  select count(*) filter (where presenca_status = 'faltou')
  into v_total_faltas
  from public.agendamentos
  where user_id = p_user_id
    and data >= p_data_inicio
    and data <= p_data_fim
    and presenca_status in ('compareceu', 'faltou');

  select count(*)
  into v_total_agendamentos
  from public.agendamentos
  where user_id = p_user_id
    and data >= p_data_inicio
    and data <= p_data_fim
    and presenca_status in ('compareceu', 'faltou');

  if v_total_agendamentos > 0 then
    v_taxa_faltas := (v_total_faltas::numeric / v_total_agendamentos::numeric) * 100;
  else
    v_taxa_faltas := 0;
  end if;

  select json_build_object(
    'totalFaltas',           v_total_faltas,
    'totalAgendamentos',     v_total_agendamentos,
    'taxaFaltas',            round(v_taxa_faltas, 2),
    'faltasPorProfissional', (
      select json_object_agg(profissional, falta_count)
      from (
        select profissional, count(*) filter (where presenca_status = 'faltou') as falta_count
        from public.agendamentos
        where user_id = p_user_id
          and data >= p_data_inicio
          and data <= p_data_fim
          and presenca_status in ('compareceu', 'faltou')
        group by profissional
      ) as by_prof
    ),
    'faltasPorProcedimento', (
      select json_object_agg(procedimento, falta_count)
      from (
        select procedimento, count(*) filter (where presenca_status = 'faltou') as falta_count
        from public.agendamentos
        where user_id = p_user_id
          and data >= p_data_inicio
          and data <= p_data_fim
          and presenca_status in ('compareceu', 'faltou')
        group by procedimento
      ) as by_proc
    )
  ) into v_result;

  return v_result;
end;
$$;
