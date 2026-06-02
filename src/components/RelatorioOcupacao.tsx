import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3,
  Users,
  Clock,
  TrendingUp,
  AlertCircle,
  Download,
  Printer,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import type { Agendamento, Procedimento } from '../types';
import { api } from '../lib/api';

interface Props {
  userId: string;
}

// ── Period helpers (same pattern as Gestao) ──────────────────────────────

type PresetPeriodo = 'hoje' | '7dias' | '30dias' | 'mes' | 'personalizado';

const fmtISO = (d: Date) => d.toISOString().split('T')[0];

function getPeriodoRange(preset: PresetPeriodo, custom?: { start: string; end: string }) {
  const today = new Date();
  switch (preset) {
    case 'hoje':      return { start: fmtISO(today), end: fmtISO(today) };
    case '7dias':     { const d = new Date(today); d.setDate(d.getDate() - 6); return { start: fmtISO(d), end: fmtISO(today) }; }
    case '30dias':    { const d = new Date(today); d.setDate(d.getDate() - 29); return { start: fmtISO(d), end: fmtISO(today) }; }
    case 'mes':       { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { start: fmtISO(s), end: fmtISO(today) }; }
    case 'personalizado': return { start: custom?.start || fmtISO(today), end: custom?.end || fmtISO(today) };
  }
}

function parseDuration(horaInicio: string, horaFim: string): number {
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFim.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  return Math.max(0, mins);
}

function countWorkingDays(start: string, end: string): number {
  let count = 0;
  const d = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  while (d <= e) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 6) count++; // Mon-Sat
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function countWeekdaysInPeriod(start: string, end: string): number[] {
  // Returns [Mon count, Tue count, ..., Sat count]
  const counts = [0, 0, 0, 0, 0, 0];
  const d = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  while (d <= e) {
    const dow = d.getDay(); // 0=Sun, 1=Mon...6=Sat
    if (dow >= 1 && dow <= 6) counts[dow - 1]++;
    d.setDate(d.getDate() + 1);
  }
  return counts;
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Heatmap color based on normalized count ──────────────────────────────

function heatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#f8fafc';
  const ratio = value / max;
  if (ratio < 0.25) return '#d1fae5';
  if (ratio < 0.5)  return '#6ee7b7';
  if (ratio < 0.75) return '#fcd34d';
  return '#f97316';
}

function heatTextColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#cbd5e1';
  const ratio = value / max;
  return ratio >= 0.5 ? '#1c1917' : '#374151';
}

// ── Simple CSS bar ────────────────────────────────────────────────────────

