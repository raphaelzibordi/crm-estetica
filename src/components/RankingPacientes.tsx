import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Crown, Star, AlertTriangle, Clock,
  Download, Settings, ChevronDown, ChevronUp, X,
  MessageCircle, CheckSquare, Filter, BarChart2,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Agendamento } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

interface RankingPacientesProps {
  userId: string;
}

type Segmento = 'vip' | 'fidelizados' | 'em_risco' | 'inativos';
type PeriodoFreq = '6meses' | '12meses' | 'historico';
type OrdemCol = 'score' | 'ltv' | 'freq' | 'ticket';

interface ScoreConfig {
  wLtv: number;   // 0-100
  wFreq: number;
  wTicket: number;
  thVip: number;
  thFidelizados: number;
  thEmRisco: number;
}

interface PacienteScore {
  clienteId: string;
  clienteNome: string;
  score: number;
  segmento: Segmento;
  ltv: number;
  ltvNorm: number;
  freq: number;
  freqNorm: number;
  ticket: number;
  ticketNorm: number;
  ultimaVisita: string;
  diasSemVisita: number;
  profissionais: string[];
  procedimentosTop: string[];
  scoreHistorico: { mes: string; score: number }[];
  segmentoAnterior?: Segmento;
  migrou: boolean;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ScoreConfig = {
  wLtv: 40, wFreq: 35, wTicket: 25,
  thVip: 80, thFidelizados: 60, thEmRisco: 40,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmtISO  = (d: Date) => d.toISOString().split('T')[0];
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');

function subMonths(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

function mesLabel(iso: string): string {
  const [y, m] = iso.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Compute score for a single patient given their appointments and max values for normalisation.
function computeScore(
  ltv: number, freq: number, ticket: number,
  maxLtv: number, maxFreq: number, maxTicket: number,
  cfg: ScoreConfig,
): number {
  const ltvN    = maxLtv    > 0 ? (ltv    / maxLtv)    * 100 : 0;
  const freqN   = maxFreq   > 0 ? (freq   / maxFreq)   * 100 : 0;
  const ticketN = maxTicket > 0 ? (ticket / maxTicket) * 100 : 0;
  const total   = cfg.wLtv + cfg.wFreq + cfg.wTicket || 1;
  return (ltvN * cfg.wLtv + freqN * cfg.wFreq + ticketN * cfg.wTicket) / total;
}

function getSegmento(score: number, diasSemVisita: number, cfg: ScoreConfig): Segmento {
  if (diasSemVisita > 365 * 2) return 'inativos';
  if (score >= cfg.thVip) return 'vip';
  if (score >= cfg.thFidelizados) return 'fidelizados';
  if (score >= cfg.thEmRisco) return 'em_risco';
  return 'inativos';
}

// Build PacienteScore[] from raw appointments + config
function buildScores(
  ags: Agendamento[],
  freqCutoff: string,         // ISO date — appointments before this are excluded from freq/ticket
  cfg: ScoreConfig,
  today = fmtISO(new Date()),
): PacienteScore[] {
  // Group by clienteId
  const map = new Map<string, {
    nome: string;
    all: Agendamento[];
    recent: Agendamento[];
    profissionais: Set<string>;
    procCount: Map<string, number>;
  }>();

  for (const a of ags) {
    if (!a.clienteId || a.valor <= 0) continue;
    if (!map.has(a.clienteId)) {
      map.set(a.clienteId, { nome: a.clienteNome, all: [], recent: [], profissionais: new Set(), procCount: new Map() });
    }
    const e = map.get(a.clienteId)!;
    e.all.push(a);
    if (a.data >= freqCutoff) e.recent.push(a);
    if (a.profissional) e.profissionais.add(a.profissional);
    if (a.procedimento) e.procCount.set(a.procedimento, (e.procCount.get(a.procedimento) ?? 0) + 1);
  }

  // First pass: raw metrics
  const raw = [...map.entries()].map(([clienteId, e]) => {
    const ltv    = e.all.reduce((s, a) => s + a.valor, 0);
    const freq   = e.recent.length;
    const ticket = e.recent.length > 0 ? e.recent.reduce((s, a) => s + a.valor, 0) / e.recent.length : 0;
    const ultimaVisita = e.all.reduce((max, a) => a.data > max ? a.data : max, '0000-00-00');
    const diasSemVisita = Math.floor((new Date(today).getTime() - new Date(ultimaVisita + 'T00:00:00').getTime()) / 86400000);
    const procTop = [...e.procCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
    return { clienteId, nome: e.nome, ltv, freq, ticket, ultimaVisita, diasSemVisita, profissionais: [...e.profissionais], procTop };
  });

  // Normalisation constants
  const maxLtv    = Math.max(...raw.map(r => r.ltv),    1);
  const maxFreq   = Math.max(...raw.map(r => r.freq),   1);
  const maxTicket = Math.max(...raw.map(r => r.ticket), 1);

  return raw.map(r => {
    const ltvN    = maxLtv    > 0 ? (r.ltv    / maxLtv)    * 100 : 0;
    const freqN   = maxFreq   > 0 ? (r.freq   / maxFreq)   * 100 : 0;
    const ticketN = maxTicket > 0 ? (r.ticket / maxTicket) * 100 : 0;
    const score   = computeScore(r.ltv, r.freq, r.ticket, maxLtv, maxFreq, maxTicket, cfg);
    const segmento = getSegmento(score, r.diasSemVisita, cfg);
    return {
      clienteId: r.clienteId, clienteNome: r.nome,
      score, segmento,
      ltv: r.ltv, ltvNorm: ltvN,
      freq: r.freq, freqNorm: freqN,
      ticket: r.ticket, ticketNorm: ticketN,
      ultimaVisita: r.ultimaVisita, diasSemVisita: r.diasSemVisita,
      profissionais: r.profissionais, procedimentosTop: r.procTop,
      scoreHistorico: [], segmentoAnterior: undefined, migrou: false,
    } as PacienteScore;
  });
}

// Compute score history for the last 6 months for a single patient
function buildHistorico(
  ags: Agendamento[],
  cfg: ScoreConfig,
): { mes: string; score: number }[] {
  const result: { mes: string; score: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const cutoffDate = new Date(); cutoffDate.setMonth(cutoffDate.getMonth() - i);
    const monthEnd   = fmtISO(cutoffDate);
    const monthStart = fmtISO(new Date(cutoffDate.getFullYear(), cutoffDate.getMonth() - 11, 1));
    const filtered   = ags.filter(a => a.data <= monthEnd && a.valor > 0);
    const recent     = filtered.filter(a => a.data >= monthStart);
    const ltv        = filtered.reduce((s, a) => s + a.valor, 0);
    const freq       = recent.length;
    const ticket     = recent.length > 0 ? recent.reduce((s, a) => s + a.valor, 0) / recent.length : 0;
    const score      = computeScore(ltv, freq, ticket, ltv || 1, freq || 1, ticket || 1, cfg);
    const mes        = monthEnd.slice(0, 7);
    result.push({ mes, score: Math.min(Math.round(score), 100) });
  }
  return result;
}

// ─── Segment metadata ──────────────────────────────────────────────────────

const SEG_META: Record<Segmento, { label: string; icon: React.ReactNode; bg: string; color: string; desc: string }> = {
  vip:          { label: 'VIP',         icon: <Crown size={13} />,         bg: '#fefce8', color: '#a16207', desc: 'Foco em manutenção e exclusividade' },
  fidelizados:  { label: 'Fidelizados', icon: <Star size={13} />,          bg: '#f0fdf4', color: '#15803d', desc: 'Foco em upsell e engajamento' },
  em_risco:     { label: 'Em risco',    icon: <AlertTriangle size={13} />, bg: '#fff7ed', color: '#c2410c', desc: 'Foco em reativação' },
  inativos:     { label: 'Inativos',    icon: <Clock size={13} />,         bg: '#f8fafc', color: '#64748b', desc: 'Foco em campanha de resgate' },
};

const SegBadge: React.FC<{ seg: Segmento }> = ({ seg }) => {
  const m = SEG_META[seg];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 8px', borderRadius: '10px',
      background: m.bg, color: m.color, fontSize: '11px', fontWeight: 700,
    }}>
      {m.icon} {m.label}
    </span>
  );
};

// ─── Score bar ─────────────────────────────────────────────────────────────

const ScoreBar: React.FC<{ score: number; seg: Segmento }> = ({ score, seg }) => {
  const color = SEG_META[seg].color;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', minWidth: 60 }}>
        <div style={{ width: `${score}%`, height: '6px', background: color, borderRadius: '3px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{Math.round(score)}</span>
    </div>
  );
};

// ─── Mini line chart for score history ─────────────────────────────────────

const MiniLine: React.FC<{ data: { mes: string; score: number }[] }> = ({ data }) => {
  if (data.length < 2) return null;
  const W = 260, H = 70, pad = 20;
  const max = 100;
  const xOf = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2);
  const yOf = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.score)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: H }}>
      <line x1={pad} x2={W - pad} y1={yOf(80)} y2={yOf(80)} stroke="#fde68a" strokeWidth="1" strokeDasharray="4 3" />
      <line x1={pad} x2={W - pad} y1={yOf(60)} y2={yOf(60)} stroke="#bbf7d0" strokeWidth="1" strokeDasharray="4 3" />
      <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xOf(i)} cy={yOf(d.score)} r="3" fill="var(--color-primary)" />
          <text x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#999">{mesLabel(d.mes)}</text>
        </g>
      ))}
    </svg>
  );
};

