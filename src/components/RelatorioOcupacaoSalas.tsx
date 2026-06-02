import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Download, Printer, DoorOpen, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { Agendamento, Sala } from '../types';

interface Props {
  userId: string;
}

type Preset = 'semana' | 'mes' | 'trimestre' | 'ano' | 'personalizado';

// ── Helpers ─────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function getRange(preset: Preset, custom: { start: string; end: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'semana': {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return { start: toISO(mon), end: toISO(today) };
    }
    case 'mes': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toISO(s), end: toISO(today) };
    }
    case 'trimestre': {
      const s = new Date(today); s.setDate(today.getDate() - 89);
      return { start: toISO(s), end: toISO(today) };
    }
    case 'ano': {
      const s = new Date(today.getFullYear(), 0, 1);
      return { start: toISO(s), end: toISO(today) };
    }
    case 'personalizado':
      return { start: custom.start || toISO(today), end: custom.end || toISO(today) };
  }
}

function getPrevRange(_preset: Preset, range: { start: string; end: string }) {
  const s = new Date(range.start + 'T12:00:00');
  const e = new Date(range.end + 'T12:00:00');
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(s); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1);
  return { start: toISO(prevStart), end: toISO(prevEnd) };
}

// Conta dias úteis (Seg-Sáb) em um intervalo
function countWorkDays(start: string, end: string): number {
  let count = 0;
  const d = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  while (d <= e) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Duração em minutos de um agendamento
function durationMin(ag: Agendamento): number {
  const [h1, m1] = ag.horaInicio.split(':').map(Number);
  const [h2, m2] = ag.horaFim.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}

const CLINIC_HOURS_PER_DAY = 9; // 09h–18h por padrão

interface SalaMetrica {
  sala: Sala;
  qtdAgendamentos: number;
  minutosOcupados: number;
  minutosDisponiveis: number;
  pct: number;
  ranking: 'alta' | 'media' | 'baixa'; // >70% | 50-70% | <50%
}

// ── Bar chart horizontal puro CSS ────────────────────────────────────────────

function HBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 20, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${Math.min(pct, 100)}%`,
        background: color, borderRadius: 4,
        transition: 'width 0.5s ease-out',
      }} />
    </div>
  );
}

function rankColor(r: SalaMetrica['ranking']) {
  if (r === 'alta') return { bar: '#16a34a', badge: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' } };
  if (r === 'media') return { bar: '#d97706', badge: { bg: '#fef3c7', color: '#a16207', border: '#fde68a' } };
  return { bar: '#dc2626', badge: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' } };
}

function fmtHoras(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ── Componente principal ─────────────────────────────────────────────────────

export const RelatorioOcupacaoSalas: React.FC<Props> = ({ userId }) => {
  const [preset, setPreset] = useState<Preset>('mes');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [comparar, setComparar] = useState(false);

  const [salas, setSalas] = useState<Sala[]>([]);
  const [ags, setAgs] = useState<Agendamento[]>([]);
  const [agsPrev, setAgsPrev] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => getRange(preset, custom), [preset, custom]);
  const prevRange = useMemo(() => getPrevRange(preset, range), [preset, range]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [salasData, agData] = await Promise.all([
        api.getSalasAll(userId),
        api.getAgendamentosRange(userId, range.start, range.end),
      ]);
      setSalas(salasData.filter(s => s.ativo));
      setAgs(agData.filter(a => a.roomId));
      if (comparar) {
        const prevData = await api.getAgendamentosRange(userId, prevRange.start, prevRange.end);
        setAgsPrev(prevData.filter(a => a.roomId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId, range, prevRange, comparar]);

  useEffect(() => { load(); }, [load]);

  // Calcular métricas por sala
  const metricas = useMemo((): SalaMetrica[] => {
    const workDays = countWorkDays(range.start, range.end);
    const minDisponiveis = workDays * CLINIC_HOURS_PER_DAY * 60;
    return salas.map(sala => {
      const salasAgs = ags.filter(a => a.roomId === sala.id);
      const minOcupados = salasAgs.reduce((sum, a) => sum + durationMin(a), 0);
      const pct = minDisponiveis > 0 ? Math.round((minOcupados / minDisponiveis) * 100) : 0;
      const ranking: SalaMetrica['ranking'] = pct >= 70 ? 'alta' : pct >= 50 ? 'media' : 'baixa';
      return {
        sala,
        qtdAgendamentos: salasAgs.length,
        minutosOcupados: minOcupados,
        minutosDisponiveis: minDisponiveis,
        pct,
        ranking,
      };
    }).sort((a, b) => b.pct - a.pct);
  }, [salas, ags, range]);

  const metricasPrev = useMemo((): Map<string, number> => {
    if (!comparar) return new Map();
    const workDays = countWorkDays(prevRange.start, prevRange.end);
    const minDisponiveis = workDays * CLINIC_HOURS_PER_DAY * 60;
    const m = new Map<string, number>();
    salas.forEach(sala => {
      const salasAgs = agsPrev.filter(a => a.roomId === sala.id);
      const minOcupados = salasAgs.reduce((sum, a) => sum + durationMin(a), 0);
      const pct = minDisponiveis > 0 ? Math.round((minOcupados / minDisponiveis) * 100) : 0;
      m.set(sala.id, pct);
    });
    return m;
  }, [comparar, salas, agsPrev, prevRange]);

  // Resumo executivo
  const totalMinDisponiveis = metricas.reduce((s, m) => s + m.minutosDisponiveis, 0);
  const totalMinOcupados = metricas.reduce((s, m) => s + m.minutosOcupados, 0);
  const ocupacaoMedia = totalMinDisponiveis > 0
    ? Math.round((totalMinOcupados / totalMinDisponiveis) * 100) : 0;
  const maisOciosa = [...metricas].sort((a, b) => a.pct - b.pct)[0];
  const maisDemandada = [...metricas].sort((a, b) => b.pct - a.pct)[0];

  // ── Export CSV ────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Sala', 'Ocupação %', 'Agendamentos', 'Horas Ocupadas', 'Horas Disponíveis', 'Ranking'],
      ...metricas.map(m => [
        m.sala.nome,
        `${m.pct}%`,
        String(m.qtdAgendamentos),
        fmtHoras(m.minutosOcupados),
        fmtHoras(m.minutosDisponiveis),
        m.ranking === 'alta' ? 'Alta (>70%)' : m.ranking === 'media' ? 'Média (50-70%)' : 'Baixa (<50%)',
      ]),
      [],
      ['Resumo Executivo'],
      ['Ocupação Média', `${ocupacaoMedia}%`],
      ['Total Horas Disponíveis', fmtHoras(totalMinDisponiveis)],
      ['Total Horas Ocupadas', fmtHoras(totalMinOcupados)],
      ['Sala mais ociosa', maisOciosa ? `${maisOciosa.sala.nome} (${maisOciosa.pct}%)` : '—'],
      ['Sala mais demandada', maisDemandada ? `${maisDemandada.sala.nome} (${maisDemandada.pct}%)` : '—'],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocupacao-salas-${range.start}-${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const labelPreset: Record<Preset, string> = {
    semana: 'Esta Semana', mes: 'Este Mês', trimestre: 'Últimos 90 dias',
    ano: 'Este Ano', personalizado: 'Personalizado',
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DoorOpen size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text-main)' }}>
              Ocupação de Salas
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              {range.start !== range.end
                ? `${new Date(range.start + 'T12:00:00').toLocaleDateString('pt-BR')} – ${new Date(range.end + 'T12:00:00').toLocaleDateString('pt-BR')}`
                : new Date(range.start + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={btnOutline} title="Exportar CSV (Excel)">
            <Download size={14} /> Excel
          </button>
          <button onClick={() => window.print()} style={btnOutline} title="Imprimir / Salvar PDF">
            <Printer size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Controles de período */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['semana', 'mes', 'trimestre', 'ano', 'personalizado'] as Preset[]).map(p => (
            <button key={p} onClick={() => setPreset(p)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              border: '1px solid',
              borderColor: preset === p ? 'var(--color-primary)' : 'var(--color-border)',
              background: preset === p ? 'var(--color-primary-light)' : 'transparent',
              color: preset === p ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}>{labelPreset[p]}</button>
          ))}
        </div>
        {preset === 'personalizado' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))} style={inputDate} />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>até</span>
            <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))} style={inputDate} />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)', cursor: 'pointer', marginLeft: 4 }}>
          <input type="checkbox" checked={comparar} onChange={e => setComparar(e.target.checked)} />
          Comparar com período anterior
        </label>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
          Calculando métricas...
        </div>
      ) : salas.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
          Nenhuma sala ativa encontrada. Cadastre salas em "Salas de Atendimento".
        </div>
      ) : (
        <>
          {/* Resumo executivo */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12, marginBottom: 24,
          }}>
            <KPICard label="Ocupação Média" value={`${ocupacaoMedia}%`} color="var(--color-primary)" />
            <KPICard label="Horas Disponíveis" value={fmtHoras(totalMinDisponiveis)} color="var(--color-text-muted)" />
            <KPICard label="Horas Ocupadas" value={fmtHoras(totalMinOcupados)} color="var(--color-success, #16a34a)" />
            {maisOciosa && (
              <KPICard
                label="Maior Ociosidade"
                value={maisOciosa.sala.nome}
                sub={`${maisOciosa.pct}% ocupada`}
                color="#dc2626"
                icon={<TrendingDown size={14} />}
              />
            )}
            {maisDemandada && maisDemandada.sala.id !== maisOciosa?.sala.id && (
              <KPICard
                label="Maior Demanda"
                value={maisDemandada.sala.nome}
                sub={`${maisDemandada.pct}% ocupada`}
                color="#16a34a"
                icon={<TrendingUp size={14} />}
              />
            )}
          </div>

          {/* Gráfico de barras horizontal */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12,
            border: '1px solid var(--color-border)', padding: 24, marginBottom: 20,
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: 'var(--color-text-main)' }}>
              Taxa de Ocupação por Sala
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {metricas.map(m => {
                const col = rankColor(m.ranking);
                const prevPct = metricasPrev.get(m.sala.id);
                const delta = comparar && prevPct !== undefined ? m.pct - prevPct : null;
                return (
                  <div key={m.sala.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <DoorOpen size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-main)', minWidth: 140 }}>
                        {m.sala.nome}
                      </span>
                      {delta !== null && (
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#64748b',
                          display: 'flex', alignItems: 'center', gap: 2,
                        }}>
                          {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                          {delta > 0 ? '+' : ''}{delta}% vs anterior
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, position: 'relative', height: 24, background: 'var(--color-bg)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${Math.min(m.pct, 100)}%`,
                          background: col.bar, borderRadius: 6,
                          transition: 'width 0.6s ease-out',
                        }} />
                        {comparar && prevPct !== undefined && (
                          <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: `${Math.min(prevPct, 100)}%`,
                            background: col.bar, opacity: 0.25, borderRadius: 6,
                          }} />
                        )}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: col.bar, minWidth: 42, textAlign: 'right' }}>
                        {m.pct}%
                      </span>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                        background: col.badge.bg, color: col.badge.color,
                        border: `1px solid ${col.badge.border}`,
                        minWidth: 60, textAlign: 'center',
                      }}>
                        {m.ranking === 'alta' ? 'Alta' : m.ranking === 'media' ? 'Média' : 'Baixa'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela de detalhes */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12,
            border: '1px solid var(--color-border)', overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-main)' }}>
                Detalhes por Sala
              </h3>
            </div>
            <ScrollTableWrapper>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    {['SALA', 'OCUPAÇÃO', 'AGENDAMENTOS', 'HRS OCUPADAS', 'HRS DISPONÍVEIS', 'RANKING'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', ...(i === 0 ? { position: 'sticky', left: 0, background: 'var(--color-bg)', zIndex: 1 } : {}) }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricas.map((m, idx) => {
                    const col = rankColor(m.ranking);
                    return (
                      <tr key={m.sala.id} style={{ borderBottom: idx < metricas.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-main)', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <DoorOpen size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                            {m.sala.nome}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                            <HBar pct={m.pct} color={col.bar} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: col.bar, minWidth: 36 }}>{m.pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--color-text-main)' }}>
                          {m.qtdAgendamentos}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--color-text-main)' }}>
                          {fmtHoras(m.minutosOcupados)}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--color-text-muted)' }}>
                          {fmtHoras(m.minutosDisponiveis)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                            background: col.badge.bg, color: col.badge.color,
                            border: `1px solid ${col.badge.border}`,
                          }}>
                            {m.ranking === 'alta' ? '>70% Alta' : m.ranking === 'media' ? '50-70% Média' : '<50% Baixa'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollTableWrapper>
          </div>

          {/* Legenda */}
          <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span>🟢 &gt;70% — Alta ocupação</span>
            <span>🟡 50-70% — Média ocupação</span>
            <span>🔴 &lt;50% — Baixa ocupação (alerta de subutilização)</span>
            <span>Base: {CLINIC_HOURS_PER_DAY}h/dia (09:00–18:00), Seg-Sáb</span>
          </div>
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(.main-content) { display: none !important; }
          .sidebar { display: none !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
};

// ── Sub-componentes ──────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon?: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10,
      border: '1px solid var(--color-border)', padding: '16px',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const btnOutline: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text-muted)', cursor: 'pointer',
};

const inputDate: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--color-border)',
  background: 'var(--bg-card)', color: 'var(--color-text-main)',
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
