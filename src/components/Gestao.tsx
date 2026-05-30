import React, { useState, useEffect, useMemo } from 'react';
import type { Agendamento, FechamentoFinanceiro, ItemEstoque, Procedimento } from '../types';
import {
  AlertTriangle, DollarSign, Wallet, LayoutDashboard,
  Edit2, Trash2, X, Check, Package, Stethoscope,
  User, Users, Receipt, Calendar, Activity, BarChart3, TrendingUp, Plus,
} from 'lucide-react';
import { api } from '../lib/api';
import { RelatorioFaltas } from './RelatorioFaltas';
import { Comissoes } from './Comissoes';
import { Repassos } from './Repassos';
import { RelatorioOcupacao } from './RelatorioOcupacao';
import { RelatorioOcupacaoSalas } from './RelatorioOcupacaoSalas';
import { EstoqueAvancado } from './EstoqueAvancado';
import { ContasFinanceiras } from './ContasFinanceiras';

interface GestaoProps { userId: string; userName?: string; }

const EMPTY_FECHAMENTO: FechamentoFinanceiro = { faturamentoTotal: 0, comissoesPagas: 0, formasPagamento: [] };

type ActiveTab = 'dashboard' | 'financeiro' | 'contas' | 'estoque' | 'procedimentos' | 'faltas' | 'comissoes' | 'repassos' | 'ocupacao' | 'salas';

// ──────────────────────────────────────────────────────────────────────
// FILTRO DE PERÍODO — presets + range customizado
// ──────────────────────────────────────────────────────────────────────
type PresetPeriodo = 'hoje' | 'ontem' | '7dias' | 'mes' | 'personalizado';

const PRESET_LABELS: Record<PresetPeriodo, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  '7dias': 'Últimos 7 dias',
  mes: 'Mês Atual',
  personalizado: 'Personalizado',
};

const fmtISO = (d: Date) => d.toISOString().split('T')[0];

function getPeriodoRange(
  preset: PresetPeriodo,
  custom?: { start: string; end: string }
): { start: string; end: string } {
  const today = new Date();
  switch (preset) {
    case 'hoje':
      return { start: fmtISO(today), end: fmtISO(today) };
    case 'ontem': {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      return { start: fmtISO(d), end: fmtISO(d) };
    }
    case '7dias': {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { start: fmtISO(d), end: fmtISO(today) };
    }
    case 'mes': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmtISO(start), end: fmtISO(today) };
    }
    case 'personalizado':
      return {
        start: custom?.start || fmtISO(today),
        end: custom?.end || fmtISO(today),
      };
  }
}

