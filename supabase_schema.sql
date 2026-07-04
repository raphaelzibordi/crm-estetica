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

-- Coluna procedimentos (multi-procedimento por agendamento) adicionada em versões posteriores; garantir idempotência
alter table public.agendamentos add column if not exists procedimentos jsonb default '[]'::jsonb;

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
-- 8b. Table: equipe (membros profissionais da clínica)
-- Cada usuário (tenant) é dono do conjunto de membros que cadastrou.
-- O dono/responsável pela clínica vive em `usuarios` e NÃO é replicado aqui;
-- a tela de acolhimento o adiciona logicamente à lista de profissionais.
-- =================================================================
create table if not exists public.equipe (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.usuarios(id) on delete cascade not null,
  nome text not null,
  email text,
  cargo text,
  foto_url text,
  ativo boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.equipe enable row level security;

drop policy if exists "Users can manage their own team" on public.equipe;
create policy "Users can manage their own team"
  on public.equipe for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_equipe_user        on public.equipe(user_id);
create index if not exists idx_equipe_user_ativo  on public.equipe(user_id, ativo);

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

-- =================================================================
-- 13. Novos campos em usuarios: perfil pessoal + controle de acesso
-- =================================================================
alter table public.usuarios
  add column if not exists nome             text,
  add column if not exists telefone_pessoal text,
  add column if not exists data_nascimento  date,
  add column if not exists foto_url         text,
  add column if not exists role             text not null default 'dono',
  add column if not exists owner_id         uuid references public.usuarios(id);

-- Garante que donos existentes mantenham role = 'dono'
update public.usuarios set role = 'dono' where role is null or role = '';

-- =================================================================
-- 14. Trigger atualizado: detecta se o novo usuário é membro de equipe
--     pelo e-mail cadastrado na tabela equipe (pelo dono).
--     Se sim  → role='equipe' + owner_id do dono.
--     Se não  → role='dono' (cadastro normal de clínica).
-- =================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id  uuid;
begin
  -- Verifica se o e-mail pertence a um membro pré-cadastrado pelo dono.
  -- Exclui casos onde o dono adicionou a si mesmo à equipe.
  select user_id into v_owner_id
  from public.equipe
  where lower(email) = lower(new.email) and ativo = true and user_id != new.id
  limit 1;

  if v_owner_id is not null then
    -- Membro da equipe: cria perfil vinculado ao dono.
    insert into public.usuarios (id, email, role, owner_id)
    values (new.id, new.email, 'equipe', v_owner_id)
    on conflict (id) do nothing;
  else
    -- Dono de clínica: cria perfil com dados da clínica.
    insert into public.usuarios (id, email, nome_clinica, telefone, endereco, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'nome_clinica', ''),
      coalesce(new.raw_user_meta_data->>'telefone', ''),
      coalesce(new.raw_user_meta_data->>'endereco', ''),
      'dono'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_usuario_seed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Somente o dono da clínica recebe dados iniciais de seed.
  if new.role = 'dono' then
    perform public.seed_default_data(new.id);
  end if;
  return new;
end;
$$;

-- =================================================================
-- 15. Função auxiliar: resolve o tenant efetivo para membros da equipe.
--     Membros da equipe operam sobre os dados do seu dono (owner_id).
-- =================================================================
create or replace function public.get_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.usuarios
      where id = auth.uid() and role = 'equipe'),
    auth.uid()
  );
$$;

-- =================================================================
-- 16. Políticas RLS atualizadas: donos acessam seus dados, membros
--     da equipe acessam os dados do dono via get_tenant_id().
-- =================================================================

-- usuarios: dono vê/altera o próprio perfil; membro vê também o perfil do dono
drop policy if exists "Users can view own profile"   on public.usuarios;
drop policy if exists "Users can update own profile" on public.usuarios;
drop policy if exists "Users can insert own profile" on public.usuarios;
drop policy if exists "usuarios_select"              on public.usuarios;
drop policy if exists "usuarios_update"              on public.usuarios;
drop policy if exists "usuarios_insert"              on public.usuarios;

