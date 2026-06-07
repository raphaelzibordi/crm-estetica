import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Agendamento } from '../types';
import { api } from '../lib/api';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CalendarioSalasProps {
  userId: string;
  agendamentosHoje: Agendamento[];
  onEditAgendamento?: (id: string, updates: { sala?: string }) => void;
  permissoes?: import('../types').Permissoes | null;
}

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function startOfWeek(d: Date): Date {
  const c = new Date(d);
  const day = (c.getDay() + 6) % 7; // Mon = 0
  c.setDate(c.getDate() - day);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

// Deterministic color palette for profissionais
const PROF_COLORS = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  { bg: '#fef9c3', border: '#eab308', text: '#713f12' },
  { bg: '#ede9fe', border: '#8b5cf6', text: '#4c1d95' },
  { bg: '#ffedd5', border: '#f97316', text: '#7c2d12' },
  { bg: '#cffafe', border: '#06b6d4', text: '#164e63' },
  { bg: '#f1f5f9', border: '#64748b', text: '#0f172a' },
];

function profColor(profissional: string, map: Map<string, number>) {
  if (!map.has(profissional)) map.set(profissional, map.size % PROF_COLORS.length);
  return PROF_COLORS[map.get(profissional)!];
}

const STATUS_VISIVEIS = new Set(['agendada', 'chegou', 'atendimento', 'checkout']);