function formatPeriodoExibicao(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (start === end) {
    return s.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return `${s.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → ${e.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

function diasNoIntervalo(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00').getTime();
  const e = new Date(end + 'T00:00:00').getTime();
  return Math.round((e - s) / 86400000) + 1;
}



export const Gestao: React.FC<GestaoProps> = ({ userId, userName = 'Gestor' }) => {
  const [tab, setTab] = useState<ActiveTab>('dashboard');
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [financeiro, setFinanceiro] = useState<FechamentoFinanceiro>(EMPTY_FECHAMENTO);
  const [realizadosNoPeriodo, setRealizadosNoPeriodo] = useState<Agendamento[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);

  // ── Filtro de período (Financeiro) ──
  const [periodoPreset, setPeriodoPreset] = useState<PresetPeriodo>('hoje');
  const [customStart, setCustomStart] = useState<string>(fmtISO(new Date()));
  const [customEnd, setCustomEnd] = useState<string>(fmtISO(new Date()));
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [draftStart, setDraftStart] = useState<string>(fmtISO(new Date()));
  const [draftEnd, setDraftEnd] = useState<string>(fmtISO(new Date()));

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getPeriodoRange(periodoPreset, { start: customStart, end: customEnd }),
    [periodoPreset, customStart, customEnd]
  );

  // ── Procedimento form state ──
  const [showProcModal, setShowProcModal] = useState(false);
  const [editingProcId, setEditingProcId] = useState<string | null>(null);
  const [pNome, setPNome] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPreco, setPPreco] = useState('');
  const [pDuracao, setPDuracao] = useState('60');

  useEffect(() => { loadProcedimentos(); }, [userId]);

  // Recarrega financeiro sempre que o range mudar (filtro temporal global)
  useEffect(() => { loadFinanceiro(rangeStart, rangeEnd); }, [userId, rangeStart, rangeEnd]);

  const loadFinanceiro = async (inicio: string, fim: string) => {
    try {
      const [fechamento, ags] = await Promise.all([
        api.getFechamentoFinanceiroRange(userId, inicio, fim),
        api.getAgendamentosRange(userId, inicio, fim),
      ]);
      setFinanceiro(fechamento);
      setRealizadosNoPeriodo(ags.filter(a => a.status === 'finalizada'));
    } catch {
      setFinanceiro(EMPTY_FECHAMENTO);
      setRealizadosNoPeriodo([]);
    }
  };

  // Helpers do filtro
  const handleSelectPreset = (p: PresetPeriodo) => {
    if (p === 'personalizado') {
      setDraftStart(customStart);
      setDraftEnd(customEnd);
      setShowCustomPicker(true);
    } else {
      setPeriodoPreset(p);
    }
  };
  const applyCustomPicker = () => {
    if (!draftStart || !draftEnd) return;
    const a = draftStart <= draftEnd ? draftStart : draftEnd;
    const b = draftStart <= draftEnd ? draftEnd : draftStart;
    setCustomStart(a);
    setCustomEnd(b);
    setPeriodoPreset('personalizado');
    setShowCustomPicker(false);
  };

  const loadProcedimentos = async () => {
    try {
      setProcedimentos(await api.getProcedimentos(userId));
    } catch (e) { console.error('Erro ao carregar procedimentos', e); }
  };

  // ─── PROCEDIMENTO HANDLERS ───────────────────────────────────────────────
  const openProcModal = (p?: Procedimento) => {
    if (p) {
      setEditingProcId(p.id); setPNome(p.nome); setPDesc(p.descricao || '');
      setPPreco(String(p.preco)); setPDuracao(String(p.duracaoMinutos));
    } else {
      setEditingProcId(null); setPNome(''); setPDesc(''); setPPreco(''); setPDuracao('60');
    }
    setShowProcModal(true);
  };

  const handleSaveProc = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Omit<Procedimento, 'id'> = {
      nome: pNome,
      descricao: pDesc,
      preco: parseFloat(pPreco) || 0,
      duracaoMinutos: parseInt(pDuracao, 10) || 60,
      validadeDias: 90,
      salaRequerida: 'Cabine 01',
      profissionalResponsavel: '',
    };
    try {
      if (editingProcId) {
        const updated = await api.updateProcedimento(editingProcId, payload, userId);
        setProcedimentos(prev => prev.map(p => p.id === editingProcId ? updated : p));
      } else {
        const created = await api.createProcedimento(payload, userId);
        setProcedimentos(prev => [...prev, created]);
      }
      setShowProcModal(false);
    } catch (err: any) {
      console.error('[Gestao] Erro ao salvar procedimento:', err);
      const msg = err?.message || JSON.stringify(err);
      alert(`Erro ao salvar procedimento:\n${msg}`);
    }
  };

  const handleDeleteProc = async (id: string) => {
    if (!window.confirm('Excluir este procedimento?')) return;
    setProcedimentos(prev => prev.filter(p => p.id !== id));
    try { await api.deleteProcedimento(id, userId); } catch { await loadProcedimentos(); }
  };

  const PAG_META: Record<string, { label: string; bg: string; color: string }> = {
    pix:      { label: 'Pix',      bg: '#dcfce7', color: '#15803d' },
    credito:  { label: 'Crédito',  bg: '#ede9fe', color: '#6d28d9' },
    debito:   { label: 'Débito',   bg: '#dbeafe', color: '#1d4ed8' },
    dinheiro: { label: 'Dinheiro', bg: '#fef9c3', color: '#a16207' },
  };

  const faturamentoLiquido = financeiro.faturamentoTotal - financeiro.comissoesPagas;
  const ticketMedio = realizadosNoPeriodo.length > 0
    ? financeiro.faturamentoTotal / realizadosNoPeriodo.length
    : 0;
  const mostrarDataColuna = rangeStart !== rangeEnd;
  const criticos = estoque.filter(i => i.status === 'critico').length;

  const tabStyle = (t: ActiveTab): React.CSSProperties => ({
    padding: '10px 20px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
    borderRadius: '8px', transition: 'all 0.2s',
    background: tab === t ? 'var(--color-primary)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--color-text-muted)',
  });

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="gestao-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>Gestão & Back-Office</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Financeiro, estoque e catálogo de procedimentos da clínica.</p>
        </div>
        <div className="gestao-tabs" style={{ display: 'flex', gap: '4px', background: '#f8f8f6', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '4px' }}>
          <button style={tabStyle('dashboard')} onClick={() => setTab('dashboard')}>
            <LayoutDashboard size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Dashboard
          </button>
          <button style={tabStyle('financeiro')} onClick={() => setTab('financeiro')}>
            <DollarSign size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Financeiro
          </button>
          <button style={tabStyle('contas')} onClick={() => setTab('contas')}>
            <Wallet size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Contas
          </button>
          <button style={tabStyle('estoque')} onClick={() => setTab('estoque')}>
            <Package size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Estoque
            {criticos > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>{criticos}</span>}
          </button>
          <button style={tabStyle('procedimentos')} onClick={() => setTab('procedimentos')}>
            <Stethoscope size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Procedimentos
          </button>
          <button style={tabStyle('faltas')} onClick={() => setTab('faltas')}>
            <BarChart3 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Faltas & Ausências
          </button>
          <button style={tabStyle('comissoes')} onClick={() => setTab('comissoes')}>
            <TrendingUp size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Comissões
          </button>
          <button style={tabStyle('repassos')} onClick={() => setTab('repassos')}>
            <Receipt size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Repassos
          </button>
          <button style={tabStyle('ocupacao')} onClick={() => setTab('ocupacao')}>
            <Activity size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Ocupação
          </button>
          <button style={tabStyle('salas')} onClick={() => setTab('salas')}>
            <BarChart3 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Salas
          </button>
        </div>
      </div>

      {/* ── TAB: DASHBOARD ──────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <>
          {/* KPI Row */}
          <div className="gestao-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
            <div className="card" style={{ padding: '22px', borderLeft: '4px solid var(--color-success)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Faturamento Hoje</span><DollarSign size={14} style={{ color: 'var(--color-success)' }} />
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                {financeiro.faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '4px' }}>Atendimentos finalizados</div>
            </div>

            <div className="card" style={{ padding: '22px', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Márgem Líquida</span><Wallet size={14} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-primary)' }}>
                {(financeiro.faturamentoTotal - financeiro.comissoesPagas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px' }}>Após comissões</div>
            </div>

            <div className="card" style={{ padding: '22px', borderLeft: criticos > 0 ? '4px solid #ef4444' : '4px solid #6b9e78' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Estoque</span>
                {criticos > 0 ? <AlertTriangle size={14} style={{ color: '#ef4444' }} /> : <Package size={14} style={{ color: '#6b9e78' }} />}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: criticos > 0 ? '#ef4444' : 'var(--color-text-main)' }}>
                {criticos > 0 ? criticos : estoque.length}
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: criticos > 0 ? '#ef4444' : 'var(--color-text-muted)' }}>
                {criticos > 0 ? `${criticos} iten(s) crítico(s)` : `${estoque.length} insumos cadastrados`}
              </div>
            </div>

            <div className="card" style={{ padding: '22px', borderLeft: '4px solid #8b7fc7' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Procedimentos</span><Stethoscope size={14} style={{ color: '#8b7fc7' }} />
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-main)' }}>{procedimentos.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {procedimentos.length > 0
                  ? `Ticket médio: ${(procedimentos.reduce((s, p) => s + p.preco, 0) / procedimentos.length).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                  : 'Nenhum cadastrado'}
              </div>
            </div>
          </div>

          {/* Second row: Estoque critico + Procedimentos recentes */}
          <div className="gestao-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Estoque Alerta — US-045 */}
            {(() => {
              const criticos = estoque.filter(i => i.status === 'critico');
              const vencendo = estoque.filter(p => {
                if (!p.validade) return false;
                const dias = Math.ceil((new Date(p.validade).getTime() - Date.now()) / 86400000);
                return dias >= 0 && dias <= 30;
              });
              return (
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} style={{ color: criticos.length > 0 ? '#dc2626' : 'var(--color-primary)' }} />
                      <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Alertas de Estoque</h3>
                    </div>
                    <button className="btn btn-outline" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setTab('estoque')}>
                      Ver tudo
                    </button>
                  </div>
                  {estoque.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '20px 0', textAlign: 'center' }}>
                      Nenhum insumo cadastrado.
                    </p>
                  ) : criticos.length === 0 && vencendo.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <Check size={15} style={{ color: '#15803d', flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 500 }}>
                        Todos os {estoque.length} insumo(s) dentro do estoque mínimo
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {criticos.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.produto}</div>
                            <div style={{ fontSize: '11px', color: '#dc2626' }}>
                              {item.quantidade} {item.unidade} — mín: {item.quantidadeMinima}
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#fecaca', color: '#dc2626' }}>
                            Crítico
                          </span>
                        </div>
                      ))}
                      {vencendo.map(item => {
                        const dias = Math.ceil((new Date(item.validade!).getTime() - Date.now()) / 86400000);
                        return (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.produto}</div>
                              <div style={{ fontSize: '11px', color: '#b45309' }}>
                                Vence em {dias} dia(s)
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#fde68a', color: '#b45309' }}>
                              {dias}d
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Procedimentos */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Stethoscope size={16} style={{ color: 'var(--color-primary)' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Catálogo de Procedimentos</h3>
                </div>
                <button className="btn btn-outline" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setTab('procedimentos')}>Gerenciar</button>
              </div>
              {procedimentos.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '20px 0', textAlign: 'center' }}>Nenhum procedimento cadastrado ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {procedimentos.slice(0, 5).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: '#f8f8f6', border: '1px solid var(--color-border)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.nome}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{p.duracaoMinutos} min</div>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>{p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── TAB: FINANCEIRO ─────────────────────────────────────────────── */}
      {tab === 'financeiro' && (
        <>
          {/* ── FILTRO GLOBAL DE PERÍODO ────────────────────────────────── */}
          <div className="card financeiro-filter-card" style={{ padding: '18px 20px', marginBottom: '24px' }}>
            <div className="financeiro-filter-row">
              <div className="financeiro-filter-label">
                <Calendar size={15} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Período</span>
              </div>
              <div className="financeiro-filter-chips">
                {(['hoje', 'ontem', '7dias', 'mes', 'personalizado'] as PresetPeriodo[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`financeiro-chip${periodoPreset === p ? ' is-active' : ''}`}
                  >
                    {PRESET_LABELS[p]}
                  </button>
                ))}
              </div>
              <div className="financeiro-filter-summary">
                {formatPeriodoExibicao(rangeStart, rangeEnd)}
                <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                  · {diasNoIntervalo(rangeStart, rangeEnd)} dia{diasNoIntervalo(rangeStart, rangeEnd) > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* ── CAMADA 1: KPIs (Bruto · Líquido · Ticket Médio) ─────────── */}
          <div className="gestao-three-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
            {[
              {
                label: 'Faturamento Bruto', value: financeiro.faturamentoTotal,
                icon: <DollarSign size={16} style={{ color: 'var(--color-success)' }} />,
                sub: `${realizadosNoPeriodo.length} atendimento${realizadosNoPeriodo.length === 1 ? '' : 's'} no período`,
                color: 'var(--color-success)', border: '4px solid var(--color-success)',
              },
              {
                label: 'Faturamento Líquido', value: faturamentoLiquido,
                icon: <Wallet size={16} style={{ color: 'var(--color-primary)' }} />,
                sub: 'Após provisão de comissões (30%)',
                color: 'var(--color-primary)', border: '4px solid var(--color-primary)',
              },
              {
                label: 'Ticket Médio', value: ticketMedio,
                icon: <Activity size={16} style={{ color: '#8b7fc7' }} />,
                sub: realizadosNoPeriodo.length > 0 ? 'Valor médio por atendimento' : 'Aguardando atendimentos finalizados',
                color: '#8b7fc7', border: '4px solid #8b7fc7',
              },
            ].map(card => (
              <div key={card.label} className="card" style={{ padding: '24px', borderLeft: card.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}>
                  <span>{card.label}</span>{card.icon}
                </div>
                <h2 style={{ fontSize: '28px', fontWeight: 700, color: card.color }}>
                  {card.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </h2>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{card.sub}</span>
              </div>
            ))}
          </div>

          {/* ── CAMADA 2: Procedimentos Realizados ──────────────────────── */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <Receipt size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Procedimentos Realizados</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                ({realizadosNoPeriodo.length} {realizadosNoPeriodo.length === 1 ? 'atendimento' : 'atendimentos'} · {formatPeriodoExibicao(rangeStart, rangeEnd)})
              </span>
            </div>

            {realizadosNoPeriodo.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>
                Nenhum atendimento finalizado neste período.
              </p>
            ) : (
              <div className={mostrarDataColuna ? 'gestao-realizados-list--with-date' : ''}>
                <div className="gestao-realizados-header">
                  {mostrarDataColuna && <span>Data</span>}
                  <span>Procedimento</span>
                  <span>Paciente</span>
                  <span>Profissional</span>
                  <span style={{ textAlign: 'right' }}>Valor · Pagamento</span>
                </div>
                {realizadosNoPeriodo.map(item => {
                  const pag = item.metodoPagamento ? PAG_META[item.metodoPagamento] : null;
                  return (
                    <div key={item.id} className="gestao-realizados-item">
                      {mostrarDataColuna && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <Stethoscope size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.procedimento}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <User size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.clienteNome}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <Users size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.profissional}
                        </span>
                      </div>
                      <div className="grri-valor-payment">
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                          {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {pag ? (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px', background: pag.bg, color: pag.color, whiteSpace: 'nowrap' }}>
                            {pag.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── CAMADA 3: Métodos de Pagamento (movido para baixo) ──────── */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Wallet size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Métodos de Pagamento</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                ({financeiro.formasPagamento.length} {financeiro.formasPagamento.length === 1 ? 'forma utilizada' : 'formas utilizadas'})
              </span>
            </div>
            {financeiro.formasPagamento.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>
                Nenhum atendimento finalizado neste período.
              </p>
            ) : (
              <div className="financeiro-pagamentos-grid">
                {financeiro.formasPagamento.map((p, i) => (
                  <div key={i} className="financeiro-pagamento-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600 }}>{p.metodo}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{p.percentual}%</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '8px' }}>
                      {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <div style={{ height: '6px', background: '#F0F0F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${p.percentual}%`, height: '100%', background: i === 0 ? 'var(--color-primary)' : '#BACBC5' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: CONTAS (US-033) ────────────────────────────────────────── */}
      {tab === 'contas' && (
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Wallet size={20} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Gestão Financeira Prospectiva</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>Contas a pagar e a receber · Fluxo de caixa 30/60/90 dias</p>
            </div>
          </div>
          <ContasFinanceiras userId={userId} />
        </div>
      )}

      {/* ── TAB: ESTOQUE ────────────────────────────────────────────────── */}
      {tab === 'estoque' && (
        <EstoqueAvancado userId={userId} onDataChange={setEstoque} />
      )}

      {/* ── TAB: PROCEDIMENTOS ──────────────────────────────────────────── */}
      {tab === 'procedimentos' && (
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Stethoscope size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Catálogo de Procedimentos</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>({procedimentos.length} cadastrados)</span>
            </div>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => openProcModal()}>
              <Plus size={14} />Novo Procedimento
            </button>
          </div>
          {procedimentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 40px', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-muted)' }}>
              <Stethoscope size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p style={{ marginBottom: '4px', fontWeight: 600 }}>Nenhum procedimento cadastrado</p>
              <p style={{ fontSize: '13px' }}>Clique em "Novo Procedimento" para montar o seu catálogo.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {procedimentos.map(p => (
                <div key={p.id} className="card" style={{ padding: '20px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-main)' }}>{p.nome}</h4>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => openProcModal(p)} className="btn btn-outline" style={{ padding: '4px 6px' }}><Edit2 size={12} /></button>
                      <button onClick={() => handleDeleteProc(p.id)} className="btn btn-outline" style={{ padding: '4px 6px', borderColor: '#fca5a5', color: '#ef4444' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {(p as any).descricao && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{(p as any).descricao}</p>}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>{p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>{p.duracaoMinutos} min</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: FALTAS & AUSÊNCIAS ─────────────────────────────────────── */}
      {tab === 'faltas' && (
        <div>
          <RelatorioFaltas userId={userId} />
        </div>
      )}

      {/* ── TAB: COMISSÕES ──────────────────────────────────────────────── */}
      {tab === 'comissoes' && (
        <Comissoes userId={userId} nomeGestor={userName} />
      )}

      {/* ── TAB: REPASSOS ───────────────────────────────────────────────── */}
      {tab === 'repassos' && (
        <Repassos userId={userId} nomeGestor={userName} />
      )}

      {/* ── TAB: OCUPAÇÃO ─────────────────────────────────────────────── */}
      {tab === 'ocupacao' && (
        <RelatorioOcupacao userId={userId} />
      )}

      {/* ── TAB: SALAS (SALA-004) ─────────────────────────────────────── */}
      {tab === 'salas' && (
        <RelatorioOcupacaoSalas userId={userId} />
      )}

      {/* ── MODAL: FILTRO PERSONALIZADO (bottom-sheet no mobile) ───────── */}
      {showCustomPicker && (
        <div className="modal-overlay" onClick={() => setShowCustomPicker(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: '420px', width: '92%', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Período Personalizado</h3>
              </div>
              <button onClick={() => setShowCustomPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Selecione o intervalo para auditar o faturamento da clínica.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }} className="financeiro-custom-grid">
              <div className="form-group">
                <label className="form-label">Data inicial</label>
                <input
                  className="form-input"
                  type="date"
                  value={draftStart}
                  max={draftEnd || fmtISO(new Date())}
                  onChange={e => setDraftStart(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Data final</label>
                <input
                  className="form-input"
                  type="date"
                  value={draftEnd}
                  min={draftStart}
                  max={fmtISO(new Date())}
                  onChange={e => setDraftEnd(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCustomPicker(false)} className="btn btn-outline">Cancelar</button>
              <button
                type="button"
                onClick={applyCustomPicker}
                disabled={!draftStart || !draftEnd}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={14} />Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PROCEDIMENTO ─────────────────────────────────────────── */}
      {showProcModal && (
        <div className="modal-overlay" onClick={() => setShowProcModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: '460px', width: '92%', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{editingProcId ? 'Editar Procedimento' : 'Novo Procedimento'}</h3>
              <button onClick={() => setShowProcModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveProc} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nome do Procedimento</label>
                <input className="form-input" value={pNome} onChange={e => setPNome(e.target.value)} placeholder="Ex: Toxina Botulínica (Botox)" required />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-input" rows={3} value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="Descreva brevemente o procedimento..." style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={pPreco} onChange={e => setPPreco(e.target.value)} placeholder="1200.00" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Duração (min)</label>
                  <input className="form-input" type="number" min="15" step="15" value={pDuracao} onChange={e => setPDuracao(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowProcModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} />Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
