import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  TrendingUp, Users, DollarSign, Activity, Award,
  Download, BarChart2, User, Calendar,
  Settings, Star, Filter,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Agendamento } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RentabilidadeProps {
  userId: string;
}

type PeriodoPreset = '6meses' | '12meses' | 'historico' | 'personalizado';
type ViewTab = 'dashboard' | 'ltv-paciente' | 'segmentacao';
type RankOrdem = 'receita' | 'atendimentos' | 'ticket';
type FaixaLTV = 'bronze' | 'prata' | 'ouro';

interface LTVPaciente {
  clienteId: string;
  clienteNome: string;
  total: number;
  atendimentos: number;
  ticketMedio: number;
  ultimaVisita: string;
  faixa: FaixaLTV;
}

interface ProcRanking {
  procedimento: string;
  receitaTotal: number;
  atendimentos: number;
  ticketMedio: number;
}

interface TicketMensal {
  mes: string;
  mesLabel: string;
  ticket: number;
  atendimentos: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtISO = (d: Date) => d.toISOString().split('T')[0];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getPeriodoInicio(preset: PeriodoPreset, customStart: string): string {
  const today = new Date();
  switch (preset) {
    case '6meses': {
      const d = new Date(today); d.setMonth(d.getMonth() - 6);
      return fmtISO(d);
    }
    case '12meses': {
      const d = new Date(today); d.setFullYear(d.getFullYear() - 1);
      return fmtISO(d);
    }
    case 'historico':
      return '2000-01-01';
    case 'personalizado':
      return customStart;
  }
}

function getPeriodoFim(preset: PeriodoPreset, customEnd: string): string {
  return preset === 'personalizado' ? customEnd : fmtISO(new Date());
}

function getFaixa(total: number, bronze: number, prata: number): FaixaLTV {
  if (total >= prata) return 'ouro';
  if (total >= bronze) return 'prata';
  return 'bronze';
}

function mesLabel(mes: string): string {
  const [year, month] = mes.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(month, 10) - 1]}/${year.slice(2)}`;
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function exportSVGasPNG(svgEl: SVGSVGElement, filename: string) {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = svgEl.viewBox.baseVal.width || svgEl.clientWidth || 800;
    canvas.height = svgEl.viewBox.baseVal.height || svgEl.clientHeight || 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ─── Mini Charts ─────────────────────────────────────────────────────────────

interface BarChartProps {
  items: { label: string; value: number; color?: string }[];
  height?: number;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

const HorizontalBarChart: React.FC<BarChartProps> = ({ items, height = 320, svgRef }) => {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const rowH = 36;
  const labelW = 160;
  const barArea = 340;
  const valueW = 90;
  const totalW = labelW + barArea + valueW + 20;
  const totalH = items.length * rowH + 20;

  return (
    <svg
      ref={svgRef as React.RefObject<SVGSVGElement>}
      viewBox={`0 0 ${totalW} ${totalH}`}
      style={{ width: '100%', maxHeight: height, display: 'block' }}
    >
      {items.map((item, i) => {
        const y = i * rowH + 10;
        const barW = (item.value / maxVal) * barArea;
        const color = item.color ?? '#6b9e78';
        return (
          <g key={item.label}>
            <text x={labelW - 8} y={y + 14} textAnchor="end" fontSize="11" fill="#666"
              style={{ fontFamily: 'inherit' }}>
              {item.label.length > 22 ? item.label.slice(0, 20) + '…' : item.label}
            </text>
            <rect x={labelW} y={y + 2} width={Math.max(barW, 2)} height={22}
              rx="4" fill={color} opacity="0.85" />
            <text x={labelW + barW + 6} y={y + 16} fontSize="11" fill="#333"
              fontWeight="600" style={{ fontFamily: 'inherit' }}>
              {fmtBRL(item.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

const LineChart: React.FC<LineChartProps> = ({ data, height = 200, color = '#6b9e78', svgRef }) => {
  if (data.length === 0) return null;
  const padL = 60, padR = 16, padT = 16, padB = 36;
  const w = 600, h = height;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;

  const xOf = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * plotW;
  const yOf = (v: number) => padT + plotH - ((v - minVal) / range) * plotH;

  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ');

  const nTicks = 4;
  const yTicks = Array.from({ length: nTicks + 1 }, (_, i) => minVal + (range / nTicks) * i);

  return (
    <svg
      ref={svgRef as React.RefObject<SVGSVGElement>}
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', maxHeight: height, display: 'block' }}
    >
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={yOf(t)} y2={yOf(t)} stroke="#eee" strokeWidth="1" />
          <text x={padL - 6} y={yOf(t) + 4} textAnchor="end" fontSize="10" fill="#999"
            style={{ fontFamily: 'inherit' }}>
            {fmtBRL(t)}
          </text>
        </g>
      ))}
      {/* Area fill */}
      <polygon
        points={`${padL},${padT + plotH} ${pts} ${xOf(data.length - 1)},${padT + plotH}`}
        fill={color} opacity="0.08"
      />
      {/* Line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Dots and x-labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xOf(i)} cy={yOf(d.value)} r="4" fill={color} />
          {(data.length <= 12 || i % Math.ceil(data.length / 12) === 0) && (
            <text x={xOf(i)} y={h - 4} textAnchor="middle" fontSize="10" fill="#999"
              style={{ fontFamily: 'inherit' }}>
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

// ─── Faixa badge ─────────────────────────────────────────────────────────────

const FAIXA_META: Record<FaixaLTV, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  bronze: { label: 'Bronze', bg: '#fef3e2', color: '#b45309', icon: <Star size={11} /> },
  prata:  { label: 'Prata',  bg: '#f1f5f9', color: '#475569', icon: <Award size={11} /> },
  ouro:   { label: 'Ouro',   bg: '#fefce8', color: '#a16207', icon: <Star size={11} style={{ fill: '#a16207' }} /> },
};

const FaixaBadge: React.FC<{ faixa: FaixaLTV }> = ({ faixa }) => {
  const m = FAIXA_META[faixa];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 8px', borderRadius: '10px',
      background: m.bg, color: m.color, fontSize: '11px', fontWeight: 700,
    }}>
      {m.icon} {m.label}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const Rentabilidade: React.FC<RentabilidadeProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);

  // Período
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('12meses');
  const [customStart, setCustomStart] = useState(fmtISO((() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d; })()));
  const [customEnd, setCustomEnd] = useState(fmtISO(new Date()));
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [draftStart, setDraftStart] = useState(customStart);
  const [draftEnd, setDraftEnd] = useState(customEnd);

  // Filtros
  const [filtroProfissional, setFiltroProfissional] = useState('');
  const [filtroProcedimento, setFiltroProcedimento] = useState('');

  // View
  const [viewTab, setViewTab] = useState<ViewTab>('dashboard');
  const [rankOrdem, setRankOrdem] = useState<RankOrdem>('receita');
  const [topLTVCount, setTopLTVCount] = useState<20 | 50>(20);

  // Segmentação thresholds (R$)
  const [threshBronze, setThreshBronze] = useState(500);
  const [threshPrata, setThreshPrata] = useState(2000);
  const [editingThresh, setEditingThresh] = useState(false);
  const [draftBronze, setDraftBronze] = useState(500);
  const [draftPrata, setDraftPrata] = useState(2000);

  // Chart refs for PNG export
  const barSvgRef = useRef<SVGSVGElement | null>(null);
  const lineSvgRef = useRef<SVGSVGElement | null>(null);

  const inicio = getPeriodoInicio(periodoPreset, customStart);
  const fim    = getPeriodoFim(periodoPreset, customEnd);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAgendamentosFinalizados(userId, inicio, fim);
      setAgendamentos(data);
    } catch (e) {
      console.error('[Rentabilidade] Erro ao carregar dados:', e);
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, [userId, inicio, fim]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const profissionais = useMemo(() =>
    [...new Set(agendamentos.map(a => a.profissional).filter(Boolean))].sort(),
    [agendamentos]
  );

  const procedimentosList = useMemo(() =>
    [...new Set(agendamentos.map(a => a.procedimento).filter(Boolean))].sort(),
    [agendamentos]
  );

  const filtered = useMemo(() => {
    let list = agendamentos.filter(a => a.valor > 0);
    if (filtroProfissional) list = list.filter(a => a.profissional === filtroProfissional);
    if (filtroProcedimento) list = list.filter(a => a.procedimento === filtroProcedimento);
    return list;
  }, [agendamentos, filtroProfissional, filtroProcedimento]);

  const ltvPorPaciente = useMemo((): LTVPaciente[] => {
    const map = new Map<string, { nome: string; total: number; count: number; ultimaVisita: string }>();
    for (const a of filtered) {
      const prev = map.get(a.clienteId);
      if (!prev) {
        map.set(a.clienteId, { nome: a.clienteNome, total: a.valor, count: 1, ultimaVisita: a.data });
      } else {
        prev.total += a.valor;
        prev.count += 1;
        if (a.data > prev.ultimaVisita) prev.ultimaVisita = a.data;
      }
    }
    return [...map.entries()].map(([clienteId, v]) => ({
      clienteId,
      clienteNome: v.nome,
      total: v.total,
      atendimentos: v.count,
      ticketMedio: v.total / v.count,
      ultimaVisita: v.ultimaVisita,
      faixa: getFaixa(v.total, threshBronze, threshPrata),
    })).sort((a, b) => b.total - a.total);
  }, [filtered, threshBronze, threshPrata]);

  const rankingProcedimentos = useMemo((): ProcRanking[] => {
    const map = new Map<string, { receita: number; count: number }>();
    for (const a of filtered) {
      const proc = a.procedimento || '(sem procedimento)';
      const prev = map.get(proc);
      if (!prev) map.set(proc, { receita: a.valor, count: 1 });
      else { prev.receita += a.valor; prev.count += 1; }
    }
    const list: ProcRanking[] = [...map.entries()].map(([procedimento, v]) => ({
      procedimento,
      receitaTotal: v.receita,
      atendimentos: v.count,
      ticketMedio: v.receita / v.count,
    }));
    if (rankOrdem === 'receita') list.sort((a, b) => b.receitaTotal - a.receitaTotal);
    else if (rankOrdem === 'atendimentos') list.sort((a, b) => b.atendimentos - a.atendimentos);
    else list.sort((a, b) => b.ticketMedio - a.ticketMedio);
    return list;
  }, [filtered, rankOrdem]);

  const ticketMensal = useMemo((): TicketMensal[] => {
    const map = new Map<string, { total: number; count: number }>();
    for (const a of filtered) {
      const mes = a.data.slice(0, 7); // YYYY-MM
      const prev = map.get(mes);
      if (!prev) map.set(mes, { total: a.valor, count: 1 });
      else { prev.total += a.valor; prev.count += 1; }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({
        mes,
        mesLabel: mesLabel(mes),
        ticket: v.total / v.count,
        atendimentos: v.count,
      }));
  }, [filtered]);

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const totalFaturamento = useMemo(() => filtered.reduce((s, a) => s + a.valor, 0), [filtered]);
  const ticketMedioGeral = filtered.length > 0 ? totalFaturamento / filtered.length : 0;
  const ltvMedioClinica  = ltvPorPaciente.length > 0
    ? ltvPorPaciente.reduce((s, p) => s + p.total, 0) / ltvPorPaciente.length
    : 0;

  // ── Segmentação ───────────────────────────────────────────────────────────

  const segmentacao = useMemo(() => {
    const bronze = ltvPorPaciente.filter(p => p.faixa === 'bronze');
    const prata  = ltvPorPaciente.filter(p => p.faixa === 'prata');
    const ouro   = ltvPorPaciente.filter(p => p.faixa === 'ouro');
    const topProcs = (lista: LTVPaciente[]) => {
      const ids = new Set(lista.map(p => p.clienteId));
      const m = new Map<string, number>();
      for (const a of filtered) {
        if (!ids.has(a.clienteId)) continue;
        const proc = a.procedimento || '(sem procedimento)';
        m.set(proc, (m.get(proc) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
    };
    return { bronze, prata, ouro, topProcs };
  }, [ltvPorPaciente, filtered]);

  // ── Exports ───────────────────────────────────────────────────────────────

  const exportLTVcsv = () => {
    const rows = [
      ['#', 'Paciente', 'LTV Total', 'Atendimentos', 'Ticket Médio', 'Última Visita', 'Faixa'],
      ...ltvPorPaciente.slice(0, topLTVCount).map((p, i) => [
        String(i + 1), p.clienteNome,
        String(p.total.toFixed(2)), String(p.atendimentos),
        String(p.ticketMedio.toFixed(2)), p.ultimaVisita,
        FAIXA_META[p.faixa].label,
      ]),
    ];
    downloadCSV(rows, `ltv-pacientes-${fmtISO(new Date())}.csv`);
  };

  const exportProcCSV = () => {
    const rows = [
      ['#', 'Procedimento', 'Receita Total', 'Atendimentos', 'Ticket Médio'],
      ...rankingProcedimentos.map((p, i) => [
        String(i + 1), p.procedimento,
        String(p.receitaTotal.toFixed(2)), String(p.atendimentos),
        String(p.ticketMedio.toFixed(2)),
      ]),
    ];
    downloadCSV(rows, `procedimentos-rentabilidade-${fmtISO(new Date())}.csv`);
  };

  const exportBarPNG = () => {
    if (barSvgRef.current) exportSVGasPNG(barSvgRef.current, 'top-procedimentos.png');
  };

  const exportLinePNG = () => {
    if (lineSvgRef.current) exportSVGasPNG(lineSvgRef.current, 'ticket-medio-evolucao.png');
  };

  // ── Period helpers ────────────────────────────────────────────────────────

  const PERIODO_LABELS: Record<PeriodoPreset, string> = {
    '6meses':     'Últimos 6 meses',
    '12meses':    'Últimos 12 meses',
    'historico':  'Histórico completo',
    'personalizado': 'Personalizado',
  };

  const applyCustom = () => {
    const a = draftStart <= draftEnd ? draftStart : draftEnd;
    const b = draftStart <= draftEnd ? draftEnd : draftStart;
    setCustomStart(a); setCustomEnd(b);
    setPeriodoPreset('personalizado');
    setShowCustomPicker(false);
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const tabStyle = (t: ViewTab): React.CSSProperties => ({
    padding: '8px 16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
    borderRadius: '8px', transition: 'all 0.2s',
    background: viewTab === t ? 'var(--color-primary)' : 'transparent',
    color: viewTab === t ? '#fff' : 'var(--color-text-muted)',
  });

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
    borderRadius: '6px', transition: 'all 0.15s',
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-muted)',
  });

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '4px' }}>
            Rentabilidade & BI
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            LTV por paciente, ticket médio e procedimentos mais rentáveis.
          </p>
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#f8f8f6', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '4px' }}>
          <button style={tabStyle('dashboard')} onClick={() => setViewTab('dashboard')}>
            <BarChart2 size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Dashboard
          </button>
          <button style={tabStyle('ltv-paciente')} onClick={() => setViewTab('ltv-paciente')}>
            <User size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />LTV por Paciente
          </button>
          <button style={tabStyle('segmentacao')} onClick={() => setViewTab('segmentacao')}>
            <Award size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Segmentação
          </button>
        </div>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Calendar size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Período:</span>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f0', borderRadius: '8px', padding: '3px' }}>
              {(['6meses', '12meses', 'historico', 'personalizado'] as PeriodoPreset[]).map(p => (
                <button key={p} style={chipStyle(periodoPreset === p)}
                  onClick={() => {
                    if (p === 'personalizado') { setDraftStart(customStart); setDraftEnd(customEnd); setShowCustomPicker(true); }
                    else setPeriodoPreset(p);
                  }}>
                  {PERIODO_LABELS[p]}
                </button>
              ))}
            </div>
            {periodoPreset === 'personalizado' && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {customStart} → {customEnd}
              </span>
            )}
          </div>

          {/* Profissional */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={13} style={{ color: 'var(--color-text-muted)' }} />
            <select
              value={filtroProfissional}
              onChange={e => setFiltroProfissional(e.target.value)}
              style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff', color: 'var(--color-text-main)' }}
            >
              <option value="">Todos os profissionais</option>
              {profissionais.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Procedimento */}
          <div>
            <select
              value={filtroProcedimento}
              onChange={e => setFiltroProcedimento(e.target.value)}
              style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: '#fff', color: 'var(--color-text-main)' }}
            >
              <option value="">Todos os procedimentos</option>
              {procedimentosList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Custom picker modal ───────────────────────────────────────────── */}
      {showCustomPicker && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowCustomPicker(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '320px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Período personalizado</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>De:
                <input type="date" value={draftStart} onChange={e => setDraftStart(e.target.value)}
                  style={{ display: 'block', marginTop: '4px', width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Até:
                <input type="date" value={draftEnd} onChange={e => setDraftEnd(e.target.value)}
                  style={{ display: 'block', marginTop: '4px', width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowCustomPicker(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={applyCustom}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Carregando dados de rentabilidade…
        </div>
      )}

      {!loading && (
        <>
          {/* ══════════════════════════════════════════════════════════════════
              VIEW: DASHBOARD
          ══════════════════════════════════════════════════════════════════ */}
          {viewTab === 'dashboard' && (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                  {
                    label: 'LTV Médio por Paciente', value: fmtBRL(ltvMedioClinica),
                    sub: `${ltvPorPaciente.length} pacientes únicos`,
                    icon: <Users size={15} style={{ color: '#6b9e78' }} />, border: '#6b9e78',
                  },
                  {
                    label: 'Ticket Médio', value: fmtBRL(ticketMedioGeral),
                    sub: `${filtered.length} atendimentos`,
                    icon: <Activity size={15} style={{ color: '#8b7fc7' }} />, border: '#8b7fc7',
                  },
                  {
                    label: 'Faturamento Total', value: fmtBRL(totalFaturamento),
                    sub: `No período selecionado`,
                    icon: <DollarSign size={15} style={{ color: 'var(--color-success)' }} />, border: 'var(--color-success)',
                  },
                  {
                    label: 'Procedimentos Únicos', value: String(rankingProcedimentos.length),
                    sub: rankingProcedimentos[0] ? `Top: ${rankingProcedimentos[0].procedimento}` : 'Nenhum',
                    icon: <Star size={15} style={{ color: '#e67e22' }} />, border: '#e67e22',
                  },
                ].map(card => (
                  <div key={card.label} className="card" style={{ padding: '20px', borderLeft: `4px solid ${card.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{card.label}</span>
                      {card.icon}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '4px' }}>{card.value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Bar chart: top 10 procedimentos */}
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart2 size={15} style={{ color: 'var(--color-primary)' }} />
                      <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Top 10 Procedimentos por Receita</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button title="Exportar PNG" onClick={exportBarPNG}
                        style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        <Download size={12} /> PNG
                      </button>
                      <button title="Exportar CSV" onClick={exportProcCSV}
                        style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        <Download size={12} /> CSV
                      </button>
                    </div>
                  </div>
                  {rankingProcedimentos.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px 0' }}>
                      Nenhum dado no período selecionado.
                    </p>
                  ) : (
                    <HorizontalBarChart
                      svgRef={barSvgRef}
                      items={rankingProcedimentos.slice(0, 10).map(p => ({ label: p.procedimento, value: p.receitaTotal }))}
                    />
                  )}
                </div>

                {/* Line chart: ticket médio mensal */}
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={15} style={{ color: '#8b7fc7' }} />
                      <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Evolução do Ticket Médio</h3>
                    </div>
                    <button title="Exportar PNG" onClick={exportLinePNG}
                      style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      <Download size={12} /> PNG
                    </button>
                  </div>
                  {ticketMensal.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px 0' }}>
                      Nenhum dado no período selecionado.
                    </p>
                  ) : (
                    <LineChart
                      svgRef={lineSvgRef}
                      data={ticketMensal.map(m => ({ label: m.mesLabel, value: m.ticket }))}
                      color="#8b7fc7"
                    />
                  )}
                </div>
              </div>

              {/* Ranking table com alternância de ordenação */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Star size={15} style={{ color: '#e67e22' }} />
                    <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Ranking de Procedimentos</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', background: '#f8f8f6', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '3px' }}>
                    {([['receita', 'Por Receita'], ['atendimentos', 'Por Atendimentos'], ['ticket', 'Por Ticket Médio']] as [RankOrdem, string][]).map(([val, lbl]) => (
                      <button key={val} style={chipStyle(rankOrdem === val)} onClick={() => setRankOrdem(val)}>{lbl}</button>
                    ))}
                  </div>
                </div>

                {rankingProcedimentos.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>
                    Nenhum procedimento encontrado para o período e filtros selecionados.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                          {['#', 'Procedimento', 'Receita Total', 'Atendimentos', 'Ticket Médio'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: h === '#' || h === 'Atendimentos' ? 'center' : 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rankingProcedimentos.map((p, i) => (
                          <tr key={p.procedimento} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : '#fafaf8' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: i < 3 ? '#e67e22' : 'var(--color-text-muted)' }}>{i + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.procedimento}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-success)' }}>{fmtBRL(p.receitaTotal)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>{p.atendimentos}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#8b7fc7' }}>{fmtBRL(p.ticketMedio)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW: LTV POR PACIENTE
          ══════════════════════════════════════════════════════════════════ */}
          {viewTab === 'ltv-paciente' && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} style={{ color: 'var(--color-primary)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>LTV por Paciente</h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>({ltvPorPaciente.length} pacientes)</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '4px', background: '#f8f8f6', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '3px' }}>
                    <button style={chipStyle(topLTVCount === 20)} onClick={() => setTopLTVCount(20)}>Top 20</button>
                    <button style={chipStyle(topLTVCount === 50)} onClick={() => setTopLTVCount(50)}>Top 50</button>
                  </div>
                  <button onClick={exportLTVcsv}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                    <Download size={13} /> Exportar CSV
                  </button>
                </div>
              </div>

              {ltvPorPaciente.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px 0' }}>
                  Nenhum paciente com atendimentos finalizados no período selecionado.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                        {['#', 'Paciente', 'LTV Total', 'Atendimentos', 'Ticket Médio', 'Última Visita', 'Faixa'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: h === '#' || h === 'Atendimentos' ? 'center' : 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ltvPorPaciente.slice(0, topLTVCount).map((p, i) => (
                        <tr key={p.clienteId} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : '#fafaf8' }}>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: i < 3 ? '#6b9e78' : 'var(--color-text-muted)' }}>{i + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.clienteNome}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-success)' }}>{fmtBRL(p.total)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{p.atendimentos}</td>
                          <td style={{ padding: '10px 12px', color: '#8b7fc7', fontWeight: 600 }}>{fmtBRL(p.ticketMedio)}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                            {new Date(p.ultimaVisita + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td style={{ padding: '10px 12px' }}><FaixaBadge faixa={p.faixa} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW: SEGMENTAÇÃO
          ══════════════════════════════════════════════════════════════════ */}
          {viewTab === 'segmentacao' && (
            <>
              {/* Threshold config */}
              <div className="card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={14} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>Faixas de LTV</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Bronze: até {fmtBRL(threshBronze)} · Prata: {fmtBRL(threshBronze)}–{fmtBRL(threshPrata)} · Ouro: acima de {fmtBRL(threshPrata)}
                    </span>
                  </div>
                  {!editingThresh ? (
                    <button onClick={() => { setDraftBronze(threshBronze); setDraftPrata(threshPrata); setEditingThresh(true); }}
                      style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      Configurar thresholds
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Bronze ≤
                        <input type="number" min="0" step="100" value={draftBronze}
                          onChange={e => setDraftBronze(Number(e.target.value))}
                          style={{ width: '90px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '12px' }} />
                      </label>
                      <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Prata ≤
                        <input type="number" min="0" step="100" value={draftPrata}
                          onChange={e => setDraftPrata(Number(e.target.value))}
                          style={{ width: '90px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '12px' }} />
                      </label>
                      <button className="btn btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}
                        onClick={() => { setThreshBronze(draftBronze); setThreshPrata(draftPrata); setEditingThresh(false); }}>
                        Salvar
                      </button>
                      <button className="btn btn-outline" style={{ fontSize: '12px', padding: '5px 12px' }}
                        onClick={() => setEditingThresh(false)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Segmentation cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {([
                  { faixa: 'bronze' as FaixaLTV, list: segmentacao.bronze },
                  { faixa: 'prata'  as FaixaLTV, list: segmentacao.prata  },
                  { faixa: 'ouro'   as FaixaLTV, list: segmentacao.ouro   },
                ]).map(({ faixa, list }) => {
                  const m = FAIXA_META[faixa];
                  const ltvMedio = list.length > 0 ? list.reduce((s, p) => s + p.total, 0) / list.length : 0;
                  const topProcs = segmentacao.topProcs(list);
                  return (
                    <div key={faixa} className="card" style={{ padding: '24px', borderTop: `4px solid ${m.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: m.color }}>{m.label}</span>
                        </div>
                        <span style={{ fontSize: '26px', fontWeight: 700 }}>{list.length}</span>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>LTV médio</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: m.color }}>{fmtBRL(ltvMedio)}</div>
                      </div>
                      {topProcs.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px', fontWeight: 600 }}>Procedimentos mais consumidos</div>
                          {topProcs.map(proc => (
                            <div key={proc} style={{ fontSize: '12px', padding: '4px 8px', background: m.bg, borderRadius: '6px', marginBottom: '4px', color: m.color, fontWeight: 500 }}>
                              {proc}
                            </div>
                          ))}
                        </div>
                      )}
                      {list.length === 0 && (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '12px' }}>
                          Nenhum paciente nesta faixa.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Lista detalhada por faixa */}
              {(['ouro', 'prata', 'bronze'] as FaixaLTV[]).map(faixa => {
                const list = faixa === 'ouro' ? segmentacao.ouro : faixa === 'prata' ? segmentacao.prata : segmentacao.bronze;
                if (list.length === 0) return null;
                const m = FAIXA_META[faixa];
                return (
                  <div key={faixa} className="card" style={{ padding: '20px 24px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <FaixaBadge faixa={faixa} />
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{list.length} paciente{list.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {list.slice(0, 20).map(p => (
                        <div key={p.clienteId} style={{ padding: '6px 12px', background: m.bg, borderRadius: '8px', fontSize: '12px', color: m.color, fontWeight: 600 }}>
                          {p.clienteNome}
                          <span style={{ marginLeft: '6px', opacity: 0.8, fontWeight: 400 }}>{fmtBRL(p.total)}</span>
                        </div>
                      ))}
                      {list.length > 20 && (
                        <div style={{ padding: '6px 12px', background: '#f1f5f0', borderRadius: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          +{list.length - 20} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
};