create policy "usuarios_select" on public.usuarios for select
  using (id = public.get_tenant_id());
create policy "usuarios_update" on public.usuarios for update
  using (id = auth.uid());
create policy "usuarios_insert" on public.usuarios for insert
  with check (id = auth.uid());

-- clientes
drop policy if exists "Users can manage their own clients" on public.clientes;
drop policy if exists "clientes_all"                       on public.clientes;
create policy "clientes_all" on public.clientes for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- agendamentos
drop policy if exists "Users can manage their own appointments" on public.agendamentos;
drop policy if exists "agendamentos_all"                        on public.agendamentos;
create policy "agendamentos_all" on public.agendamentos for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- prontuarios_evolucoes
drop policy if exists "Users can manage their own evolutions" on public.prontuarios_evolucoes;
drop policy if exists "evolucoes_all"                         on public.prontuarios_evolucoes;
create policy "evolucoes_all" on public.prontuarios_evolucoes for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- estoque
drop policy if exists "Users can manage their own stock" on public.estoque;
drop policy if exists "estoque_all"                      on public.estoque;
create policy "estoque_all" on public.estoque for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- procedimentos
drop policy if exists "Users can manage their own procedures" on public.procedimentos;
drop policy if exists "procedimentos_all"                     on public.procedimentos;
create policy "procedimentos_all" on public.procedimentos for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- templates_mensagens
drop policy if exists "Users can manage their own templates" on public.templates_mensagens;
drop policy if exists "templates_all"                        on public.templates_mensagens;
create policy "templates_all" on public.templates_mensagens for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- galeria_antes_depois
drop policy if exists "Users can manage their own gallery" on public.galeria_antes_depois;
drop policy if exists "galeria_all"                        on public.galeria_antes_depois;
create policy "galeria_all" on public.galeria_antes_depois for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- equipe
drop policy if exists "Users can manage their own team" on public.equipe;
drop policy if exists "equipe_all"                      on public.equipe;
create policy "equipe_all" on public.equipe for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- =================================================================
-- 17. Função pública: verifica se um e-mail está pré-cadastrado em
--     alguma equipe. Usada pela tela de login para dar mensagem de
--     erro inteligente antes mesmo de o usuário criar a conta.
--     SECURITY DEFINER + grant anon = pode ser chamada sem sessão.
-- =================================================================
create or replace function public.is_equipe_email(lookup_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.equipe
    where lower(email) = lower(lookup_email)
      and ativo = true
  );
$$;

-- Permite chamar a função sem autenticação (anon key)
grant execute on function public.is_equipe_email(text) to anon;
grant execute on function public.is_equipe_email(text) to authenticated;

-- =================================================================
-- 19. Função de auto-recuperação: resolve o owner correto do usuário
--     autenticado consultando auth.users + equipe sem restrições de RLS.
--     Se o registro em usuarios estiver errado (role='dono' para um
--     membro de equipe), ela o corrige in-place e retorna o owner_id.
--     Garante que falhas anteriores do trigger sejam sanadas na primeira
--     chamada bem-sucedida de getUserProfile().
-- =================================================================
create or replace function public.resolve_equipe_owner()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_owner  uuid;
begin
  if v_uid is null then return null; end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then return null; end if;

  select user_id into v_owner
  from public.equipe
  where lower(email) = lower(v_email) and ativo = true and user_id != v_uid
  limit 1;

  -- Se encontrado, corrige o perfil automaticamente
  if v_owner is not null then
    update public.usuarios
    set role = 'equipe', owner_id = v_owner
    where id = v_uid
      and (role is null or role != 'equipe' or owner_id is null);
  end if;

  return v_owner;
end;
$$;

grant execute on function public.resolve_equipe_owner() to authenticated;

-- =================================================================
-- 20. Reparo de membros de equipe já cadastrados que ficaram com
--     role='dono' por causa do trigger antigo (seção 9).
--     Idempotente: ignora quem já está correto.
-- =================================================================
do $$
declare
  rec      record;
  v_owner  uuid;
