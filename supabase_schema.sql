-- =================================================================
-- Supabase Schema for Lumina CRM (IDEMPOTENTE — pode rodar várias vezes)
-- =================================================================
create extension if not exists "uuid-ossp";

-- =================================================================
-- 1. Table: usuarios (Profiles/Tenants)
-- =================================================================
create table if not exists public.usuarios (
  id uuid references auth.users not null primary key,
  nome_clinica text,
  telefone text,
  endereco text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.usuarios enable row level security;

drop policy if exists "Users can view own profile" on public.usuarios;
drop policy if exists "Users can update own profile" on public.usuarios;
drop policy if exists "Users can insert own profile" on public.usuarios;

create policy "Users can view own profile"   on public.usuarios for select using (auth.uid() = id);
create policy "Users can update own profile" on public.usuarios for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.usuarios for insert with check (auth.uid() = id);

-- =================================================================
-- 2. Table: clientes
-- =================================================================
create table if not exists public.clientes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  nome text not null,
  telefone text,
  email text,
  data_nascimento date,
  foto_url text,
  data_ultima_visita date,
  status_retencao text,
  tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.clientes enable row level security;

drop policy if exists "Users can manage their own clients" on public.clientes;
create policy "Users can manage their own clients"
  on public.clientes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_clientes_user_id on public.clientes(user_id);
create index if not exists idx_clientes_nome    on public.clientes(nome);

-- =================================================================
-- 3. Table: agendamentos
-- =================================================================
create table if not exists public.agendamentos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  profissional text,
  sala text,
  procedimento text,
  status text,
  tempo_espera_minutos integer,
  horario_chegada time,
  valor numeric,
  metodo_pagamento text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Coluna metodo_pagamento adicionada em versões posteriores; garantir idempotência
alter table public.agendamentos add column if not exists metodo_pagamento text;

alter table public.agendamentos enable row level security;

drop policy if exists "Users can manage their own appointments" on public.agendamentos;
create policy "Users can manage their own appointments"
  on public.agendamentos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_agendamentos_user_data on public.agendamentos(user_id, data);
create index if not exists idx_agendamentos_cliente   on public.agendamentos(cliente_id);

-- =================================================================
-- 4. Table: prontuarios_evolucoes
-- =================================================================
create table if not exists public.prontuarios_evolucoes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  data date not null,
  profissional text,
  procedimento text,
  relato_natural text,
  observacoes_tecnicas text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.prontuarios_evolucoes enable row level security;

drop policy if exists "Users can manage their own evolutions" on public.prontuarios_evolucoes;
create policy "Users can manage their own evolutions"
  on public.prontuarios_evolucoes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_evolucoes_cliente on public.prontuarios_evolucoes(cliente_id);

-- =================================================================
-- 5. Table: estoque
-- =================================================================
create table if not exists public.estoque (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  produto text not null,
  quantidade integer not null default 0,
  quantidade_minima integer not null default 0,
  unidade text,
  status text,
  ultima_reposicao date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.estoque enable row level security;

drop policy if exists "Users can manage their own stock" on public.estoque;
create policy "Users can manage their own stock"
  on public.estoque for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_estoque_user on public.estoque(user_id);

-- =================================================================
-- 6. Table: procedimentos (catálogo de procedimentos da clínica)
-- =================================================================
create table if not exists public.procedimentos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  nome text not null,
  duracao_minutos integer not null default 60,
  validade_dias integer not null default 120,
  preco numeric not null default 0,
  sala_requerida text,
  profissional_responsavel text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.procedimentos enable row level security;

drop policy if exists "Users can manage their own procedures" on public.procedimentos;
create policy "Users can manage their own procedures"
  on public.procedimentos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_procedimentos_user on public.procedimentos(user_id);

-- =================================================================
-- 7. Table: templates_mensagens (modelos de comunicação)
-- =================================================================
create table if not exists public.templates_mensagens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  titulo text not null,
  gatilho text,
  texto text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.templates_mensagens enable row level security;

drop policy if exists "Users can manage their own templates" on public.templates_mensagens;
create policy "Users can manage their own templates"
  on public.templates_mensagens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_templates_user on public.templates_mensagens(user_id);

-- =================================================================
-- 8. Table: galeria_antes_depois (fotos de evolução por cliente)
-- =================================================================
create table if not exists public.galeria_antes_depois (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  imagem text not null,
  data date not null,
  descricao text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.galeria_antes_depois enable row level security;

drop policy if exists "Users can manage their own gallery" on public.galeria_antes_depois;
create policy "Users can manage their own gallery"
  on public.galeria_antes_depois for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_galeria_cliente on public.galeria_antes_depois(cliente_id);

-- =================================================================
-- 9. Trigger: sincronia automática auth.users -> public.usuarios
-- E criação dos dados padrão (procedimentos + templates) na primeira
-- vez que um usuário aparece em public.usuarios.
-- =================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email, nome_clinica, telefone, endereco)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome_clinica', ''),
    coalesce(new.raw_user_meta_data->>'telefone', ''),
    coalesce(new.raw_user_meta_data->>'endereco', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =================================================================
-- 10. Função: seed_default_data(uid)
-- Popula procedimentos e templates padrão para um novo usuário.
-- É idempotente: só insere se ainda não existir nenhum registro.
-- =================================================================
create or replace function public.seed_default_data(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proc_count integer;
  tpl_count integer;
begin
  select count(*) into proc_count from public.procedimentos where user_id = uid;
  if proc_count = 0 then
    insert into public.procedimentos (user_id, nome, duracao_minutos, validade_dias, preco, sala_requerida, profissional_responsavel) values
      (uid, 'Toxina Botulínica (Botox)', 45, 120, 1200, 'Cabine 01 - Clínica', 'Dra. Helena Martins'),
      (uid, 'Lavieen (Pele de Porcelana)', 60, 90, 800, 'Cabine 02 - Tecnologias', 'Esteticista Sarah Kelly'),
      (uid, 'Preenchimento com Ácido Hialurônico', 60, 360, 1600, 'Cabine 01 - Clínica', 'Dra. Helena Martins'),
      (uid, 'Bioestimulador de Colágeno (Radiesse)', 75, 360, 2200, 'Cabine 01 - Clínica', 'Dra. Helena Martins'),
      (uid, 'Peeling Químico Renovador', 45, 30, 450, 'Cabine 03 - Facial', 'Esteticista Sarah Kelly');
  end if;

  select count(*) into tpl_count from public.templates_mensagens where user_id = uid;
  if tpl_count = 0 then
    insert into public.templates_mensagens (user_id, titulo, gatilho, texto) values
      (uid, 'Retorno de Toxina Botulínica (120 dias)', 'Vencimento do efeito do procedimento',
       'Olá, {nome}. Como você está? ✨ Há cerca de 4 meses cuidamos do seu rosto com a Toxina Botulínica. O efeito protetor da musculatura costuma atenuar por agora. O que acha de reservarmos um momento esta semana para uma avaliação e mantermos sua expressão sempre descansada e rejuvenescida?'),
      (uid, 'Boas-vindas pós-procedimento (24h)', 'Dia seguinte ao tratamento',
       'Olá, {nome}! Passando para saber como está se sentindo após o procedimento de ontem. Lembre-se de seguir as orientações personalizadas que deixamos no seu prontuário e caprichar no filtro solar. Se tiver qualquer dúvida, estamos à inteira disposição. Um abraço carinhoso!'),
      (uid, 'Resgate de Cliente Ausente (60 dias)', 'Mais de 60 dias sem visitas',
       'Olá, {nome}! Sentimos sua falta na clínica nas últimas semanas. 🌸 Preparamos um carinho especial para o seu retorno: uma sessão exclusiva do nosso protocolo Glow Facial como cortesia ao agendar seu próximo cuidado. Qual dia fica melhor para reservarmos sua cabine?');
  end if;
end;
$$;

-- =================================================================
-- 11. Trigger: ao criar um perfil em public.usuarios, semear dados padrão.
-- =================================================================
create or replace function public.handle_new_usuario_seed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_data(new.id);
  return new;
end;
$$;

drop trigger if exists on_usuarios_seed_defaults on public.usuarios;
create trigger on_usuarios_seed_defaults
  after insert on public.usuarios
  for each row execute procedure public.handle_new_usuario_seed();

-- =================================================================
-- 12. Backfill: cria perfis para usuários auth que ainda não têm
-- registro em public.usuarios + semeia defaults para perfis existentes.
-- =================================================================
insert into public.usuarios (id, email, nome_clinica, telefone, endereco)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'nome_clinica', ''),
  coalesce(u.raw_user_meta_data->>'telefone', ''),
  coalesce(u.raw_user_meta_data->>'endereco', '')
from auth.users u
left join public.usuarios p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Semear defaults em perfis existentes (idempotente)
do $$
declare
  rec record;
begin
  for rec in select id from public.usuarios loop
    perform public.seed_default_data(rec.id);
  end loop;
end $$;