export const CalendarioSalas: React.FC<CalendarioSalasProps> = ({
  userId,
  agendamentosHoje,
  onEditAgendamento: _onEditAgendamento,
  permissoes,
}) => {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSala, setFilterSala] = useState<string>('todas');
  const [detail, setDetail] = useState<Agendamento | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const colorMapRef = useRef(new Map<string, number>());
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = useMemo(() => toISO(new Date()), []);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    try {
      const start = toISO(weekStart);
      const end = toISO(addDays(weekStart, 6));
      const data = await api.getAgendamentosRange(userId, start, end);
      setAgendamentos(data);
    } catch {
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  // Merge today's live agendamentos into the loaded set for same-day accuracy
  const allAgendamentos = useMemo(() => {
    const todayStr = today;
    const withoutToday = agendamentos.filter((a) => a.data !== todayStr);
    return [...withoutToday, ...agendamentosHoje];
  }, [agendamentos, agendamentosHoje, today]);

  const visible = useMemo(
    () => allAgendamentos.filter((a) => STATUS_VISIVEIS.has(a.status)),
    [allAgendamentos]
  );

  const salas = useMemo(() => {
    const set = new Set(visible.map((a) => a.sala).filter(Boolean));
    return [...set].sort();
  }, [visible]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [salas, filterSala]);

  const salasFiltradas = useMemo(
    () => (filterSala === 'todas' ? salas : salas.filter((s) => s === filterSala)),
    [salas, filterSala]
  );

  const byDayAndSala = useMemo(() => {
    const map = new Map<string, Agendamento[]>();
    for (const a of visible) {
      const key = `${a.data}||${a.sala}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [visible]);

  const goPrev = () => setWeekStart((w) => addDays(w, -7));
  const goNext = () => setWeekStart((w) => addDays(w, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getDate()}–${end.getDate()} ${MESES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
    }
    return `${weekStart.getDate()} ${MESES[weekStart.getMonth()]} – ${end.getDate()} ${MESES[end.getMonth()]} ${weekStart.getFullYear()}`;
  }, [weekStart]);

  const isToday = (d: Date) => toISO(d) === today;

  const isPast = (dateStr: string) => dateStr < today;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
          Calendário por Sala
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Visualize qual profissional está em qual sala e horário ao longo da semana.
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={goPrev} className="btn btn-outline" style={{ padding: '7px 10px' }}>
            <ChevronLeft size={15} />
          </button>
          <button onClick={goToday} className="btn btn-outline" style={{ padding: '7px 14px', fontSize: '12px' }}>Hoje</button>
          <button onClick={goNext} className="btn btn-outline" style={{ padding: '7px 10px' }}>
            <ChevronRight size={15} />
          </button>
          <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>
            {weekLabel}
          </span>
          {loading && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Carregando…</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Sala:</label>
          <select
            className="form-select"
            style={{ fontSize: '12px', padding: '6px 10px', minWidth: '160px' }}
            value={filterSala}
            onChange={(e) => setFilterSala(e.target.value)}
          >
            <option value="todas">Todas as salas</option>
            {salas.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Legend */}
      {visible.length > 0 && (() => {
        const profs = [...new Set(visible.map((a) => a.profissional))].sort();
        return (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {profs.map((p) => {
              const c = profColor(p, colorMapRef.current);
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: c.text, background: c.bg, border: `1px solid ${c.border}`, padding: '2px 8px', borderRadius: '999px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.border, display: 'inline-block' }} />
                  {p}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Grid */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {salasFiltradas.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
              {salas.length === 0 ? 'Sem agendamentos com sala atribuída nesta semana.' : 'Nenhuma sala com este filtro.'}
            </p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
          <div ref={scrollRef} style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary-light)' }}>
                  <th style={{ width: '140px', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border)', position: 'sticky', left: 0, zIndex: 2, background: 'var(--color-primary-light)' }}>
                    Sala
                  </th>
                  {weekDays.map((d, i) => (
                    <th key={i} style={{
                      padding: '10px 8px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: isToday(d) ? 700 : 600,
                      color: isToday(d) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      borderLeft: '1px solid var(--color-border)',
                      background: isToday(d) ? 'var(--color-primary-light)' : 'transparent',
                      minWidth: '100px',
                    }}>
                      <div>{DIAS_SEMANA[i]}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                        {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salasFiltradas.map((sala, ri) => (
                  <tr key={sala} style={{ borderTop: ri === 0 ? '2px solid var(--color-border)' : '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', color: 'var(--color-text-main)', borderRight: '1px solid var(--color-border)', verticalAlign: 'top', background: 'var(--color-primary-light)', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1 }}>
                      {sala}
                    </td>
                    {weekDays.map((d, di) => {
                      const dateStr = toISO(d);
                      const items = byDayAndSala.get(`${dateStr}||${sala}`) ?? [];
                      const pastDay = isPast(dateStr) && dateStr !== today;
                      return (
                        <td
                          key={di}
                          style={{
                            padding: '8px',
                            verticalAlign: 'top',
                            borderLeft: '1px solid var(--color-border)',
                            background: isToday(d) ? '#fafeff' : 'transparent',
                            minWidth: '100px',
                            minHeight: '72px',
                          }}
                        >
                          {items.length === 0 ? null : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {items
                                .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                                .map((a) => {
                                  const c = profColor(a.profissional, colorMapRef.current);
                                  return (
                                    <button
                                      key={a.id}
                                      onClick={() => setDetail(a)}
                                      style={{
                                        background: c.bg,
                                        border: `1px solid ${c.border}`,
                                        borderLeft: `3px solid ${c.border}`,
                                        borderRadius: '4px',
                                        padding: '4px 6px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        width: '100%',
                                        opacity: pastDay ? 0.5 : 1,
                                        transition: 'opacity 0.15s',
                                      }}
                                    >
                                      <div style={{ fontSize: '10px', fontWeight: 700, color: c.text }}>
                                        {a.horaInicio.substring(0, 5)}–{a.horaFim.substring(0, 5)}
                                      </div>
                                      <div style={{ fontSize: '11px', color: c.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {a.procedimento}
                                      </div>
                                      <div style={{ fontSize: '10px', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {a.profissional}
                                      </div>
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canScrollRight && (
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0, width: '56px',
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.92))',
              pointerEvents: 'none', display: 'flex', alignItems: 'center',
              justifyContent: 'flex-end', paddingRight: '10px',
            }}>
              <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', opacity: 0.7 }} />
            </div>
          )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '380px', width: '92%', padding: '28px', position: 'relative' }}>
            <button
              onClick={() => setDetail(null)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px' }}
            >
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '16px', marginBottom: '16px', paddingRight: '24px' }}>Detalhes do Atendimento</h3>
            {[
              ['Data', new Date(detail.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })],
              ['Horário', `${detail.horaInicio.substring(0, 5)} – ${detail.horaFim.substring(0, 5)}`],
              ['Paciente', detail.clienteNome],
              ['Procedimento', detail.procedimento],
              ['Profissional', detail.profissional],
              ['Sala', detail.sala || '—'],
              ['Status', detail.status],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
                <span style={{ color: 'var(--color-text-main)', fontWeight: 600, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: label === 'Status' ? 'capitalize' : 'none' }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setDetail(null)} style={{ fontSize: '12px' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