begin
  for rec in
    select u.id, au.email
    from   public.usuarios u
    join   auth.users au on au.id = u.id
    where  u.role is null or u.role = 'dono'
  loop
    select e.user_id into v_owner
    from   public.equipe e
    where  lower(e.email) = lower(rec.email) and e.ativo = true
    limit  1;

    if v_owner is not null then
      update public.usuarios
      set    role = 'equipe', owner_id = v_owner
      where  id = rec.id;
    end if;
  end loop;
end $$;

-- =================================================================
-- 21. Storage bucket para fotos de perfil (execute uma vez no painel
--     Supabase: Storage → New bucket → "avatars" → Public = true).
--     O SQL abaixo cria o bucket e as políticas de acesso se o schema
--     storage estiver disponível neste contexto.
-- =================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar upload by owner"   on storage.objects;
drop policy if exists "Avatar update by owner"   on storage.objects;
drop policy if exists "Avatar delete by owner"   on storage.objects;
drop policy if exists "Avatar public read"       on storage.objects;
drop policy if exists "avatar_upload"            on storage.objects;
drop policy if exists "avatar_read"              on storage.objects;

-- INSERT: primeira vez que o arquivo é enviado
create policy "Avatar upload by owner" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- UPDATE: quando o arquivo já existe e está sendo substituído (upsert)
create policy "Avatar update by owner" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  ) with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- DELETE: necessário para upsert que remove antes de reinserir
create policy "Avatar delete by owner" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- SELECT: leitura pública (bucket já é public, mas a policy garante)
create policy "Avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- =================================================================
-- US-007: Agendamento Online com Link Público
-- =================================================================

-- Campos de booking online na tabela usuarios
alter table public.usuarios
  add column if not exists booking_slug               text unique,
  add column if not exists booking_enabled            boolean not null default false,
  add column if not exists booking_min_advance_horas  integer not null default 1,
  add column if not exists booking_max_advance_dias   integer not null default 30;

-- Marca agendamentos criados pelo fluxo público
alter table public.agendamentos
  add column if not exists origem_online boolean not null default false;

-- Visibilidade dos procedimentos no link público
alter table public.procedimentos
  add column if not exists booking_visivel boolean not null default true;

-- Visibilidade dos membros de equipe no link público
alter table public.equipe
  add column if not exists booking_visivel boolean not null default true;

-- Índice para lookup rápido por slug
create unique index if not exists idx_usuarios_booking_slug
  on public.usuarios(booking_slug)
  where booking_slug is not null;

-- Habilitar realtime na tabela agendamentos para notificações in-app
alter publication supabase_realtime add table public.agendamentos;

-- =================================================================
-- RPC: Busca clínica pelo slug (acesso público, sem autenticação)
-- =================================================================
create or replace function public.get_clinic_by_slug(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'userId',          u.id,
    'nomeClinica',     coalesce(u.nome_clinica, ''),
    'minAdvanceHoras', u.booking_min_advance_horas,
    'maxAdvanceDias',  u.booking_max_advance_dias
  ) into v_result
  from public.usuarios u
  where u.booking_slug = p_slug
    and u.booking_enabled = true;
  return v_result;
end;
$$;

-- =================================================================
-- RPC: Lista profissionais visíveis para booking público
-- =================================================================
create or replace function public.get_public_professionals(p_user_id uuid)
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
      'id',    e.id,
      'nome',  e.nome,
      'cargo', coalesce(e.cargo, '')
    ) order by e.nome
  ) into v_result
  from public.equipe e
  where e.user_id        = p_user_id
    and e.ativo          = true
    and e.booking_visivel = true;
  return coalesce(v_result, '[]'::json);
end;
$$;

-- =================================================================
-- RPC: Lista procedimentos visíveis para booking público
-- =================================================================
create or replace function public.get_public_procedures(p_user_id uuid)
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
      'id',                      p.id,
      'nome',                    p.nome,
      'duracaoMinutos',          p.duracao_minutos,
      'preco',                   p.preco,
      'salaRequerida',           coalesce(p.sala_requerida, ''),
      'profissionalResponsavel', coalesce(p.profissional_responsavel, '')
    ) order by p.nome
  ) into v_result
  from public.procedimentos p
  where p.user_id          = p_user_id
    and p.booking_visivel   = true;
  return coalesce(v_result, '[]'::json);
