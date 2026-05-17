-- Supabase Schema for Lumina CRM
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Table: usuarios (Profiles/Tenants)
create table public.usuarios (
  id uuid references auth.users not null primary key,
  nome_clinica text,
  telefone text,
  endereco text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS
alter table public.usuarios enable row level security;

-- Policy: Users can only see and update their own profile
create policy "Users can view own profile" on public.usuarios for select using (auth.uid() = id);
create policy "Users can update own profile" on public.usuarios for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.usuarios for insert with check (auth.uid() = id);

-- 2. Table: clientes
create table public.clientes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) not null,
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
create policy "Users can manage their own clients" on public.clientes for all using (auth.uid() = user_id);

-- 3. Table: agendamentos
create table public.agendamentos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) not null,
  cliente_id uuid references public.clientes(id) not null,
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
create policy "Users can manage their own appointments" on public.agendamentos for all using (auth.uid() = user_id);

-- 4. Table: prontuarios_evolucoes
create table public.prontuarios_evolucoes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) not null,
  cliente_id uuid references public.clientes(id) not null,
  data date not null,
  profissional text,
  procedimento text,
  relato_natural text,
  observacoes_tecnicas text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.prontuarios_evolucoes enable row level security;
create policy "Users can manage their own evolutions" on public.prontuarios_evolucoes for all using (auth.uid() = user_id);

-- 5. Table: estoque
create table public.estoque (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) not null,
  produto text not null,
  quantidade integer not null default 0,
  quantidade_minima integer not null default 0,
  unidade text,
  status text,
  ultima_reposicao date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.estoque enable row level security;
create policy "Users can manage their own stock" on public.estoque for all using (auth.uid() = user_id);

-- To sync auth.users with public.usuarios automatically (Optional but recommended)
-- create function public.handle_new_user()
-- returns trigger as $$
-- begin
--   insert into public.usuarios (id, email, nome_clinica, telefone, endereco)
--   values (new.id, new.email, new.raw_user_meta_data->>'nome_clinica', new.raw_user_meta_data->>'telefone', new.raw_user_meta_data->>'endereco');
--   return new;
-- end;
-- $$ language plpgsql security definer;
-- 
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();
