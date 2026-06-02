import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ClinicaPublica, ProcedimentoPublico, ProfissionalPublico, SlotOcupado } from '../types';

// ─── helpers ────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function calcHoraFim(horaInicio: string, duracaoMinutos: number): string {
  return minutesToTime(timeToMinutes(horaInicio) + duracaoMinutos);
}

function generateAvailableSlots(
  bookedSlots: SlotOcupado[],
  duracaoMinutos: number,
  dateStr: string,
  minAdvanceHoras: number,
): string[] {
  const CLINIC_START = 8 * 60;
  const CLINIC_END   = 18 * 60;
  const INTERVAL     = 15;

  const now      = new Date();
  const selected = new Date(dateStr + 'T00:00:00');
  const isToday  = selected.toDateString() === now.toDateString();
  const minAdvMin = minAdvanceHoras * 60;
  const nowMins  = now.getHours() * 60 + now.getMinutes();

  const slots: string[] = [];
  for (let start = CLINIC_START; start + duracaoMinutos <= CLINIC_END; start += INTERVAL) {
    if (isToday && start - nowMins < minAdvMin) continue;
    const end = start + duracaoMinutos;
    const blocked = bookedSlots.some(b => {
      const bS = timeToMinutes(b.horaInicio);
      const bE = timeToMinutes(b.horaFim);
      return start < bE && end > bS;
    });
    if (!blocked) slots.push(minutesToTime(start));
  }
  return slots;
}