// ─── Pie chart ─────────────────────────────────────────────────────────────

const PieChart: React.FC<{ data: { seg: Segmento; count: number }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  const R = 60, cx = 80, cy = 80;
  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.count / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    angle += sweep;
    const x2 = cx + R * Math.cos(angle);
    const y2 = cy + R * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { seg: d.seg, count: d.count, path: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z` };
  });
  const COLORS: Record<Segmento, string> = { vip: '#a16207', fidelizados: '#15803d', em_risco: '#c2410c', inativos: '#64748b' };
  return (
    <svg viewBox="0 0 160 160" style={{ width: 120, height: 120, flexShrink: 0 }}>
      {slices.map(s => <path key={s.seg} d={s.path} fill={COLORS[s.seg]} opacity="0.85" />)}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const RankingPacientes: React.FC<RankingPacientesProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [todosAgs, setTodosAgs] = useState<Agendamento[]>([]);

  // Config
  const [cfg, setCfg] = useState<ScoreConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [draftCfg, setDraftCfg] = useState<ScoreConfig>(DEFAULT_CONFIG);

  // Filtros
  const [periodoFreq, setPeriodoFreq] = useState<PeriodoFreq>('12meses');
  const [filtroProfissional, setFiltroProfissional] = useState('');
  const [filtroSegmento, setFiltroSegmento] = useState<Segmento | ''>('');
  const [filtroScoreMin, setFiltroScoreMin] = useState(0);

  // Ordem
  const [ordem, setOrdem] = useState<OrdemCol>('score');
  const [ordemAsc, setOrdemAsc] = useState(false);

  // Seleção (CA-05)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acaoModal, setAcaoModal] = useState<'campanha' | 'followup' | null>(null);
  const [acaoMsg, setAcaoMsg] = useState('');

  // Detalhe
  const [detalhe, setDetalhe] = useState<PacienteScore | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ags = await api.getAgendamentosFinalizados(userId);
      setTodosAgs(ags);
    } catch (e) {
      console.error('[RankingPacientes] Erro:', e);
      setTodosAgs([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────

  const freqCutoffDate = useMemo(() => {
    if (periodoFreq === '6meses')   return fmtISO(subMonths(6));
    if (periodoFreq === '12meses')  return fmtISO(subMonths(12));
    return '2000-01-01';
  }, [periodoFreq]);

  const agsFiltrados = useMemo(() => {
    if (!filtroProfissional) return todosAgs;
    return todosAgs.filter(a => a.profissional === filtroProfissional);
  }, [todosAgs, filtroProfissional]);

  const scores = useMemo(() => buildScores(agsFiltrados, freqCutoffDate, cfg), [agsFiltrados, freqCutoffDate, cfg]);

  const profissionais = useMemo(() =>
    [...new Set(todosAgs.map(a => a.profissional).filter(Boolean))].sort(),
    [todosAgs]
  );

  const filtered = useMemo(() => {
    let list = scores.filter(p => p.score >= filtroScoreMin);
    if (filtroSegmento) list = list.filter(p => p.segmento === filtroSegmento);
    list = [...list].sort((a, b) => {
      let diff = 0;
      if (ordem === 'score')  diff = a.score  - b.score;
      if (ordem === 'ltv')    diff = a.ltv    - b.ltv;
      if (ordem === 'freq')   diff = a.freq   - b.freq;
      if (ordem === 'ticket') diff = a.ticket - b.ticket;
      return ordemAsc ? diff : -diff;
    });
    return list;
  }, [scores, filtroSegmento, filtroScoreMin, ordem, ordemAsc]);

  const segDistrib = useMemo(() => {
    const m: Record<Segmento, number> = { vip: 0, fidelizados: 0, em_risco: 0, inativos: 0 };
    for (const p of scores) m[p.segmento]++;
    return m;
  }, [scores]);

  // ── Column sort toggle ────────────────────────────────────────────────

  const toggleOrdem = (col: OrdemCol) => {
    if (ordem === col) setOrdemAsc(v => !v);
    else { setOrdem(col); setOrdemAsc(false); }
  };

  // ── Selection ────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll = () => setSelected(new Set(filtered.map(p => p.clienteId)));
  const clearSelect = () => setSelected(new Set());

  // ── Export CSV ───────────────────────────────────────────────────────

  const exportCSV = () => {
    const rows = [
      ['#', 'Paciente', 'Score', 'Segmento', 'LTV', 'Freq 12m', 'Ticket Médio', 'Última Visita', 'Dias sem visita'],
      ...filtered.map((p, i) => [
        String(i + 1), p.clienteNome, String(Math.round(p.score)),
        SEG_META[p.segmento].label, String(p.ltv.toFixed(2)),
        String(p.freq), String(p.ticket.toFixed(2)), p.ultimaVisita, String(p.diasSemVisita),
      ]),
    ];
    downloadCSV(rows, `ranking-pacientes-${fmtISO(new Date())}.csv`);
  };

  // ── Open detalhe ─────────────────────────────────────────────────────

  const openDetalhe = (p: PacienteScore) => {
    const pAgs = todosAgs.filter(a => a.clienteId === p.clienteId && a.valor > 0);
    const hist  = buildHistorico(pAgs, cfg);
    // Detect segment migration in last 30 days
    const prev30 = hist[hist.length - 2]?.score;
    let segAnterior: Segmento | undefined;
    if (prev30 !== undefined) {
      const diasFake = p.diasSemVisita; // same patient
      segAnterior = getSegmento(prev30, diasFake, cfg);
    }
    setDetalhe({ ...p, scoreHistorico: hist, segmentoAnterior: segAnterior, migrou: !!segAnterior && segAnterior !== p.segmento });
  };

  // ── Render ───────────────────────────────────────────────────────────

  const COL_HDR: { key: OrdemCol; label: string }[] = [
    { key: 'score',  label: 'Score' },
    { key: 'ltv',    label: 'LTV' },
    { key: 'freq',   label: 'Freq.' },
    { key: 'ticket', label: 'Ticket Médio' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Período freq */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={13} style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Período:</span>
          {(['6meses', '12meses', 'historico'] as PeriodoFreq[]).map(p => (
            <button key={p}
              onClick={() => setPeriodoFreq(p)}
              style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '6px', background: periodoFreq === p ? 'var(--color-primary)' : '#f1f5f0', color: periodoFreq === p ? '#fff' : 'var(--color-text-muted)' }}>
              {p === '6meses' ? '6 meses' : p === '12meses' ? '12 meses' : 'Histórico'}
            </button>
          ))}
        </div>

        {/* Profissional */}
        <select value={filtroProfissional} onChange={e => setFiltroProfissional(e.target.value)}
          style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff' }}>
          <option value="">Todos os profissionais</option>
          {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Segmento */}
        <select value={filtroSegmento} onChange={e => setFiltroSegmento(e.target.value as Segmento | '')}
          style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff' }}>
          <option value="">Todos os segmentos</option>
          {(['vip', 'fidelizados', 'em_risco', 'inativos'] as Segmento[]).map(s => (
            <option key={s} value={s}>{SEG_META[s].label}</option>
          ))}
        </select>

        {/* Score mínimo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Score ≥</span>
          <input type="number" min={0} max={100} step={5} value={filtroScoreMin}
            onChange={e => setFiltroScoreMin(Number(e.target.value))}
            style={{ width: '56px', padding: '4px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '6px' }} />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button onClick={() => { setDraftCfg(cfg); setShowConfig(v => !v); }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '6px', background: showConfig ? 'var(--color-primary)' : '#fff', color: showConfig ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer' }}>
            <Settings size={13} /> Pesos
          </button>
          <button onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* ── Config de pesos (collapsible) ────────────────────────────── */}
      {showConfig && (
        <div style={{ padding: '14px 24px', background: '#f8f8f6', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { key: 'wLtv', label: 'LTV', color: 'var(--color-success)' },
              { key: 'wFreq', label: 'Frequência', color: 'var(--color-primary)' },
              { key: 'wTicket', label: 'Ticket Médio', color: '#8b7fc7' },
            ].map(({ key, label, color }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                <span style={{ color }}>{label} ({draftCfg[key as keyof ScoreConfig]}%)</span>
                <input type="range" min={0} max={100} step={5}
                  value={draftCfg[key as keyof ScoreConfig] as number}
                  onChange={e => setDraftCfg(p => ({ ...p, [key]: Number(e.target.value) }))}
                  style={{ width: '120px' }} />
              </label>
            ))}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Thresholds:
            </div>
            {[
              { key: 'thVip', label: 'VIP ≥', color: '#a16207' },
              { key: 'thFidelizados', label: 'Fid. ≥', color: '#15803d' },
              { key: 'thEmRisco', label: 'Risco ≥', color: '#c2410c' },
            ].map(({ key, label, color }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color }}>
                {label}
                <input type="number" min={0} max={100} step={5}
                  value={draftCfg[key as keyof ScoreConfig] as number}
                  onChange={e => setDraftCfg(p => ({ ...p, [key]: Number(e.target.value) }))}
                  style={{ width: '54px', padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '12px' }} />
              </label>
            ))}
            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
              <button className="btn btn-primary" style={{ fontSize: '12px', padding: '5px 14px' }}
                onClick={() => { setCfg(draftCfg); setShowConfig(false); }}>
                Aplicar
              </button>
              <button className="btn btn-outline" style={{ fontSize: '12px', padding: '5px 12px' }}
                onClick={() => setShowConfig(false)}>
                Fechar
              </button>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Soma dos pesos: {draftCfg.wLtv + draftCfg.wFreq + draftCfg.wTicket}% (o sistema normaliza automaticamente)
          </div>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Calculando scores...
        </div>
      )}

      {!loading && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Distribuição por segmento ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {/* Pie + distribuição lado a lado */}
            <div className="card" style={{ padding: '20px', gridColumn: 'span 1', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <PieChart data={(['vip','fidelizados','em_risco','inativos'] as Segmento[]).map(s => ({ seg: s, count: segDistrib[s] }))} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {(['vip','fidelizados','em_risco','inativos'] as Segmento[]).map(s => {
                  const m = SEG_META[s];
                  const pct = scores.length > 0 ? Math.round((segDistrib[s] / scores.length) * 100) : 0;
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                      onClick={() => setFiltroSegmento(filtroSegmento === s ? '' : s)}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: m.color, flex: 1 }}>{m.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{segDistrib[s]}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', minWidth: 30 }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {(['vip','fidelizados','em_risco','inativos'] as Segmento[]).map(s => {
              const m = SEG_META[s];
              const count = segDistrib[s];
              return (
                <div key={s} className="card" style={{ padding: '18px', borderTop: `3px solid ${m.color}`, cursor: 'pointer' }}
                  onClick={() => setFiltroSegmento(filtroSegmento === s ? '' : s)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 700, color: m.color }}>
                      {m.icon} {m.label}
                    </span>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: m.color }}>{count}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>{m.desc}</p>
                </div>
              );
            })}
          </div>

          {/* ── Barra de ações em massa ───────────────────────────────── */}
          {selected.size > 0 && (
            <div style={{ background: 'var(--color-primary)', borderRadius: '10px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{selected.size} paciente{selected.size !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                <button onClick={() => setAcaoModal('campanha')}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                  <MessageCircle size={13} /> Iniciar Campanha
                </button>
                <button onClick={() => setAcaoModal('followup')}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                  <CheckSquare size={13} /> Criar Follow-up
                </button>
                <button onClick={clearSelect}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                  <X size={13} /> Limpar
                </button>
              </div>
            </div>
          )}

          {/* ── Ranking table ─────────────────────────────────────────── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={15} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                  Ranking de Pacientes
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>({filtered.length} pacientes)</span>
              </div>
              <button onClick={selectAll} style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                Selecionar todos
              </button>
            </div>

            {filtered.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Nenhum paciente encontrado com os filtros aplicados.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8f8f6' }}>
                      <th style={{ width: 36, padding: '10px 8px 10px 16px' }}>
                        <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                          onChange={e => e.target.checked ? selectAll() : clearSelect()} />
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paciente</th>
                      {COL_HDR.map(c => (
                        <th key={c.key} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: ordem === c.key ? 'var(--color-primary)' : 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => toggleOrdem(c.key)}>
                          {c.label} {ordem === c.key ? (ordemAsc ? <ChevronUp size={12} style={{ display: 'inline' }} /> : <ChevronDown size={12} style={{ display: 'inline' }} />) : null}
                        </th>
                      ))}
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Segmento</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Última visita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr key={p.clienteId}
                        style={{ borderBottom: '1px solid var(--color-border)', background: selected.has(p.clienteId) ? 'var(--color-primary-light)' : i % 2 === 0 ? 'transparent' : '#fafaf8', cursor: 'pointer' }}
                        onClick={() => openDetalhe(p)}>
                        <td style={{ padding: '10px 8px 10px 16px' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(p.clienteId)}
                            onChange={() => toggleSelect(p.clienteId)} />
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: i < 3 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.clienteNome}</td>
                        <td style={{ padding: '10px 12px', minWidth: 140 }}><ScoreBar score={p.score} seg={p.segmento} /></td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-success)' }}>{fmtBRL(p.ltv)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{p.freq}x</td>
                        <td style={{ padding: '10px 12px', color: '#8b7fc7', fontWeight: 600 }}>{fmtBRL(p.ticket)}</td>
                        <td style={{ padding: '10px 12px' }}><SegBadge seg={p.segmento} /></td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: '12px' }}>{fmtDate(p.ultimaVisita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: DETALHE DO PACIENTE (CA-04)
      ══════════════════════════════════════════════════════════════════ */}
      {detalhe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setDetalhe(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '560px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700 }}>{detalhe.clienteNome}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SegBadge seg={detalhe.segmento} />
                  {detalhe.migrou && detalhe.segmentoAnterior && (
                    <span style={{ fontSize: '11px', background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                      Migrou de {SEG_META[detalhe.segmentoAnterior].label} nos últimos 30 dias
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setDetalhe(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Score breakdown */}
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Detalhamento do Score</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'LTV (total histórico)', value: fmtBRL(detalhe.ltv), norm: detalhe.ltvNorm, peso: cfg.wLtv, color: 'var(--color-success)' },
                    { label: `Frequência (${periodoFreq === '6meses' ? '6 meses' : periodoFreq === '12meses' ? '12 meses' : 'histórico'})`, value: `${detalhe.freq} atendimentos`, norm: detalhe.freqNorm, peso: cfg.wFreq, color: 'var(--color-primary)' },
                    { label: 'Ticket Médio', value: fmtBRL(detalhe.ticket), norm: detalhe.ticketNorm, peso: cfg.wTicket, color: '#8b7fc7' },
                  ].map(d => (
                    <div key={d.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600 }}>{d.label}</span>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ color: d.color, fontWeight: 700 }}>{d.value}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>Peso {d.peso}%</span>
                          <span style={{ fontWeight: 700 }}>{Math.round(d.norm)}/100</span>
                        </div>
                      </div>
                      <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
                        <div style={{ width: `${d.norm}%`, height: '6px', background: d.color, borderRadius: '3px' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8f8f6', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Score Final</span>
                  <ScoreBar score={detalhe.score} seg={detalhe.segmento} />
                </div>
              </div>

              {/* Evolução do score */}
              {detalhe.scoreHistorico.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Evolução — Últimos 6 meses</h4>
                  <MiniLine data={detalhe.scoreHistorico} />
                </div>
              )}

              {/* Info adicional */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Última visita', value: fmtDate(detalhe.ultimaVisita) },
                  { label: 'Dias sem visita', value: `${detalhe.diasSemVisita} dias` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '12px', background: '#f8f8f6', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Procedimentos top */}
              {detalhe.procedimentosTop.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Procedimentos mais frequentes</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {detalhe.procedimentosTop.map(p => (
                      <span key={p} style={{ padding: '4px 10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações rápidas */}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px', borderTop: '1px solid var(--color-border)' }}>
                <button onClick={() => { setSelected(new Set([detalhe.clienteId])); setDetalhe(null); setAcaoModal('campanha'); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                  <MessageCircle size={13} /> Enviar campanha
                </button>
                <button onClick={() => { setSelected(new Set([detalhe.clienteId])); setDetalhe(null); setAcaoModal('followup'); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: '#fff' }}>
                  <CheckSquare size={13} /> Criar follow-up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: AÇÃO EM MASSA (CA-05)
      ══════════════════════════════════════════════════════════════════ */}
      {acaoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setAcaoModal(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '480px', maxWidth: '100%', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {acaoModal === 'campanha' ? <><MessageCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Iniciar Campanha</> : <><CheckSquare size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Criar Follow-up</>}
              </h3>
              <button onClick={() => setAcaoModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ background: '#f8f8f6', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px' }}>
              <strong>{selected.size} paciente{selected.size !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}</strong>
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: 80, overflowY: 'auto' }}>
                {filtered.filter(p => selected.has(p.clienteId)).map(p => (
                  <span key={p.clienteId} style={{ padding: '2px 8px', background: '#e5e7eb', borderRadius: '6px', fontSize: '11px' }}>{p.clienteNome}</span>
                ))}
              </div>
            </div>

            <textarea
              rows={4}
              placeholder={acaoModal === 'campanha' ? 'Mensagem da campanha (WhatsApp/e-mail)...' : 'Descrição do follow-up para a equipe...'}
              value={acaoMsg}
              onChange={e => setAcaoMsg(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setAcaoModal(null)}>Cancelar</button>
              <button className="btn btn-primary"
                onClick={() => {
                  alert(`${acaoModal === 'campanha' ? 'Campanha' : 'Follow-up'} registrado para ${selected.size} paciente(s).\nMensagem: "${acaoMsg || '(sem mensagem)'}"\n\nIntegre com o módulo WhatsApp para disparo automático.`);
                  setAcaoModal(null);
                  setAcaoMsg('');
                  clearSelect();
                }}>
                {acaoModal === 'campanha' ? 'Criar Campanha' : 'Criar Follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
