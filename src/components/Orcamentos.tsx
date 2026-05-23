import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Printer,
  BarChart3,
  Search,
  X,
  Edit3,
  Bell,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  Orcamento,
  OrcamentoFollowupConfig,
  OrcamentoMotivoPerdaKey,
  OrcamentoRelatorio,
  OrcamentoStatus,
  Procedimento,
  MembroEquipe,
  Cliente,
} from '../types';

// ── Constantes ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrcamentoStatus, string> = {
  aberto:    'Em aberto',
  aprovado:  'Aprovado',
  perdido:   'Perdido',
  expirado:  'Expirado',
};

const STATUS_COLORS: Record<OrcamentoStatus, { bg: string; text: string; border: string }> = {
  aberto:   { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  aprovado: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  perdido:  { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  expirado: { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB' },
};

const MOTIVOS_PERDA: { key: OrcamentoMotivoPerdaKey; label: string }[] = [
  { key: 'preco',          label: 'Preço' },
  { key: 'concorrente',    label: 'Optou por concorrente' },
  { key: 'nao_respondeu',  label: 'Não respondeu' },
  { key: 'outro',          label: 'Outro' },
];

const CANAL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email:    'E-mail',
  ambos:    'WhatsApp + E-mail',
};

// ── Helpers ────────────────────────────────────────────────────────────

function diasAteVencer(validade: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const val  = new Date(validade + 'T00:00:00');
  return Math.ceil((val.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Tipos locais ───────────────────────────────────────────────────────

interface ItemForm {
  id?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  procedimentoId: string | null;
}

interface OrcamentoForm {
  nomeCliente: string;
  telefone: string;
  clienteId: string | null;
  leadId: string | null;
  profissionalId: string | null;
  profissionalNome: string;
  dataEnvio: string;
  validade: string;
  observacoes: string;
  itens: ItemForm[];
}

interface FollowupForm {
  diasAposEnvio: number;
  canal: 'whatsapp' | 'email' | 'ambos';
  mensagemTemplate: string;
}

const EMPTY_FORM: OrcamentoForm = {
  nomeCliente:      '',
  telefone:         '',
  clienteId:        null,
  leadId:           null,
  profissionalId:   null,
  profissionalNome: '',
  dataEnvio:        todayISO(),
  validade:         addDays(todayISO(), 30),
  observacoes:      '',
  itens:            [{ descricao: '', quantidade: 1, valorUnitario: 0, procedimentoId: null }],
};

const EMPTY_FOLLOWUP: FollowupForm = {
  diasAposEnvio:    3,
  canal:            'whatsapp',
  mensagemTemplate: 'Olá, {{nome}}! Gostaria de saber se teve a oportunidade de analisar o orçamento que enviamos para {{procedimentos}}. Ele é válido até {{validade}}. Podemos conversar?',
};

// ── Componente principal ───────────────────────────────────────────────

interface OrcamentosProps {
  userId: string;
  userName: string;
  onConvertidoAgendar?: (nomeCliente: string) => void;
}

type TabId = 'painel' | 'followup' | 'relatorio';

export const Orcamentos: React.FC<OrcamentosProps> = ({ userId, userName, onConvertidoAgendar }) => {
  const [tab, setTab]                               = useState<TabId>('painel');
  const [orcamentos, setOrcamentos]                 = useState<Orcamento[]>([]);
  const [followupConfigs, setFollowupConfigs]       = useState<OrcamentoFollowupConfig[]>([]);
  const [relatorio, setRelatorio]                   = useState<OrcamentoRelatorio | null>(null);
  const [clientes, setClientes]                     = useState<Cliente[]>([]);
  const [equipe, setEquipe]                         = useState<MembroEquipe[]>([]);
  const [procedimentos, setProcedimentos]           = useState<Procedimento[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [saving, setSaving]                         = useState(false);

  const [statusFiltro, setStatusFiltro]             = useState<OrcamentoStatus | 'todos'>('todos');
  const [busca, setBusca]                           = useState('');

  // Modal de novo/editar orçamento
  const [showModal, setShowModal]                   = useState(false);
  const [form, setForm]                             = useState<OrcamentoForm>(EMPTY_FORM);
  const [clienteBusca, setClienteBusca]             = useState('');
  const [clienteSugestoes, setClienteSugestoes]     = useState<Cliente[]>([]);

  // Modal de ação (aprovar / perdido / renovar)
  const [actionTarget, setActionTarget]             = useState<Orcamento | null>(null);
  const [actionType, setActionType]                 = useState<'aprovar' | 'perdido' | 'renovar' | null>(null);
  const [motivoPerda, setMotivoPerda]               = useState<OrcamentoMotivoPerdaKey>('preco');
  const [novaValidade, setNovaValidade]             = useState('');

  // Modal de detalhes / follow-up manual
  // Modal de follow-up config
  const [showFollowupModal, setShowFollowupModal]   = useState(false);
  const [followupForm, setFollowupForm]             = useState<FollowupForm>(EMPTY_FOLLOWUP);
  const [editingFollowupId, setEditingFollowupId]   = useState<string | null>(null);

  // ── Carga de dados ────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orcs, cfgs, clis, eq, procs] = await Promise.all([
        api.getOrcamentos(userId),
        api.getOrcamentoFollowupConfig(userId),
        api.getClientes(userId),
        api.getEquipe(userId),
        api.getProcedimentos(userId),
      ]);
      setOrcamentos(orcs);
      setFollowupConfigs(cfgs);
      setClientes(clis);
      setEquipe(eq);
      setProcedimentos(procs);
    } catch (err) {
      console.error('[Orcamentos] erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadRelatorio = useCallback(async () => {
    try {
      const rel = await api.getOrcamentoRelatorio(userId);
      setRelatorio(rel);
    } catch (err) {
      console.error('[Orcamentos] erro ao carregar relatório:', err);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'relatorio') loadRelatorio();
  }, [tab, loadRelatorio]);

  // ── Filtros ───────────────────────────────────────────────────────

  const orcamentosFiltrados = orcamentos.filter((o) => {
    const matchStatus = statusFiltro === 'todos' || o.status === statusFiltro;
    const matchBusca  = !busca || o.nomeCliente.toLowerCase().includes(busca.toLowerCase());
    return matchStatus && matchBusca;
  });

  // ── Sugestões de clientes ─────────────────────────────────────────

  useEffect(() => {
    if (!clienteBusca.trim()) { setClienteSugestoes([]); return; }
    const q = clienteBusca.toLowerCase();
    setClienteSugestoes(clientes.filter((c) => c.nome.toLowerCase().includes(q)).slice(0, 6));
  }, [clienteBusca, clientes]);

  // ── CRUD Orçamento ────────────────────────────────────────────────

  const handleSaveOrcamento = async () => {
    if (!form.nomeCliente.trim()) { alert('Informe o nome do cliente.'); return; }
    if (!form.validade) { alert('Informe a data de validade.'); return; }
    const itensValidos = form.itens.filter((it) => it.descricao.trim());
    if (itensValidos.length === 0) { alert('Adicione ao menos um item ao orçamento.'); return; }

    setSaving(true);
    try {
      await api.createOrcamento(
        {
          clienteId:        form.clienteId,
          leadId:           form.leadId,
          nomeCliente:      form.nomeCliente,
          telefone:         form.telefone,
          profissionalId:   form.profissionalId,
          profissionalNome: form.profissionalNome || null,
          dataEnvio:        form.dataEnvio,
          validade:         form.validade,
          observacoes:      form.observacoes || null,
          itens:            itensValidos.map((it) => ({
            procedimentoId: it.procedimentoId,
            descricao:      it.descricao,
            quantidade:     it.quantidade,
            valorUnitario:  it.valorUnitario,
          })),
        },
        userId
      );
      setShowModal(false);
      setForm(EMPTY_FORM);
      setClienteBusca('');
      await load();
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao salvar orçamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleAprovar = async () => {
    if (!actionTarget) return;
    setSaving(true);
    try {
      await api.updateOrcamentoStatus(actionTarget.id, 'aprovado', null, userId);
      setActionTarget(null); setActionType(null);
      await load();
      if (onConvertidoAgendar) onConvertidoAgendar(actionTarget.nomeCliente);
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao aprovar orçamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarPerdido = async () => {
    if (!actionTarget) return;
    setSaving(true);
    try {
      await api.updateOrcamentoStatus(actionTarget.id, 'perdido', motivoPerda, userId);
      setActionTarget(null); setActionType(null);
      await load();
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao registrar perda.');
    } finally {
      setSaving(false);
    }
  };

  const handleRenovar = async () => {
    if (!actionTarget || !novaValidade) { alert('Informe a nova data de validade.'); return; }
    setSaving(true);
    try {
      await api.renovarOrcamento(actionTarget.id, novaValidade, userId);
      setActionTarget(null); setActionType(null);
      await load();
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao renovar orçamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (o: Orcamento) => {
    if (!confirm(`Excluir orçamento de ${o.nomeCliente}?`)) return;
    try {
      await api.deleteOrcamento(o.id, userId);
      await load();
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao excluir orçamento.');
    }
  };

  // ── Follow-up config ──────────────────────────────────────────────

  const handleSaveFollowup = async () => {
    if (!followupForm.mensagemTemplate.trim()) { alert('Digite a mensagem do follow-up.'); return; }
    setSaving(true);
    try {
      if (editingFollowupId) {
        await api.updateOrcamentoFollowupConfig(
          editingFollowupId,
          { diasAposEnvio: followupForm.diasAposEnvio, canal: followupForm.canal, mensagemTemplate: followupForm.mensagemTemplate },
          userId
        );
      } else {
        await api.createOrcamentoFollowupConfig(
          { ...followupForm, ordem: followupConfigs.length },
          userId
        );
      }
      setShowFollowupModal(false);
      setFollowupForm(EMPTY_FOLLOWUP);
      setEditingFollowupId(null);
      const cfgs = await api.getOrcamentoFollowupConfig(userId);
      setFollowupConfigs(cfgs);
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao salvar configuração de follow-up.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFollowup = async (cfg: OrcamentoFollowupConfig) => {
    try {
      await api.updateOrcamentoFollowupConfig(cfg.id, { ativo: !cfg.ativo }, userId);
      const cfgs = await api.getOrcamentoFollowupConfig(userId);
      setFollowupConfigs(cfgs);
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao atualizar configuração.');
    }
  };

  const handleDeleteFollowup = async (id: string) => {
    if (!confirm('Excluir esta etapa de follow-up?')) return;
    try {
      await api.deleteOrcamentoFollowupConfig(id, userId);
      const cfgs = await api.getOrcamentoFollowupConfig(userId);
      setFollowupConfigs(cfgs);
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao excluir configuração.');
    }
  };

  // ── Follow-up manual (registrar log) ─────────────────────────────

  const handleFollowupManual = async (o: Orcamento) => {
    if (!followupConfigs.length) {
      alert('Configure ao menos uma etapa de follow-up antes de disparar.');
      return;
    }
    const cfg = followupConfigs[0];
    const msg = cfg.mensagemTemplate
      .replace('{{nome}}', o.nomeCliente)
      .replace('{{procedimentos}}', o.itens?.map((i) => i.descricao).join(', ') ?? '')
      .replace('{{valor}}', formatCurrency(o.valorTotal))
      .replace('{{validade}}', formatDate(o.validade))
      .replace('{{clinica}}', userName);

    try {
      await api.registrarFollowupLog({ orcamentoId: o.id, configId: cfg.id, canal: cfg.canal, mensagem: msg }, userId);
      alert(`Follow-up registrado para ${o.nomeCliente}.\nCanal: ${CANAL_LABELS[cfg.canal]}\n\n"${msg}"`);
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao registrar follow-up.');
    }
  };

  // ── Impressão de PDF ──────────────────────────────────────────────

  const handlePrint = (o: Orcamento) => {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    const itens = o.itens ?? [];
    const linhasItens = itens.map((it) =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${it.descricao}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${it.quantidade}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${formatCurrency(it.valorUnitario)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${formatCurrency(it.valorTotal)}</td>
      </tr>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>Orçamento — ${o.nomeCliente}</title>
      <style>
        body{font-family:system-ui,sans-serif;color:#111;margin:0;padding:32px}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #111}
        .clinic{font-size:22px;font-weight:700;letter-spacing:-0.5px}
        .label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
        .val{font-size:14px;font-weight:500}
        table{width:100%;border-collapse:collapse;margin-top:24px}
        thead tr{background:#f9fafb}
        th{padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
        .total-row td{padding:12px;font-weight:700;font-size:16px}
        .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af}
        @media print{body{padding:16px}}
      </style></head><body>
      <div class="header">
        <div>
          <div class="clinic">${userName}</div>
          <div style="margin-top:4px;font-size:13px;color:#6b7280">Orçamento</div>
        </div>
        <div style="text-align:right">
          <div class="label">Data de emissão</div>
          <div class="val">${formatDate(o.dataEnvio)}</div>
          <div class="label" style="margin-top:10px">Válido até</div>
          <div class="val" style="color:#dc2626;font-weight:600">${formatDate(o.validade)}</div>
        </div>
      </div>
      <div style="display:flex;gap:40px;margin-bottom:24px">
        <div>
          <div class="label">Cliente</div>
          <div class="val" style="font-size:16px;font-weight:600">${o.nomeCliente}</div>
          ${o.telefone ? `<div style="color:#6b7280;font-size:13px;margin-top:2px">${o.telefone}</div>` : ''}
        </div>
        ${o.profissionalNome ? `<div><div class="label">Profissional</div><div class="val">${o.profissionalNome}</div></div>` : ''}
      </div>
      <table>
        <thead><tr>
          <th>Procedimento / Serviço</th>
          <th style="text-align:center">Qtd.</th>
          <th style="text-align:right">Valor Unit.</th>
          <th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${linhasItens}</tbody>
        <tfoot><tr class="total-row">
          <td colspan="3" style="padding:12px;text-align:right;font-size:14px;color:#6b7280">Total</td>
          <td style="padding:12px;text-align:right;font-size:18px;font-weight:700">${formatCurrency(o.valorTotal)}</td>
        </tr></tfoot>
      </table>
      ${o.observacoes ? `<div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px;font-size:13px"><strong>Observações:</strong> ${o.observacoes}</div>` : ''}
      <div class="footer">Este orçamento é válido até ${formatDate(o.validade)}. Para aprovação ou dúvidas, entre em contato.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  // ── Itens form helpers ────────────────────────────────────────────

  const addItem = () =>
    setForm((f) => ({ ...f, itens: [...f.itens, { descricao: '', quantidade: 1, valorUnitario: 0, procedimentoId: null }] }));

  const removeItem = (i: number) =>
    setForm((f) => ({ ...f, itens: f.itens.filter((_, idx) => idx !== i) }));

  const updateItem = (i: number, patch: Partial<ItemForm>) =>
    setForm((f) => ({ ...f, itens: f.itens.map((it, idx) => idx === i ? { ...it, ...patch } : it) }));

  const totalForm = form.itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0);

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--color-text-muted)', fontSize: 14 }}>
        Carregando orçamentos...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-main)' }}>Orçamentos</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Gerencie propostas e follow-ups automáticos
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setClienteBusca(''); setShowModal(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 'var(--border-radius-md)',
            padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Novo Orçamento
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {([
          { id: 'painel',   label: 'Orçamentos',   icon: FileText },
          { id: 'followup', label: 'Follow-up',     icon: Bell },
          { id: 'relatorio',label: 'Relatório',     icon: BarChart3 },
        ] as { id: TabId; label: string; icon: React.FC<any> }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 14, fontWeight: tab === id ? 600 : 400,
              color: tab === id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: tab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: PAINEL ── */}
      {tab === 'painel' && (
        <div>
          {/* Contadores de status */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {(['todos', 'aberto', 'aprovado', 'perdido', 'expirado'] as const).map((s) => {
              const count = s === 'todos' ? orcamentos.length : orcamentos.filter((o) => o.status === s).length;
              const colors = s === 'todos'
                ? { bg: 'var(--color-primary-light)', text: 'var(--color-primary)', border: 'var(--color-border-hover)' }
                : STATUS_COLORS[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFiltro(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 14px', border: `1px solid ${statusFiltro === s ? colors.border : 'var(--color-border)'}`,
                    borderRadius: 'var(--border-radius-full)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    background: statusFiltro === s ? colors.bg : 'transparent',
                    color: statusFiltro === s ? colors.text : 'var(--color-text-muted)',
                    transition: 'var(--transition-smooth)',
                  }}
                >
                  {s === 'todos' ? 'Todos' : STATUS_LABELS[s]}
                  <span style={{
                    background: statusFiltro === s ? colors.text : '#e5e7eb',
                    color: statusFiltro === s ? '#fff' : '#6b7280',
                    borderRadius: '100px', padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Barra de busca */}
          <div style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente..."
              style={{
                width: '100%', padding: '9px 12px 9px 36px', border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)', fontSize: 14, background: 'var(--bg-card)',
                color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Lista de orçamentos */}
          {orcamentosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
              <FileText size={32} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              Nenhum orçamento encontrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orcamentosFiltrados.map((o) => {
                const dias = diasAteVencer(o.validade);
                const quaseVencendo = o.status === 'aberto' && dias <= 7 && dias >= 0;
                const colors = STATUS_COLORS[o.status];
                return (
                  <div
                    key={o.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${quaseVencendo ? '#FED7AA' : 'var(--color-border)'}`,
                      borderRadius: 'var(--border-radius-md)',
                      padding: '16px 20px',
                      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                      transition: 'var(--transition-smooth)',
                    }}
                  >
                    {/* Status badge */}
                    <span style={{
                      background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                      borderRadius: '100px', padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {STATUS_LABELS[o.status]}
                    </span>

                    {/* Info principal */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-main)' }}>{o.nomeCliente}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {o.itens?.map((i) => i.descricao).join(', ') || '—'}
                      </div>
                    </div>

                    {/* Profissional */}
                    {o.profissionalNome && (
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', minWidth: 100 }}>
                        {o.profissionalNome}
                      </div>
                    )}

                    {/* Valor */}
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-main)', minWidth: 90, textAlign: 'right' }}>
                      {formatCurrency(o.valorTotal)}
                    </div>

                    {/* Validade */}
                    <div style={{ minWidth: 110, textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Válido até</div>
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: quaseVencendo ? '#C2410C' : o.status === 'expirado' ? '#9CA3AF' : 'var(--color-text-main)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {quaseVencendo && <AlertTriangle size={13} />}
                        {formatDate(o.validade)}
                      </div>
                      {o.status === 'aberto' && (
                        <div style={{ fontSize: 11, color: quaseVencendo ? '#C2410C' : 'var(--color-text-muted)' }}>
                          {dias === 0 ? 'Vence hoje' : dias < 0 ? 'Vencido' : `${dias}d restantes`}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {/* Imprimir PDF */}
                      <ActionBtn title="Exportar PDF" onClick={() => handlePrint(o)}>
                        <Printer size={15} />
                      </ActionBtn>

                      {/* Follow-up */}
                      {o.status === 'aberto' && (
                        <ActionBtn title="Disparar follow-up" onClick={() => handleFollowupManual(o)}>
                          <Bell size={15} />
                        </ActionBtn>
                      )}

                      {/* Aprovar */}
                      {o.status === 'aberto' && (
                        <ActionBtn
                          title="Marcar como aprovado"
                          color="#15803D"
                          onClick={() => { setActionTarget(o); setActionType('aprovar'); }}
                        >
                          <CheckCircle2 size={15} />
                        </ActionBtn>
                      )}

                      {/* Perdido */}
                      {o.status === 'aberto' && (
                        <ActionBtn
                          title="Marcar como perdido"
                          color="#B91C1C"
                          onClick={() => { setActionTarget(o); setActionType('perdido'); setMotivoPerda('preco'); }}
                        >
                          <XCircle size={15} />
                        </ActionBtn>
                      )}

                      {/* Renovar */}
                      {o.status === 'expirado' && (
                        <ActionBtn
                          title="Renovar orçamento"
                          color="#1D4ED8"
                          onClick={() => { setActionTarget(o); setActionType('renovar'); setNovaValidade(addDays(todayISO(), 30)); }}
                        >
                          <RefreshCw size={15} />
                        </ActionBtn>
                      )}

                      {/* Excluir */}
                      <ActionBtn title="Excluir" color="#B91C1C" onClick={() => handleDelete(o)}>
                        <Trash2 size={15} />
                      </ActionBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: FOLLOW-UP ── */}
      {tab === 'followup' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Sequência de Follow-up</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                Configure as mensagens automáticas enviadas para orçamentos sem resposta.
                Variáveis: <code>{'{{nome}}'}</code>, <code>{'{{procedimentos}}'}</code>, <code>{'{{valor}}'}</code>, <code>{'{{validade}}'}</code>, <code>{'{{clinica}}'}</code>
              </p>
            </div>
            <button
              onClick={() => { setFollowupForm(EMPTY_FOLLOWUP); setEditingFollowupId(null); setShowFollowupModal(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--border-radius-md)',
                padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={15} /> Adicionar etapa
            </button>
          </div>

          {followupConfigs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
              <Bell size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
              Nenhuma etapa de follow-up configurada.<br />Clique em "Adicionar etapa" para começar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {followupConfigs.map((cfg, idx) => (
                <div key={cfg.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-md)', padding: '16px 20px',
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                  opacity: cfg.ativo ? 1 : 0.5,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '100%', background: 'var(--color-primary-light)',
                    color: 'var(--color-primary)', fontWeight: 700, fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>Dia {cfg.diasAposEnvio}</span>
                      <span style={{
                        background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                        borderRadius: '100px', padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      }}>
                        {CANAL_LABELS[cfg.canal]}
                      </span>
                      {!cfg.ativo && (
                        <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>desativado</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{cfg.mensagemTemplate}"
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <ActionBtn title={cfg.ativo ? 'Desativar' : 'Ativar'} onClick={() => handleToggleFollowup(cfg)}>
                      {cfg.ativo ? <Clock size={15} /> : <CheckCircle2 size={15} />}
                    </ActionBtn>
                    <ActionBtn title="Editar" onClick={() => {
                      setFollowupForm({ diasAposEnvio: cfg.diasAposEnvio, canal: cfg.canal, mensagemTemplate: cfg.mensagemTemplate });
                      setEditingFollowupId(cfg.id);
                      setShowFollowupModal(true);
                    }}>
                      <Edit3 size={15} />
                    </ActionBtn>
                    <ActionBtn title="Excluir" color="#B91C1C" onClick={() => handleDeleteFollowup(cfg.id)}>
                      <Trash2 size={15} />
                    </ActionBtn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: RELATÓRIO ── */}
      {tab === 'relatorio' && (
        <div>
          <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Relatório de Conversão</h2>
          {!relatorio ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Carregando relatório...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 28 }}>
                <StatCard label="Total enviados"     value={String(relatorio.totalEnviados)}   />
                <StatCard label="Aprovados"          value={String(relatorio.totalAprovados)}  color="#15803D" />
                <StatCard label="Perdidos"           value={String(relatorio.totalPerdidos)}   color="#B91C1C" />
                <StatCard label="Expirados"          value={String(relatorio.totalExpirados)}  color="#6B7280" />
                <StatCard label="Taxa de conversão"  value={`${relatorio.taxaConversao}%`}     color="#1D4ED8" />
                <StatCard label="Valor convertido"   value={formatCurrency(relatorio.valorTotalConvertido)} color="#15803D" />
                <StatCard label="Ticket médio"       value={formatCurrency(relatorio.ticketMedioAprovados)} />
              </div>

              {relatorio.totalPerdidos > 0 && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Motivos de Perda</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {MOTIVOS_PERDA.map(({ key, label }) => {
                      const count = relatorio.motivosPerda[key] ?? 0;
                      const pct   = relatorio.totalPerdidos > 0 ? Math.round((count / relatorio.totalPerdidos) * 100) : 0;
                      return (
                        <div key={key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-text-main)', fontWeight: 500 }}>{label}</span>
                            <span style={{ color: 'var(--color-text-muted)' }}>{count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#EF4444', borderRadius: 99, transition: 'width .4s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {relatorio.totalEnviados === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
                  Nenhum orçamento registrado ainda.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── MODAL: NOVO ORÇAMENTO ── */}
      {showModal && (
        <Modal title="Novo Orçamento" onClose={() => setShowModal(false)} width={680}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Cliente */}
            <div style={{ position: 'relative' }}>
              <Label>Cliente *</Label>
              <input
                value={clienteBusca || form.nomeCliente}
                onChange={(e) => {
                  const v = e.target.value;
                  setClienteBusca(v);
                  setForm((f) => ({ ...f, nomeCliente: v, clienteId: null }));
                }}
                placeholder="Nome ou buscar cliente cadastrado..."
                style={inputStyle}
              />
              {clienteSugestoes.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--bg-card)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,.08)', overflow: 'hidden',
                }}>
                  {clienteSugestoes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setForm((f) => ({ ...f, nomeCliente: c.nome, clienteId: c.id, telefone: c.telefone || f.telefone }));
                        setClienteBusca('');
                        setClienteSugestoes([]);
                      }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontSize: 14, color: 'var(--color-text-main)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <strong>{c.nome}</strong>
                      {c.telefone && <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: 12 }}>{c.telefone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Telefone</Label>
                <input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" style={inputStyle} />
              </div>
              <div>
                <Label>Profissional</Label>
                <select
                  value={form.profissionalId ?? ''}
                  onChange={(e) => {
                    const m = equipe.find((eq) => eq.id === e.target.value);
                    setForm((f) => ({ ...f, profissionalId: e.target.value || null, profissionalNome: m?.nome ?? '' }));
                  }}
                  style={inputStyle}
                >
                  <option value="">Selecionar...</option>
                  {equipe.filter((m) => m.ativo).map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Data de Envio</Label>
                <input type="date" value={form.dataEnvio} onChange={(e) => setForm((f) => ({ ...f, dataEnvio: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Label>Validade *</Label>
                <input type="date" value={form.validade} onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            {/* Itens */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Label style={{ margin: 0 }}>Itens / Procedimentos *</Label>
                <button onClick={addItem} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={14} /> Adicionar item
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.itens.map((it, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 100px auto', gap: 8, alignItems: 'center' }}>
                    <div>
                      <input
                        value={it.descricao}
                        onChange={(e) => updateItem(i, { descricao: e.target.value })}
                        placeholder="Descrição do procedimento..."
                        list={`proc-list-${i}`}
                        style={inputStyle}
                      />
                      <datalist id={`proc-list-${i}`}>
                        {procedimentos.map((p) => <option key={p.id} value={p.nome} />)}
                      </datalist>
                    </div>
                    <input
                      type="number" min={1} value={it.quantidade}
                      onChange={(e) => updateItem(i, { quantidade: Math.max(1, Number(e.target.value)) })}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                    <input
                      type="number" min={0} step={0.01} value={it.valorUnitario || ''}
                      onChange={(e) => updateItem(i, { valorUnitario: Number(e.target.value) })}
                      placeholder="R$"
                      style={{ ...inputStyle, textAlign: 'right' }}
                    />
                    <button
                      onClick={() => removeItem(i)}
                      disabled={form.itens.length === 1}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: form.itens.length === 1 ? 'not-allowed' : 'pointer', opacity: form.itens.length === 1 ? 0.3 : 1, padding: 4 }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 700, fontSize: 16, color: 'var(--color-text-main)' }}>
                Total: {formatCurrency(totalForm)}
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Notas adicionais..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSaveOrcamento} disabled={saving} style={btnPrimary}>
                {saving ? 'Salvando...' : 'Salvar Orçamento'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: APROVAR ── */}
      {actionType === 'aprovar' && actionTarget && (
        <Modal title="Aprovar Orçamento" onClose={() => { setActionTarget(null); setActionType(null); }} width={420}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 0 }}>
            Confirma a aprovação do orçamento de <strong>{actionTarget.nomeCliente}</strong> no valor de <strong>{formatCurrency(actionTarget.valorTotal)}</strong>?
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            O sistema irá sugerir a criação de um agendamento para este cliente.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button onClick={() => { setActionTarget(null); setActionType(null); }} style={btnSecondary}>Cancelar</button>
            <button onClick={handleAprovar} disabled={saving} style={{ ...btnPrimary, background: '#15803D' }}>
              {saving ? 'Salvando...' : 'Confirmar Aprovação'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: PERDIDO ── */}
      {actionType === 'perdido' && actionTarget && (
        <Modal title="Orçamento Perdido" onClose={() => { setActionTarget(null); setActionType(null); }} width={420}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 0 }}>
            Qual o motivo da perda do orçamento de <strong>{actionTarget.nomeCliente}</strong>?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {MOTIVOS_PERDA.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', border: `1px solid ${motivoPerda === key ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 'var(--border-radius-md)', background: motivoPerda === key ? 'var(--color-primary-light)' : 'transparent' }}>
                <input type="radio" name="motivo" value={key} checked={motivoPerda === key} onChange={() => setMotivoPerda(key)} style={{ accentColor: 'var(--color-primary)' }} />
                <span style={{ fontSize: 14, color: 'var(--color-text-main)' }}>{label}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setActionTarget(null); setActionType(null); }} style={btnSecondary}>Cancelar</button>
            <button onClick={handleMarcarPerdido} disabled={saving} style={{ ...btnPrimary, background: '#B91C1C' }}>
              {saving ? 'Salvando...' : 'Marcar como Perdido'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: RENOVAR ── */}
      {actionType === 'renovar' && actionTarget && (
        <Modal title="Renovar Orçamento" onClose={() => { setActionTarget(null); setActionType(null); }} width={380}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 0 }}>
            Defina a nova data de validade para o orçamento de <strong>{actionTarget.nomeCliente}</strong>.
          </p>
          <div style={{ marginBottom: 20 }}>
            <Label>Nova validade *</Label>
            <input type="date" value={novaValidade} onChange={(e) => setNovaValidade(e.target.value)} style={inputStyle} min={todayISO()} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setActionTarget(null); setActionType(null); }} style={btnSecondary}>Cancelar</button>
            <button onClick={handleRenovar} disabled={saving} style={btnPrimary}>
              {saving ? 'Renovando...' : 'Renovar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: FOLLOW-UP CONFIG ── */}
      {showFollowupModal && (
        <Modal
          title={editingFollowupId ? 'Editar Etapa de Follow-up' : 'Nova Etapa de Follow-up'}
          onClose={() => { setShowFollowupModal(false); setEditingFollowupId(null); }}
          width={520}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Disparar após (dias sem resposta) *</Label>
                <input
                  type="number" min={1} max={90} value={followupForm.diasAposEnvio}
                  onChange={(e) => setFollowupForm((f) => ({ ...f, diasAposEnvio: Math.max(1, Number(e.target.value)) }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>Canal *</Label>
                <select
                  value={followupForm.canal}
                  onChange={(e) => setFollowupForm((f) => ({ ...f, canal: e.target.value as any }))}
                  style={inputStyle}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="ambos">WhatsApp + E-mail</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Mensagem *</Label>
              <textarea
                value={followupForm.mensagemTemplate}
                onChange={(e) => setFollowupForm((f) => ({ ...f, mensagemTemplate: e.target.value }))}
                rows={5}
                placeholder="Olá, {{nome}}! Enviamos um orçamento para {{procedimentos}}..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                Variáveis: {'{{nome}}'}, {'{{procedimentos}}'}, {'{{valor}}'}, {'{{validade}}'}, {'{{clinica}}'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button onClick={() => { setShowFollowupModal(false); setEditingFollowupId(null); }} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSaveFollowup} disabled={saving} style={btnPrimary}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Sub-componentes ─────────────────────────────────────────────────────

function ActionBtn({
  children, title, color, onClick,
}: {
  children: React.ReactNode;
  title?: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: '1px solid var(--color-border)',
        borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
        color: color ?? 'var(--color-text-muted)',
        transition: 'var(--transition-smooth)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.borderColor = 'var(--color-border-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--border-radius-md)', padding: '16px 18px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--color-text-main)' }}>{value}</div>
    </div>
  );
}

function Modal({ title, onClose, children, width = 500 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        style={{
          background: 'var(--bg-card)', borderRadius: 'var(--border-radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,.15)', width: '100%', maxWidth: width,
          maxHeight: '90vh', overflowY: 'auto', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-main)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em', ...style }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)', fontSize: 14, background: 'var(--bg-card)',
  color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--color-primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--border-radius-md)', padding: '10px 20px',
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: 'var(--color-text-main)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)',
  padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
};
