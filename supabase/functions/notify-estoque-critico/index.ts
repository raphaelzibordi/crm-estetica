import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function escapeHtml(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

interface ProdutoCritico {
  id: string;
  produto: string;
  quantidade: number;
  quantidadeMinima: number;
  unidade: string;
}

interface ProdutoVencendo {
  id: string;
  produto: string;
  validade: string;
  diasRestantes: number;
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = corsHeadersFor(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { criticos, vencendoBreve } = await req.json() as {
      criticos: ProdutoCritico[];
      vencendoBreve: ProdutoVencendo[];
    };

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('[notify-estoque-critico] RESEND_API_KEY não configurada — e-mail não enviado.');
      return new Response(JSON.stringify({ success: true, sent: false, reason: 'email_not_configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve e-mail do usuário autenticado
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user?.email) {
      return new Response(JSON.stringify({ success: false, reason: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'alertas@lumia.app';
    const toEmail = user.email;
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const criticoRows = criticos.map(p =>
      `<tr style="border-bottom:1px solid #fee2e2">
        <td style="padding:10px 14px;font-weight:600;color:#111">${escapeHtml(p.produto)}</td>
        <td style="padding:10px 14px;color:#dc2626;font-weight:700">${escapeHtml(p.quantidade)} ${escapeHtml(p.unidade)}</td>
        <td style="padding:10px 14px;color:#6b7280">${escapeHtml(p.quantidadeMinima)} ${escapeHtml(p.unidade)}</td>
      </tr>`
    ).join('');

    const vencendoRows = vencendoBreve.map(p =>
      `<tr style="border-bottom:1px solid #fef3c7">
        <td style="padding:10px 14px;font-weight:600;color:#111">${escapeHtml(p.produto)}</td>
        <td style="padding:10px 14px;color:#b45309;font-weight:700">${escapeHtml(p.diasRestantes)} dia(s)</td>
        <td style="padding:10px 14px;color:#6b7280">${escapeHtml(new Date(p.validade + 'T00:00:00').toLocaleDateString('pt-BR'))}</td>
      </tr>`
    ).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#f8f8f6;margin:0;padding:0">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#c4562f;padding:24px 32px">
      <h1 style="color:#fff;font-size:20px;margin:0">⚠️ Alerta de Estoque — Lumia CRM</h1>
      <p style="color:#fde8dc;font-size:13px;margin:6px 0 0">${now}</p>
    </div>
    <div style="padding:28px 32px">
      ${criticos.length > 0 ? `
      <h2 style="font-size:15px;color:#dc2626;margin:0 0 12px">Insumos abaixo do estoque mínimo</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px">
        <thead>
          <tr style="background:#fef2f2;color:#6b7280;font-size:11px;text-transform:uppercase">
            <th style="padding:8px 14px;text-align:left">Insumo</th>
            <th style="padding:8px 14px;text-align:left">Qtd Atual</th>
            <th style="padding:8px 14px;text-align:left">Qtd Mínima</th>
          </tr>
        </thead>
        <tbody>${criticoRows}</tbody>
      </table>` : ''}
      ${vencendoBreve.length > 0 ? `
      <h2 style="font-size:15px;color:#b45309;margin:0 0 12px">Validades próximas (≤ 30 dias)</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px">
        <thead>
          <tr style="background:#fffbeb;color:#6b7280;font-size:11px;text-transform:uppercase">
            <th style="padding:8px 14px;text-align:left">Insumo</th>
            <th style="padding:8px 14px;text-align:left">Dias Restantes</th>
            <th style="padding:8px 14px;text-align:left">Data Validade</th>
          </tr>
        </thead>
        <tbody>${vencendoRows}</tbody>
      </table>` : ''}
      <p style="font-size:13px;color:#6b7280;margin:0">
        Acesse o Lumia CRM → Gestão → Estoque para repor os insumos.
      </p>
    </div>
    <div style="background:#f3f4f6;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center">
      Lumia CRM — alerta automático gerado pelo sistema
    </div>
  </div>
</body>
</html>`;

    const subject = criticos.length > 0
      ? `⚠️ ${criticos.length} insumo(s) abaixo do mínimo — Lumia CRM`
      : `⏰ ${vencendoBreve.length} insumo(s) com validade próxima — Lumia CRM`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[notify-estoque-critico] Resend error:', err);
      return new Response(JSON.stringify({ success: false, reason: err }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, sent: true, to: toEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return new Response(JSON.stringify({ success: false, reason: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