function formatPhone(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2)  return n.length ? `(${n}` : '';
  if (n.length <= 6)  return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function formatPrice(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isoToDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

// ─── styles ─────────────────────────────────────────────────────────────────

const PRIMARY   = '#5F7D75';
const P_LIGHT   = '#F3F6F5';
const P_DARK    = '#465C56';
const BORDER    = '#EAEAEA';
const TEXT_MAIN = '#2C302E';
const TEXT_MUTED = '#7A827E';

// ─── sub-components ──────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', marginBottom: '28px' }}>
    {Array.from({ length: total }).map((_, i) => {
      const n = i + 1;
      const done   = n < current;
      const active = n === current;
      return (
        <React.Fragment key={n}>
          <div style={{
            width: active ? 32 : 28, height: active ? 32 : 28,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700,
            background: active ? PRIMARY : done ? P_DARK : BORDER,
            color: active || done ? '#fff' : TEXT_MUTED,
            transition: 'all 0.25s',
            flexShrink: 0,
          }}>
            {done ? '✓' : n}
          </div>
          {i < total - 1 && (
            <div style={{ flex: 1, maxWidth: 40, height: 2, background: done ? P_DARK : BORDER, borderRadius: 1 }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

interface Props { slug: string; }

export const AgendamentoPublico: React.FC<Props> = ({ slug }) => {
  const [step, setStep] = useState(1);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError]   = useState<string | null>(null);

  // Clinic
  const [clinica, setClinica]               = useState<ClinicaPublica | null>(null);
  const [profissionais, setProfissionais]   = useState<ProfissionalPublico[]>([]);
  const [procedimentos, setProcedimentos]   = useState<ProcedimentoPublico[]>([]);

  // Selections
  const [selProfissional, setSelProfissional] = useState<ProfissionalPublico | null>(null);
  const [selProcedimento, setSelProcedimento] = useState<ProcedimentoPublico | null>(null);

  // Date + slots
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDate,  setSelDate]  = useState('');
  const [slots,    setSlots]    = useState<string[]>([]);
  const [selTime,  setSelTime]  = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Patient data
  const [nome,     setNome]     = useState('');
  const [telefone, setTelefone] = useState('');
  const [email,    setEmail]    = useState('');

  // Submit
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [bookingDone,  setBookingDone]  = useState(false);

  // ── Load clinic ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const c = await api.getClinicaBySlug(slug);
        if (!c) {
          setPageError('Este link de agendamento não está disponível no momento.');
          return;
        }
        setClinica(c);
        const [profs, procs] = await Promise.all([
          api.getProfissionaisPublicos(c.userId),
          api.getProcedimentosPublicos(c.userId),
        ]);
        setProfissionais(profs);
        setProcedimentos(procs);
      } catch {
        setPageError('Não foi possível carregar a agenda. Tente novamente em instantes.');
      } finally {
        setPageLoading(false);
      }
    })();
  }, [slug]);

  // ── Load slots ──────────────────────────────────────────────────
  const loadSlots = useCallback(async (date: string) => {
    if (!clinica || !selProfissional || !selProcedimento) return;
    setSlotsLoading(true);
    setSelTime('');
    try {
      const booked = await api.getSlotsOcupados(clinica.userId, date, selProfissional.nome);
      setSlots(generateAvailableSlots(booked, selProcedimento.duracaoMinutos, date, clinica.minAdvanceHoras));
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [clinica, selProfissional, selProcedimento]);

  // ── Calendar helpers ────────────────────────────────────────────
  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate   = clinica
    ? new Date(today.getTime() + clinica.maxAdvanceDias * 86400000)
    : new Date(today.getTime() + 30 * 86400000);

  const calDays   = buildCalendarDays(calYear, calMonth);
  const monthName = new Date(calYear, calMonth).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const isDayDisabled = (day: number) => {
    const d = new Date(calYear, calMonth, day);
    return d < today || d > maxDate;
  };

  const handleDayClick = (day: number) => {
    if (isDayDisabled(day)) return;
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelDate(dateStr);
    loadSlots(dateStr);
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  // ── Submit ──────────────────────────────────────────────────────
  const handleConfirmar = async () => {
    if (!clinica || !selProfissional || !selProcedimento || !selDate || !selTime) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Re-check slot availability before final commit (anti-race-condition)
      const booked = await api.getSlotsOcupados(clinica.userId, selDate, selProfissional.nome);
      const currentSlots = generateAvailableSlots(booked, selProcedimento.duracaoMinutos, selDate, clinica.minAdvanceHoras);
      if (!currentSlots.includes(selTime)) {
        setSubmitError('Este horário acabou de ser reservado. Escolha outro horário.');
        setSlots(currentSlots);
        setSelTime('');
        setStep(3);
        return;
      }

      await api.createPublicBooking({
        clinicSlug:        slug,
        profissional:      selProfissional.nome,
        procedimento:      selProcedimento.nome,
        data:              selDate,
        horaInicio:        selTime,
        horaFim:           calcHoraFim(selTime, selProcedimento.duracaoMinutos),
        sala:              selProcedimento.salaRequerida,
        valor:             selProcedimento.preco,
        pacienteNome:      nome.trim(),
        pacienteTelefone:  telefone.replace(/\D/g, ''),
        pacienteEmail:     email.trim(),
      });
      setBookingDone(true);
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('SLOT_UNAVAILABLE') || msg.includes('reservado')) {
        setSubmitError('Este horário acabou de ser reservado. Por favor, escolha outro.');
        setStep(3);
        loadSlots(selDate);
      } else {
        setSubmitError(msg || 'Erro ao criar agendamento. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '48px', color: TEXT_MUTED }}>
            Carregando agenda…
          </div>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔒</div>
            <p style={{ color: TEXT_MAIN, fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>Agendamento indisponível</p>
            <p style={{ color: TEXT_MUTED, fontSize: '14px' }}>{pageError}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 5: Success ──────────────────────────────────────────────
  if (bookingDone) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: P_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 20px' }}>
            ✅
          </div>
          <h2 style={{ fontSize: '22px', color: TEXT_MAIN, marginBottom: '10px' }}>Agendamento confirmado!</h2>
          <p style={{ color: TEXT_MUTED, fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
            Seu horário está reservado em <strong>{clinica?.nomeClinica}</strong>.
          </p>

          <div style={{ background: P_LIGHT, borderRadius: '12px', padding: '20px', textAlign: 'left', marginBottom: '20px' }}>
            {[
              ['Profissional',  selProfissional?.nome ?? ''],
              ['Procedimento',  selProcedimento?.nome ?? ''],
              ['Data',          isoToDisplay(selDate)],
              ['Horário',       `${selTime} – ${calcHoraFim(selTime, selProcedimento?.duracaoMinutos ?? 0)}`],
              ['Valor',         formatPrice(selProcedimento?.preco ?? 0)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ color: TEXT_MUTED }}>{label}</span>
                <span style={{ color: TEXT_MAIN, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '13px', color: TEXT_MUTED }}>
            Em caso de dúvidas, entre em contato diretamente com a clínica.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Clinic header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '22px', color: '#fff', fontWeight: 700 }}>
          {(clinica?.nomeClinica ?? 'C').charAt(0).toUpperCase()}
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: TEXT_MAIN, marginBottom: '4px' }}>{clinica?.nomeClinica}</h1>
        <p style={{ fontSize: '13px', color: TEXT_MUTED }}>Agendamento Online</p>
      </div>

      <div style={styles.card}>
        <StepIndicator current={step} total={4} />

        <h2 style={{ fontSize: '16px', fontWeight: 600, color: TEXT_MAIN, marginBottom: '18px', textAlign: 'center' }}>
          {step === 1 && 'Escolha o profissional'}
          {step === 2 && 'Escolha o procedimento'}
          {step === 3 && 'Selecione data e horário'}
          {step === 4 && 'Seus dados para confirmação'}
        </h2>

        {/* ── Step 1: Professional ── */}
        {step === 1 && (
          <div>
            {profissionais.length === 0 ? (
              <p style={{ textAlign: 'center', color: TEXT_MUTED, padding: '24px' }}>
                Nenhum profissional disponível para agendamento online no momento.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {profissionais.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelProfissional(p); setStep(2); }}
                    style={{
                      ...styles.selectCard,
                      background: selProfissional?.id === p.id ? P_LIGHT : '#fff',
                      borderColor: selProfissional?.id === p.id ? PRIMARY : BORDER,
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '17px', flexShrink: 0 }}>
                      {p.nome.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: TEXT_MAIN }}>{p.nome}</div>
                      {p.cargo && <div style={{ fontSize: '12px', color: TEXT_MUTED }}>{p.cargo}</div>}
                    </div>
                    <div style={{ marginLeft: 'auto', color: TEXT_MUTED }}>›</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Procedure ── */}
        {step === 2 && (
          <div>
            {procedimentos.length === 0 ? (
              <p style={{ textAlign: 'center', color: TEXT_MUTED, padding: '24px' }}>
                Nenhum procedimento disponível no momento.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {procedimentos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelProcedimento(p); setStep(3); }}
                    style={{
                      ...styles.selectCard,
                      background: selProcedimento?.id === p.id ? P_LIGHT : '#fff',
                      borderColor: selProcedimento?.id === p.id ? PRIMARY : BORDER,
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: TEXT_MAIN }}>{p.nome}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: PRIMARY }}>{formatPrice(p.preco)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: TEXT_MUTED }}>
                      <span>⏱ {p.duracaoMinutos} min</span>
                      {p.salaRequerida && <span>📍 {p.salaRequerida}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setStep(1)} style={styles.backBtn}>← Voltar</button>
          </div>
        )}

        {/* ── Step 3: Date + Time ── */}
        {step === 3 && (
          <div>
            {submitError && (
              <div style={styles.errorBanner}>{submitError}</div>
            )}

            {/* Calendar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <button onClick={prevMonth} style={styles.calNavBtn}>‹</button>
                <span style={{ fontSize: '14px', fontWeight: 600, color: TEXT_MAIN, textTransform: 'capitalize' }}>
                  {monthName}
                </span>
                <button onClick={nextMonth} style={styles.calNavBtn}>›</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: TEXT_MUTED, padding: '4px 0', fontWeight: 600 }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {calDays.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const disabled = isDayDisabled(day);
                  const selected = selDate === dateStr;
                  return (
                    <button
                      key={day}
                      disabled={disabled}
                      onClick={() => handleDayClick(day)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: selected ? `2px solid ${PRIMARY}` : '1px solid transparent',
                        background: selected ? PRIMARY : 'transparent',
                        color: selected ? '#fff' : disabled ? '#ccc' : TEXT_MAIN,
                        fontSize: '13px',
                        fontWeight: selected ? 700 : 400,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            {selDate && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: TEXT_MAIN, marginBottom: '10px' }}>
                  Horários disponíveis — {isoToDisplay(selDate)}
                </div>

                {slotsLoading ? (
                  <p style={{ color: TEXT_MUTED, fontSize: '13px' }}>Buscando horários disponíveis…</p>
                ) : slots.length === 0 ? (
                  <p style={{ color: TEXT_MUTED, fontSize: '13px', padding: '12px', background: P_LIGHT, borderRadius: '8px' }}>
                    Nenhum horário disponível nesta data. Selecione outro dia.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                    {slots.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelTime(t)}
                        style={{
                          padding: '10px 8px',
                          minHeight: '44px',
                          borderRadius: '8px',
                          border: selTime === t ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                          background: selTime === t ? PRIMARY : '#fff',
                          color: selTime === t ? '#fff' : TEXT_MAIN,
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setStep(2)} style={styles.backBtn}>← Voltar</button>
              <button
                onClick={() => { setSubmitError(null); setStep(4); }}
                disabled={!selDate || !selTime}
                style={{ ...styles.primaryBtn, flex: 1, opacity: (!selDate || !selTime) ? 0.5 : 1 }}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Personal data ── */}
        {step === 4 && (
          <div>
            {/* Summary */}
            <div style={{ background: P_LIGHT, borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: TEXT_MUTED }}>Profissional</span>
                <span style={{ color: TEXT_MAIN, fontWeight: 600 }}>{selProfissional?.nome}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: TEXT_MUTED }}>Procedimento</span>
                <span style={{ color: TEXT_MAIN, fontWeight: 600 }}>{selProcedimento?.nome}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: TEXT_MUTED }}>Data & Hora</span>
                <span style={{ color: TEXT_MAIN, fontWeight: 600 }}>
                  {isoToDisplay(selDate)} às {selTime}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: TEXT_MUTED }}>Valor</span>
                <span style={{ color: PRIMARY, fontWeight: 700 }}>{formatPrice(selProcedimento?.preco ?? 0)}</span>
              </div>
            </div>

            {submitError && (
              <div style={{ ...styles.errorBanner, marginBottom: '16px' }}>{submitError}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={styles.label}>Nome completo *</label>
                <input
                  style={styles.input}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Ana Paula Silva"
                  autoComplete="name"
                />
              </div>
              <div>
                <label style={styles.label}>WhatsApp / Telefone *</label>
                <input
                  style={styles.input}
                  value={telefone}
                  onChange={e => setTelefone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label style={styles.label}>E-mail</label>
                <input
                  style={styles.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => setStep(3)} style={styles.backBtn}>← Voltar</button>
              <button
                onClick={handleConfirmar}
                disabled={submitting || !nome.trim() || telefone.replace(/\D/g, '').length < 10}
                style={{
                  ...styles.primaryBtn,
                  flex: 1,
                  opacity: (submitting || !nome.trim() || telefone.replace(/\D/g, '').length < 10) ? 0.6 : 1,
                }}
              >
                {submitting ? 'Confirmando…' : 'Confirmar Agendamento'}
              </button>
            </div>

            <p style={{ fontSize: '11px', color: TEXT_MUTED, marginTop: '12px', textAlign: 'center', lineHeight: 1.5 }}>
              Ao confirmar, você concorda que seus dados serão utilizados para fins de agendamento pela clínica.
            </p>
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '11px', color: TEXT_MUTED, marginTop: '20px' }}>
        Powered by <strong>Lumina CRM</strong>
      </p>
    </div>
  );
};

// ─── style objects ────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    background: '#F8F8F6',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '32px 16px 48px',
    fontFamily: "'Outfit', -apple-system, sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    border: `1px solid ${BORDER}`,
    padding: '28px 24px',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
  },
  selectCard: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '14px',
    padding: '14px 16px',
    borderRadius: '10px',
    border: `1px solid ${BORDER}`,
    cursor: 'pointer',
    background: '#fff',
    width: '100%',
    transition: 'all 0.15s',
    textAlign: 'left' as const,
  },
  primaryBtn: {
    padding: '13px 20px',
    borderRadius: '10px',
    border: 'none',
    background: PRIMARY,
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  backBtn: {
    padding: '13px 16px',
    borderRadius: '10px',
    border: `1px solid ${BORDER}`,
    background: '#fff',
    color: TEXT_MUTED,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  calNavBtn: {
    width: 32, height: 32,
    borderRadius: '8px',
    border: `1px solid ${BORDER}`,
    background: '#fff',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: TEXT_MAIN,
  },
  errorBanner: {
    padding: '12px 14px',
    borderRadius: '8px',
    background: '#FFF2F2',
    border: '1px solid #FFCACA',
    color: '#C0392B',
    fontSize: '13px',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  label: {
    display: 'block' as const,
    fontSize: '12px',
    fontWeight: 600,
    color: TEXT_MUTED,
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '8px',
    border: `1px solid ${BORDER}`,
    fontSize: '14px',
    color: TEXT_MAIN,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
};
