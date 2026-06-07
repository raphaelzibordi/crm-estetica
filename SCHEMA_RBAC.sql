-- ───────────────────────────────────────────────────────────────────────────
-- RBAC: Perfis de Acesso por Cargo
-- Tabela: perfis_acesso — armazena perfis customizáveis com permissões JSONB
-- Coluna: equipe.perfil_id — vincula cada membro ao seu perfil
-- ───────────────────────────────────────────────────────────────────────────

-- 1. Tabela de perfis de acesso
create table if not exists public.perfis_acesso (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.usuarios(id) on delete cascade,
  nome       text        not null,
  permissoes jsonb       not null default '{}',
  is_default boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_perfis_acesso_user on public.perfis_acesso(user_id);

-- 2. RLS
alter table public.perfis_acesso enable row level security;

drop policy if exists "perfis_acesso_all" on public.perfis_acesso;
create policy "perfis_acesso_all" on public.perfis_acesso
  for all
  using  (user_id = public.get_tenant_id())
  with check (user_id = public.get_tenant_id());

-- 3. Vínculo: cada membro da equipe pode ter um perfil de acesso
alter table public.equipe
  add column if not exists perfil_id uuid references public.perfis_acesso(id) on delete set null;
