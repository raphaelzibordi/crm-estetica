import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarRange, X, Edit2, DoorOpen, Clock, User,
} from 'lucide-react';
import { api } from '../lib/api';
import { ApiError } from '../lib/errors';
import type { Agendamento, Sala } from '../types';

interface CalendarioSalasProps {
  userId: string;
  onEditAgendamento?: (ag: Agendamento) => void;
}

// ── Helpers de data ─────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const startOfWeek = (d: Date) => {
  const c = new Date(d); c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7)); return c;
};
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Paleta de cores por profissional ────────────────────────────
const PROF_COLORS = [
  { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
  { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
  { bg: '#fce7f3', border: '#f9a8d4', text: '#be185d' },
  { bg: '#fef9c3', border: '#fde047', text: '#a16207' },
  { bg: '#ede9fe', border: '#c4b5fd', text: '#6d28d9' },
  { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' },
  { bg: '#ccfbf1', border: '#5eead4', text: '#0f766e' },
  { bg: '#ffedd5', border: '#fdba74', text: '#c2410c' },
];

function profColor(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return PROF_COLORS[Math.abs(hash) % PROF_COLORS.length];
}

function formatHora(h: string) { return h.slice(0, 5); }

function isToday(dateStr: string) { return dateStr === toISO(new Date()); }
function isPast(dateStr: string) { return dateStr < toISO(new Date()); }

export const CalendarioSalas: React.FC<CalendarioSalasProps> = ({ userId, onEditAgendamento }) => {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [salas, setSalas] = useState<Sala[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSalaId, setFilterSalaId] = useState<string>('todas');
  const [selectedAg, setSelectedAg] = useState<Agendamento | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 7 dias da semana a partir de weekStart
  const dias = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const inicio = toISO(dias[0]);
  const fim = toISO(dias[6]);

  const load = useCallback(async () => {
    try {
      const [salasData, agData] = await Promise.all([
        api.getSalasAll(userId),
        api.getAgendamentosRange(userId, inicio, fim),
      ]);
      setSalas(salasData.filter(s => s.ativo));
      // Exclui cancelados/finalizados do calendário
      setAgendamentos(agData.filter(a => a.status !== 'finalizada'));
    } catch (err) {
      if (err instanceof ApiError) console.error('Erro ao carregar calendário:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, inicio, fim]);

  useEffect(() => {
    setLoading(true);
    load();
    // Auto-refresh a cada 30s
    intervalRef.current = setInterval(load, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const goTodayWeek = () => setWeekStart(startOfWeek(new Date()));
  const goPrev = () => setWeekStart(w => addDays(w, -7));
  const goNext = () => setWeekStart(w => addDays(w, 7));

  const salasVisiveis = filterSalaId === 'todas'
    ? salas
    : salas.filter(s => s.id === filterSalaId);

  // Agrupar agendamentos por (sala_id, data)
  const agMap = new Map<string, Agendamento[]>();
  for (const ag of agendamentos) {
    if (!ag.roomId) continue;
    const key = `${ag.roomId}::${ag.data}`;
    if (!agMap.has(key)) agMap.set(key, []);
    agMap.get(key)!.push(ag);
  }

  // Cabeçalho de semana
  const mesLabel = () => {
    const d0 = dias[0], d6 = dias[6];
    if (d0.getMonth() === d6.getMonth()) {
      return `${MESES_ABR[d0.getMonth()]} ${d0.getFullYear()}`;
    }
    return `${MESES_ABR[d0.getMonth()]} – ${MESES_ABR[d6.getMonth()]} ${d6.getFullYear()}`;
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--color-primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarRange size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text-main)' }}>
              Calendário de Salas
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Visualização por espaço físico · atualiza a cada 30s
            </p>
          </div>
        </div>

        {/* Filtro de sala */}
        <select
          value={filterSalaId}
          onChange={e => setFilterSalaId(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: '1px solid var(--color-border)',
            background: 'var(--bg-card)', color: 'var(--color-text-main)',
            cursor: 'pointer',
          }}
        >
          <option value="todas">Todas as salas</option>
          {salas.map(s => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>

      {/* Controles de semana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={goPrev} style={navBtn}>
            <ChevronLeft size={16} />
          </button>
          <div style={{
            padding: '6px 16px', fontSize: 14, fontWeight: 600,
            color: 'var(--color-text-main)', minWidth: 160, textAlign: 'center',
          }}>
            {`${pad2(dias[0].getDate())}–${pad2(dias[6].getDate())} ${mesLabel()}`}
          </div>
          <button onClick={goNext} style={navBtn}>
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={goTodayWeek}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-muted)', cursor: 'pointer',
          }}
        >
          Hoje
        </button>
      </div>

      {/* Grade */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
          Carregando calendário...
        </div>
      ) : salasVisiveis.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
          Nenhuma sala ativa encontrada. Cadastre salas em "Salas de Atendimento".
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {/* Coluna de sala */}
                <th style={{
                  width: 130, padding: '10px 14px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)',
                  background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)',
                  position: 'sticky', left: 0, zIndex: 2,
                }}>
                  SALA
                </th>
                {dias.map((d, i) => {
                  const dateStr = toISO(d);
                  const today = isToday(dateStr);
                  return (
                    <th key={i} style={{
                      padding: '10px 8px', textAlign: 'center',
                      fontSize: 12, fontWeight: 600,
                      color: today ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      background: today ? 'var(--color-primary-light)' : 'var(--color-bg)',
                      borderBottom: `2px solid ${today ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderLeft: '1px solid var(--color-border)',
                      minWidth: 110,
                    }}>
                      <div>{DIAS[i]}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: today ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                        {pad2(d.getDate())}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {salasVisiveis.map((sala) => (
                <tr key={sala.id}>
                  {/* Nome da sala */}
                  <td style={{
                    padding: '12px 14px', verticalAlign: 'top',
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    position: 'sticky', left: 0, zIndex: 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DoorOpen size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.2 }}>
                        {sala.nome}
                      </span>
                    </div>
                  </td>
                  {/* Células por dia */}
                  {dias.map((d, di) => {
                    const dateStr = toISO(d);
                    const key = `${sala.id}::${dateStr}`;
                    const ags = (agMap.get(key) ?? []).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
                    const past = isPast(dateStr);
                    const today = isToday(dateStr);
                    return (
                      <td key={di} style={{
                        padding: '6px', verticalAlign: 'top', minHeight: 60,
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: '1px solid var(--color-border)',
                        background: today ? 'color-mix(in srgb, var(--color-primary-light) 30%, transparent)' : 'transparent',
                      }}>
                        {ags.map(ag => {
                          const col = profColor(ag.profissional || 'Profissional');
                          return (
                            <div
                              key={ag.id}
                              onClick={() => setSelectedAg(ag)}
                              style={{
                                marginBottom: 4, padding: '5px 7px', borderRadius: 6,
                                background: col.bg, border: `1px solid ${col.border}`,
                                cursor: 'pointer', opacity: past && !today ? 0.55 : 1,
                                borderLeft: `3px solid ${col.border}`,
                                transition: 'opacity 0.15s, box-shadow 0.15s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
                              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                            >
                              <div style={{ fontSize: 11, fontWeight: 700, color: col.text, marginBottom: 2 }}>
                                {formatHora(ag.horaInicio)}–{formatHora(ag.horaFim)}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: col.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ag.procedimento || '—'}
                              </div>
                              <div style={{ fontSize: 10, color: col.text, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ag.profissional}
                              </div>
                              <div style={{ fontSize: 10, color: col.text, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ag.clienteNome}
                              </div>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda de profissionais */}
      {!loading && agendamentos.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Array.from(new Set(agendamentos.map(a => a.profissional).filter(Boolean))).map(prof => {
            const col = profColor(prof);
            return (
              <div key={prof} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 100, fontSize: 12,
                background: col.bg, border: `1px solid ${col.border}`, color: col.text,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.text }} />
                {prof}
              </div>
            );
          })}
        </div>
      )}

      {/* Painel lateral de detalhes */}
      {selectedAg && (
        <>
          <div
            onClick={() => setSelectedAg(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 900,
            }}
          />
          <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: 340,
            background: 'var(--bg-card)', borderLeft: '1px solid var(--color-border)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
            zIndex: 901, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.2s ease-out',
          }}>
            {/* Cabeçalho do painel */}
            <div style={{
              padding: '20px 20px 16px', borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-main)' }}>
                Detalhes do Agendamento
              </h3>
              <button
                onClick={() => setSelectedAg(null)}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
                  background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Conteúdo */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Status badge */}
              <div>
                <StatusBadge status={selectedAg.status} />
              </div>

              <DetailRow icon={<CalendarRange size={15} />} label="Data">
                {new Date(selectedAg.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </DetailRow>

              <DetailRow icon={<Clock size={15} />} label="Horário">
                {formatHora(selectedAg.horaInicio)} – {formatHora(selectedAg.horaFim)}
              </DetailRow>

              <DetailRow icon={<DoorOpen size={15} />} label="Sala">
                {selectedAg.sala || '—'}
              </DetailRow>

              <DetailRow icon={<span style={{ fontSize: 15 }}>✨</span>} label="Serviço">
                {selectedAg.procedimento || '—'}
              </DetailRow>

              <DetailRow icon={<User size={15} />} label="Profissional">
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                  ...(() => { const c = profColor(selectedAg.profissional || ''); return { background: c.bg, color: c.text, border: `1px solid ${c.border}` }; })(),
                }}>
                  {selectedAg.profissional || '—'}
                </span>
              </DetailRow>

              <DetailRow icon={<User size={15} />} label="Paciente">
                {selectedAg.clienteNome}
              </DetailRow>

              {selectedAg.valor > 0 && (
                <DetailRow icon={<span style={{ fontSize: 15 }}>💰</span>} label="Valor">
                  {selectedAg.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </DetailRow>
              )}
            </div>

            {/* Rodapé */}
            {onEditAgendamento && (
              <div style={{ padding: 16, borderTop: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => { onEditAgendamento(selectedAg); setSelectedAg(null); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer',
                  }}
                >
                  <Edit2 size={15} />
                  Editar agendamento
                </button>
              </div>
            )}
          </div>

          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </div>
  );
};

// ── Sub-componentes ──────────────────────────────────────────────

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)',
  background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--color-text-main)',
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  agendada:    { label: 'Agendada',       bg: '#eff6ff', color: '#1d4ed8' },
  chegou:      { label: 'Chegou',         bg: '#fef9c3', color: '#a16207' },
  atendimento: { label: 'Em Atendimento', bg: '#dcfce7', color: '#15803d' },
  checkout:    { label: 'Checkout',       bg: '#fce7f3', color: '#be185d' },
  finalizada:  { label: 'Finalizada',     bg: '#f1f5f9', color: '#475569' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: 100,
      fontSize: 12, fontWeight: 600, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--color-text-muted)', paddingTop: 1, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-main)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
