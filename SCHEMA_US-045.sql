-- ============================================================
-- US-045 · E8 — Alertas automáticos de estoque mínimo
-- Aplicar no Supabase SQL Editor
-- ============================================================
-- Nenhuma tabela nova necessária: os alertas in-app são derivados
-- do campo `status` já existente na tabela `estoque`.
-- O controle de frequência de envio de e-mail é feito via
-- localStorage no cliente (chave: estoque_alerta_<userId>_<produtoId>).
--
-- Para ativar o envio de e-mail, configure no painel Supabase:
--   Dashboard → Edge Functions → notify-estoque-critico → Secrets
--     RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxx
--     FROM_EMAIL     = alertas@suaclinica.com.br  (opcional)
-- ============================================================

-- Índice de performance para busca de itens críticos por usuário
CREATE INDEX IF NOT EXISTS estoque_status_user_idx ON estoque (user_id, status);
