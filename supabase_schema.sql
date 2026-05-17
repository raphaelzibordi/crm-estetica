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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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
-- 6. Trigger: sincronia automática auth.users -> public.usuarios
-- Sem este trigger, o cadastro com confirmação de e-mail falha porque
-- o insert direto do front esbarra na RLS (auth.uid() = id só vale
-- DEPOIS que o usuário confirma o e-mail e faz o primeiro login).
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
-- 7. Backfill: cria perfis para usuários auth que ainda não têm
-- registro em public.usuarios (cobre quem se cadastrou antes do trigger)
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
