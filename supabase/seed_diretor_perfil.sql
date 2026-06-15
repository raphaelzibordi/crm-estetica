-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: ao cadastrar novo dono de clínica, criá-lo automaticamente como
-- membro da equipe com perfil "Diretor" (acesso total).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_usuario_seed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil_id uuid;
  v_permissoes_diretor jsonb := '{
    "dashboard":         { "ver": true },
    "agenda":            { "ver": true, "criar": true, "editar": true, "deletar": true },
    "prontuario":        { "ver": true, "criar": true, "editar": true, "deletar": true },
    "crm":               { "ver": true, "criar": true, "editar": true, "deletar": true },
    "orcamentos":        { "ver": true, "criar": true, "editar": true, "deletar": true },
    "crc":               { "ver": true, "criar": true, "editar": true, "deletar": true },
    "whatsapp":          { "ver": true, "criar": true },
    "comunicacao":       { "ver": true, "criar": true, "editar": true, "deletar": true },
    "gestao":            { "ver": true },
    "salas":             { "ver": true, "criar": true, "editar": true, "deletar": true },
    "calendario-salas":  { "ver": true, "criar": true, "editar": true, "deletar": true },
    "lgpd":              { "ver": true }
  }'::jsonb;
begin
  -- Somente o dono da clínica recebe dados iniciais de seed.
  if new.role = 'dono' then
    perform public.seed_default_data(new.id);

    -- Cria o perfil de acesso "Diretor" com permissão total.
    insert into public.perfis_acesso (user_id, nome, permissoes, is_default)
    values (new.id, 'Diretor', v_permissoes_diretor, false)
    returning id into v_perfil_id;

    -- Adiciona o próprio dono como membro da equipe com cargo Diretor.
    insert into public.equipe (user_id, nome, email, cargo, perfil_id, ativo)
    values (
      new.id,
      coalesce(nullif(trim(new.nome), ''), new.nome_clinica, new.email),
      new.email,
      'Diretor',
      v_perfil_id,
      true
    );
  end if;

  return new;
end;
$$;