function OccupancyBar({ pct, color = 'var(--color-primary)' }: { pct: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '38px', color: '#374151' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CLINIC_HOURS_PER_DAY = 10; // 08h–18h

export const RelatorioOcupacao: React.FC<Props> = ({ userId }) => {
  const [preset, setPreset] = useState<PresetPeriodo>('30dias');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterProfissional, setFilterProfissional] = useState('');

  const { start, end } = getPeriodoRange(preset, { start: customStart, end: customEnd });
  const today = fmtISO(new Date());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAgendamentosRange(userId, start, end),
      api.getProcedimentos(userId),
    ])
      .then(([ags, procs]) => {
        // Only past/today appointments (RN: occupancy only for past days)
        setAgendamentos(ags.filter(a => a.data <= today));
        setProcedimentos(procs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [start, end, userId]);

  // All profissionais in data
  const allProfissionais = useMemo(
    () => [...new Set(agendamentos.map(a => a.profissional).filter(Boolean))].sort(),
    [agendamentos]
  );

  // Filter by selected professional
  const filtered = useMemo(
    () => filterProfissional ? agendamentos.filter(a => a.profissional === filterProfissional) : agendamentos,
    [agendamentos, filterProfissional]
  );

  const workingDays = useMemo(() => countWorkingDays(start, end), [start, end]);
  const weekdayCounts = useMemo(() => countWeekdaysInPeriod(start, end), [start, end]);

  // ── Global KPIs ──────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const nonFalta = filtered.filter(a => a.presencaStatus !== 'faltou');
    const falta = filtered.filter(a => a.presencaStatus === 'faltou');
    const totalDurationMin = nonFalta.reduce((s, a) => s + parseDuration(a.horaInicio, a.horaFim), 0);
    const nProfs = allProfissionais.length || 1;
    const availableMin = workingDays * CLINIC_HOURS_PER_DAY * 60 * nProfs;
    const occupancyPct = availableMin > 0 ? (totalDurationMin / availableMin) * 100 : 0;
    const ticketMedio = nonFalta.length > 0 ? nonFalta.reduce((s, a) => s + a.valor, 0) / nonFalta.length : 0;
    const noShowRate = filtered.length > 0 ? (falta.length / filtered.length) * 100 : 0;
    return { occupancyPct, totalAppointments: filtered.length, ticketMedio, noShowRate, totalDurationMin };
  }, [filtered, workingDays, allProfissionais]);

  // ── Metrics by professional ──────────────────────────────────────────────

  const profMetrics = useMemo(() => {
    return allProfissionais.map(prof => {
      const appts = agendamentos.filter(a => a.profissional === prof);
      const nonFalta = appts.filter(a => a.presencaStatus !== 'faltou');
      const falta = appts.filter(a => a.presencaStatus === 'faltou');
      const totalMin = nonFalta.reduce((s, a) => s + parseDuration(a.horaInicio, a.horaFim), 0);
      const availableMin = workingDays * CLINIC_HOURS_PER_DAY * 60;
      const occupancyPct = availableMin > 0 ? (totalMin / availableMin) * 100 : 0;
      const ticketMedio = nonFalta.length > 0 ? nonFalta.reduce((s, a) => s + a.valor, 0) / nonFalta.length : 0;
      const avgDuration = nonFalta.length > 0 ? totalMin / nonFalta.length : 0;
      const noShowRate = appts.length > 0 ? (falta.length / appts.length) * 100 : 0;
      return { prof, totalAppointments: appts.length, nonFalta: nonFalta.length, falta: falta.length, totalMin, occupancyPct, ticketMedio, avgDuration, noShowRate };
    }).sort((a, b) => b.occupancyPct - a.occupancyPct);
  }, [agendamentos, workingDays, allProfissionais]);

  // ── Metrics by sala ──────────────────────────────────────────────────────

  const salaMetrics = useMemo(() => {
    const salas = [...new Set(agendamentos.map(a => a.sala).filter(Boolean))].sort();
    const availableMin = workingDays * CLINIC_HOURS_PER_DAY * 60;
    return salas.map(sala => {
      const appts = agendamentos.filter(a => a.sala === sala && a.presencaStatus !== 'faltou');
      const totalMin = appts.reduce((s, a) => s + parseDuration(a.horaInicio, a.horaFim), 0);
      const occupancyPct = availableMin > 0 ? (totalMin / availableMin) * 100 : 0;
      return { sala, totalAppointments: appts.length, totalMin, availableMin, occupancyPct };
    }).sort((a, b) => b.occupancyPct - a.occupancyPct);
  }, [agendamentos, workingDays]);

  const salaResumo = useMemo(() => {
    if (salaMetrics.length === 0) return null;
    const totalOcupadas = salaMetrics.reduce((s, m) => s + m.totalMin, 0);
    const totalDisponiveis = salaMetrics[0].availableMin * salaMetrics.length;
    const mediaOcupacao = totalDisponiveis > 0 ? (totalOcupadas / totalDisponiveis) * 100 : 0;
    return {
      totalDisponiveisH: Math.round(totalDisponiveis / 60),
      totalOcupadasH: Math.round(totalOcupadas / 60),
      mediaOcupacao,
      maisMaior: salaMetrics[0],
      maisOciosa: salaMetrics[salaMetrics.length - 1],
    };
  }, [salaMetrics]);

  // ── Heatmap data ─────────────────────────────────────────────────────────
  // heatmap[dayIndex 0=Mon..5=Sat][hourIndex 0=08h..10=18h]

  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 6 }, () => Array(11).fill(0));
    filtered.filter(a => a.presencaStatus !== 'faltou').forEach(a => {
      const dow = new Date(a.data + 'T12:00:00').getDay(); // 0=Sun,1=Mon..6=Sat
      const dayIdx = dow === 0 ? -1 : dow - 1; // Mon=0..Sat=5
      if (dayIdx < 0) return;
      const hour = parseInt(a.horaInicio.split(':')[0]);
      const hIdx = hour - 8;
      if (hIdx >= 0 && hIdx <= 10) grid[dayIdx][hIdx]++;
    });
    // Normalize per weekday count
    const normalized: number[][] = grid.map((row, di) =>
      row.map(v => weekdayCounts[di] > 0 ? v / weekdayCounts[di] : 0)
    );
    return normalized;
  }, [filtered, weekdayCounts]);

  const heatMax = useMemo(() => Math.max(...heatmap.flat(), 0.01), [heatmap]);

  // ── Productivity: avg actual vs configured ────────────────────────────────

  const produtividadeProc = useMemo(() => {
    const procMap = new Map(procedimentos.map(p => [p.nome.toLowerCase(), p.duracaoMinutos]));
    const grouped = new Map<string, { total: number; count: number; valor: number }>();
    filtered.filter(a => a.presencaStatus !== 'faltou').forEach(a => {
      const dur = parseDuration(a.horaInicio, a.horaFim);
      const key = a.procedimento;
      const curr = grouped.get(key) ?? { total: 0, count: 0, valor: 0 };
      grouped.set(key, { total: curr.total + dur, count: curr.count + 1, valor: curr.valor + a.valor });
    });
    return [...grouped.entries()].map(([nome, d]) => {
      const configured = procMap.get(nome.toLowerCase()) ?? null;
      const avgReal = d.count > 0 ? d.total / d.count : 0;
      const avgValor = d.count > 0 ? d.valor / d.count : 0;
      return { nome, count: d.count, avgReal, configured, avgValor };
    }).sort((a, b) => b.count - a.count);
  }, [filtered, procedimentos]);

  // ── No-show by hour ───────────────────────────────────────────────────────

  const noShowByHour = useMemo(() => {
    const hourMap = new Map<number, { total: number; falta: number }>();
    agendamentos.forEach(a => {
      const h = parseInt(a.horaInicio.split(':')[0]);
      const curr = hourMap.get(h) ?? { total: 0, falta: 0 };
      hourMap.set(h, {
        total: curr.total + 1,
        falta: curr.falta + (a.presencaStatus === 'faltou' ? 1 : 0),
      });
    });
    return [...hourMap.entries()]
      .map(([h, d]) => ({ hora: `${String(h).padStart(2, '0')}:00`, rate: d.total > 0 ? (d.falta / d.total) * 100 : 0, falta: d.falta, total: d.total }))
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }, [agendamentos]);

  // ── CSV export ────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const lines: string[] = [
      'Relatório de Ocupação — Lumia CRM',
      `Período: ${start} a ${end}`,
      '',
      'OCUPAÇÃO POR PROFISSIONAL',
      'Profissional,Agendamentos,Taxa de Ocupação (%),Ticket Médio (R$),Duração Média (min),No-Show (%)',
      ...profMetrics.map(m =>
        `"${m.prof}",${m.nonFalta},${m.occupancyPct.toFixed(1)},${m.ticketMedio.toFixed(2)},${m.avgDuration.toFixed(0)},${m.noShowRate.toFixed(1)}`
      ),
      '',
      'OCUPAÇÃO POR SALA',
      'Sala,Agendamentos,Taxa de Ocupação (%)',
      ...salaMetrics.map(m =>
        `"${m.sala}",${m.totalAppointments},${m.occupancyPct.toFixed(1)}`
      ),
      '',
      'PRODUTIVIDADE POR PROCEDIMENTO',
      'Procedimento,Qtd,Duração Real Média (min),Duração Configurada (min),Ticket Médio (R$)',
      ...produtividadeProc.map(p =>
        `"${p.nome}",${p.count},${p.avgReal.toFixed(0)},${p.configured ?? 'N/A'},${p.avgValor.toFixed(2)}`
      ),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-ocupacao-${start}-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const occupancyColor = (pct: number) => pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626';

  return (
    <div id="relatorio-ocupacao-print" style={{ padding: '0 0 40px' }}>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 500 }}>
          <Calendar size={15} /> Período:
        </div>
        {(['7dias', '30dias', 'mes', 'personalizado'] as PresetPeriodo[]).map(p => {
          const labels: Record<string, string> = { '7dias': 'Últimos 7 dias', '30dias': 'Últimos 30 dias', mes: 'Mês Atual', personalizado: 'Personalizado' };
          return (
            <button
              key={p}
              onClick={() => setPreset(p)}
              style={{
                fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid',
                borderColor: preset === p ? 'var(--color-primary)' : 'var(--color-border)',
                background: preset === p ? 'var(--color-primary)' : '#fff',
                color: preset === p ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer', fontWeight: preset === p ? 600 : 400,
              }}
            >
              {labels[p]}
            </button>
          );
        })}
        {preset === 'personalizado' && (
          <>
            <input type="date" className="form-input" style={{ fontSize: '13px', padding: '5px 10px' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>até</span>
            <input type="date" className="form-input" style={{ fontSize: '13px', padding: '5px 10px' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </>
        )}
        {/* Professional filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ fontSize: '13px', padding: '5px 10px', minWidth: '160px' }}
            value={filterProfissional}
            onChange={e => setFilterProfissional(e.target.value)}
          >
            <option value="">Todos os profissionais</option>
            {allProfissionais.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="btn btn-outline" style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={handleExportCSV}>
            <Download size={13} /> Excel
          </button>
          <button className="btn btn-outline" style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => window.print()}>
            <Printer size={13} /> PDF
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Calculando métricas de ocupação...
        </div>
      )}

      {!loading && (
        <>
          {/* ── KPI Cards ─────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {[
              {
                icon: <TrendingUp size={18} />,
                label: 'Taxa de Ocupação Média',
                value: `${kpis.occupancyPct.toFixed(1)}%`,
                sub: `${workingDays} dias úteis`,
                color: occupancyColor(kpis.occupancyPct),
              },
              {
                icon: <Users size={18} />,
                label: 'Atendimentos Realizados',
                value: `${kpis.totalAppointments}`,
                sub: `${fmtMinutes(kpis.totalDurationMin)} no total`,
                color: '#2563eb',
              },
              {
                icon: <BarChart3 size={18} />,
                label: 'Ticket Médio',
                value: fmtBRL(kpis.ticketMedio),
                sub: 'por atendimento',
                color: '#7c3aed',
              },
              {
                icon: <AlertCircle size={18} />,
                label: 'Taxa de No-Show',
                value: `${kpis.noShowRate.toFixed(1)}%`,
                sub: `${agendamentos.filter(a => a.presencaStatus === 'faltou').length} faltas`,
                color: kpis.noShowRate > 15 ? '#dc2626' : '#d97706',
              },
            ].map(card => (
              <div key={card.label} className="card" style={{ padding: '20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: card.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
                  {card.icon}
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{card.label}</p>
                  <p style={{ fontSize: '22px', fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</p>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{card.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Heatmap ───────────────────────────────────────────────────── */}
          <div className="card" style={{ padding: '24px 28px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Clock size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Mapa de Calor — Ocupação por Horário</h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              Média de atendimentos por slot de 1h. Valores normalizados pela quantidade de cada dia da semana no período.
            </p>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Ocupação:</span>
              {[
                { color: '#f8fafc', label: 'Vazio' },
                { color: '#d1fae5', label: 'Baixa' },
                { color: '#6ee7b7', label: 'Média' },
                { color: '#fcd34d', label: 'Alta' },
                { color: '#f97316', label: 'Pico' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '14px', height: '14px', background: l.color, border: '1px solid #e2e8f0', borderRadius: '3px' }} />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{l.label}</span>
                </div>
              ))}
            </div>

            <ScrollTableWrapper>
              <table style={{ borderCollapse: 'separate', borderSpacing: '3px', minWidth: '500px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '52px', fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right', paddingRight: '8px', fontWeight: 400 }}></th>
                    {DIAS_SEMANA.map(d => (
                      <th key={d} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center', padding: '0 4px 8px' }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HORAS.map((h, hIdx) => (
                    <tr key={h}>
                      <td style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap' }}>
                        {String(h).padStart(2, '0')}:00
                      </td>
                      {DIAS_SEMANA.map((_, dIdx) => {
                        const val = heatmap[dIdx][hIdx];
                        return (
                          <td
                            key={dIdx}
                            title={`${DIAS_SEMANA[dIdx]} ${String(h).padStart(2, '0')}:00 — média ${val.toFixed(1)} atend.`}
                            style={{
                              width: '56px', height: '32px',
                              background: heatColor(val, heatMax),
                              borderRadius: '5px',
                              textAlign: 'center',
                              fontSize: '11px',
                              fontWeight: 500,
                              color: heatTextColor(val, heatMax),
                              cursor: 'default',
                            }}
                          >
                            {val > 0 ? val.toFixed(1) : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTableWrapper>
          </div>

          {/* ── Occupancy by Professional + Room (2 col) ────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>

            {/* By professional */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Users size={16} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Ocupação por Profissional</h3>
              </div>
              {profMetrics.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px' }}>Sem dados no período.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {profMetrics.map(m => (
                    <div key={m.prof}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{m.prof}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{m.nonFalta} atend.</span>
                      </div>
                      <OccupancyBar pct={m.occupancyPct} color={occupancyColor(m.occupancyPct)} />
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Ticket: {fmtBRL(m.ticketMedio)}
                        </span>
                        {m.noShowRate > 0 && (
                          <span style={{ fontSize: '11px', color: '#dc2626' }}>
                            No-show: {m.noShowRate.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By sala — SALA-004: executive summary + bar chart + detail table */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Ocupação por Sala</h3>
              </div>

              {salaMetrics.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px' }}>Sem dados no período.</p>
              ) : (
                <>
                  {/* Executive summary */}
                  {salaResumo && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                      {[
                        { label: 'Horas Disponíveis', value: `${salaResumo.totalDisponiveisH}h` },
                        { label: 'Horas Ocupadas', value: `${salaResumo.totalOcupadasH}h` },
                        { label: 'Ocupação Média', value: `${salaResumo.mediaOcupacao.toFixed(0)}%` },
                        { label: 'Maior Demanda', value: salaResumo.maisMaior.sala },
                        { label: 'Mais Ociosa', value: salaResumo.maisOciosa.sala },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: 'var(--color-primary-light)', borderRadius: 'var(--border-radius-sm)', padding: '10px 12px', border: '1px solid var(--color-border)' }}>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{label}</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bar chart */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                    {salaMetrics.map(m => (
                      <div key={m.sala}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>{m.sala}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{m.totalAppointments} atend. · {fmtMinutes(m.totalMin)}</span>
                        </div>
                        <OccupancyBar pct={m.occupancyPct} color='#7c3aed' />
                      </div>
                    ))}
                  </div>

                  {/* Detail table */}
                  <ScrollTableWrapper>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                          {['Sala', 'Ocupação', 'Agendamentos', 'H. Ocupadas', 'H. Disponíveis', 'Ranking'].map((h, i) => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', ...(i === 0 ? { position: 'sticky', left: 0, background: '#F5F3F0', zIndex: 1 } : {}) }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {salaMetrics.map((m, i) => {
                          const rankColor = m.occupancyPct >= 70 ? { bg: '#d1fae5', text: '#065f46', label: '≥70%' }
                            : m.occupancyPct >= 50 ? { bg: '#fef9c3', text: '#713f12', label: '50–70%' }
                            : { bg: '#fee2e2', text: '#991b1b', label: '<50%' };
                          return (
                            <tr key={m.sala} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1 }}>{m.sala}</td>
                              <td style={{ padding: '8px 10px' }}>{m.occupancyPct.toFixed(1)}%</td>
                              <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>{m.totalAppointments}</td>
                              <td style={{ padding: '8px 10px' }}>{fmtMinutes(m.totalMin)}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)' }}>{fmtMinutes(m.availableMin)}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ background: rankColor.bg, color: rankColor.text, fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px' }}>
                                  {rankColor.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollTableWrapper>
                </>
              )}
            </div>
          </div>

          {/* ── Productivity table ───────────────────────────────────────── */}
          <div className="card" style={{ padding: '24px 28px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Produtividade por Procedimento</h3>
            </div>
            {produtividadeProc.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px' }}>Sem dados no período.</p>
            ) : (
              <ScrollTableWrapper>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      {['Procedimento', 'Qtd', 'Duração Real (avg)', 'Duração Config.', 'Δ Duração', 'Ticket Médio'].map((h, i) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', ...(i === 0 ? { position: 'sticky', left: 0, background: '#F5F3F0', zIndex: 1 } : {}) }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {produtividadeProc.map((p, i) => {
                      const delta = p.configured !== null ? p.avgReal - p.configured : null;
                      return (
                        <tr key={p.nome} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 500, position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1 }}>{p.nome}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{p.count}</td>
                          <td style={{ padding: '10px 12px' }}>{fmtMinutes(Math.round(p.avgReal))}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                            {p.configured !== null ? fmtMinutes(p.configured) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {delta !== null ? (
                              <span style={{ fontSize: '12px', fontWeight: 500, color: delta > 5 ? '#dc2626' : delta < -5 ? '#16a34a' : '#6b7280' }}>
                                {delta > 0 ? '+' : ''}{Math.round(delta)}min
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 500 }}>{fmtBRL(p.avgValor)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollTableWrapper>
            )}
          </div>

          {/* ── No-show por horário ──────────────────────────────────────── */}
          {noShowByHour.some(h => h.falta > 0) && (
            <div className="card" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <AlertCircle size={16} style={{ color: '#dc2626' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>No-Show por Horário do Dia</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {noShowByHour.filter(h => h.total > 0).map(h => (
                  <div key={h.hora} style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{
                      height: '60px', width: '44px', margin: '0 auto',
                      background: h.rate > 20 ? '#fef2f2' : h.rate > 10 ? '#fffbeb' : '#f0fdf4',
                      border: `1px solid ${h.rate > 20 ? '#fecaca' : h.rate > 10 ? '#fde68a' : '#bbf7d0'}`,
                      borderRadius: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 600,
                      color: h.rate > 20 ? '#dc2626' : h.rate > 10 ? '#d97706' : '#16a34a',
                    }}>
                      {h.rate.toFixed(0)}%
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{h.hora}</p>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{h.falta}/{h.total}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '12px' }}>
                Horários com maior taxa de no-show. Ideal para ajustar política de confirmação automática.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── ScrollTableWrapper ───────────────────────────────────────────────────────

const ScrollTableWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setShowFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, []);
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={{ overflowX: 'auto' }}>
        {children}
      </div>
      {showFade && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 56,
          background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.92))',
          pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10,
        }}>
          <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', opacity: 0.7 }} />
        </div>
      )}
    </div>
  );
};
