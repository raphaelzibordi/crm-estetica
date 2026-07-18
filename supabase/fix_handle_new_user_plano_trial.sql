-- ============================================================
-- MIGRATION: Honrar o plano escolhido no cadastro e marcar o trial
-- Execute este script no SQL Editor do Supabase
-- Data: 2026-07-18
--
-- Contexto: quando a confirmação de e-mail está ativa no projeto Supabase,
-- supabase.auth.signUp() não retorna session, então o trecho de Auth.tsx
-- que dispara o checkout (clinic-billing/start-checkout) nunca executa.
-- O trigger handle_new_user() cria a linha em usuarios só com os defaults
-- da tabela (plano='basico', abacatepay_subscription_status=null), então:
--   1. O dono fica preso no plano Básico mesmo tendo escolhido Pro/Enterprise
--      no cadastro, contrariando "30 dias grátis, independente do plano
--      escolhido".
--   2. Como abacatepay_subscription_status fica NULL (não 'pending'), a
--      lógica de expiração de trial em App.tsx (status === 'pending' e
--      dias >= 30) nunca dispara — o trial nunca expira nem pede pagamento.
-- Esta migração faz o trigger ler plano/periodicidade do metadata do auth
-- (gravado pelo signUp mesmo sem confirmação de e-mail) e marcar o status
-- inicial como 'pending', para que o trial de fato funcione.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner_id  uuid;
begin
  select user_id into v_owner_id
  from public.equipe
  where lower(email) = lower(new.email) and ativo = true and user_id != new.id
  limit 1;

  if v_owner_id is not null then
    insert into public.usuarios (id, email, role, owner_id)
    values (new.id, new.email, 'equipe', v_owner_id)
    on conflict (id) do nothing;
  else
    insert into public.usuarios (
      id, email, nome_clinica, telefone, endereco, role,
      plano, plano_periodicidade, abacatepay_subscription_status
    )
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'nome_clinica', ''),
      coalesce(new.raw_user_meta_data->>'telefone', ''),
      coalesce(new.raw_user_meta_data->>'endereco', ''),
      'dono',
      coalesce(new.raw_user_meta_data->>'plano', 'basico'),
      coalesce(new.raw_user_meta_data->>'periodicidade', 'mensal'),
      'pending'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