end;
$$;

-- =================================================================
-- RPC: Retorna horários ocupados de um profissional em uma data
--      (sem dados de paciente — apenas intervalos de tempo)
-- =================================================================
create or replace function public.get_booked_slots(
  p_user_id      uuid,
  p_date         date,
  p_profissional text
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
      'horaInicio', to_char(a.hora_inicio, 'HH24:MI'),
      'horaFim',    to_char(a.hora_fim,    'HH24:MI')
    )
  ) into v_result
  from public.agendamentos a
  where a.user_id      = p_user_id
    and a.data         = p_date
    and a.profissional = p_profissional
    and a.status       <> 'finalizada';
  return coalesce(v_result, '[]'::json);
end;
$$;

-- =================================================================
-- RPC: Cria agendamento pelo fluxo público (atômico + anti-race-condition)
-- =================================================================
create or replace function public.create_public_booking(
  p_clinic_slug        text,
  p_profissional       text,
  p_procedimento       text,
  p_data               date,
  p_hora_inicio        time,
  p_hora_fim           time,
  p_sala               text,
  p_valor              numeric,
  p_paciente_nome      text,
  p_paciente_telefone  text,
  p_paciente_email     text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_cliente_id   uuid;
  v_ag_id        uuid;
  v_conflict     boolean := false;
begin
  -- Busca clínica e valida que booking está ativo
  select u.id into v_user_id
  from public.usuarios u
  where u.booking_slug   = p_clinic_slug
    and u.booking_enabled = true;

  if v_user_id is null then
    raise exception 'Clínica não encontrada ou agendamento online desativado.'
      using errcode = 'P0001';
  end if;

  -- Lock advisory por profissional+data para serializar concorrência
  perform pg_advisory_xact_lock(
    ('x' || substr(md5(v_user_id::text || p_data::text || p_profissional), 1, 16))::bit(64)::bigint
  );

  -- Verifica conflito de horário
  select exists(
    select 1 from public.agendamentos a
    where a.user_id      = v_user_id
      and a.data         = p_data
      and a.profissional = p_profissional
      and a.status       <> 'finalizada'
      and a.hora_inicio  < p_hora_fim
      and a.hora_fim     > p_hora_inicio
  ) into v_conflict;

  if v_conflict then
    raise exception 'SLOT_UNAVAILABLE: Este horário já foi reservado. Escolha outro.'
      using errcode = 'P0002';
  end if;

  -- Encontra ou cria paciente pelo telefone
  select id into v_cliente_id
  from public.clientes
  where user_id  = v_user_id
    and telefone = p_paciente_telefone
  limit 1;

  if v_cliente_id is null then
    insert into public.clientes (user_id, nome, telefone, email, status_retencao, tags)
    values (v_user_id, p_paciente_nome, p_paciente_telefone, p_paciente_email, 'em_dia', '{}')
    returning id into v_cliente_id;
  end if;

  -- Cria o agendamento com flag origem_online
  insert into public.agendamentos (
    user_id, cliente_id, data, hora_inicio, hora_fim,
    profissional, sala, procedimento, status, valor, origem_online
  )
  values (
    v_user_id, v_cliente_id, p_data, p_hora_inicio, p_hora_fim,
    p_profissional, p_sala, p_procedimento, 'agendada', p_valor, true
  )
  returning id into v_ag_id;

  return json_build_object(
    'id',      v_ag_id,
    'status',  'agendada'
  );
end;
$$;

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
-- Retorna true se sucesso, false se erro
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
-- Usada por job/function para enviar lembretes automáticos
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

-- Índice para buscar faltas recentes de um paciente (para badge de risco)
create index if not exists idx_agendamentos_falta_60dias
  on public.agendamentos(cliente_id, data)
  where presenca_status = 'faltou' and data >= current_date - interval '60 days';

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
