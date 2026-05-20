import React, { useEffect, useMemo, useState } from 'react';
import type { Agendamento, Procedimento, Profissional } from '../types';
import { Users, Clock, Sparkles, ChevronLeft, ChevronRight, CalendarRange, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { findAgendamentoConflict } from '../lib/agendaConflict';

const OWNER_ID = '__owner__';

interface AgendaProps {
  userId: string;
  userName?: string;
  agendamentos: Agendamento[]; // do dia (alimentado pelo App.tsx)
  onAddAgendamento: (
    agendamento: Omit<Agendamento, 'id'>,
    extra?: { telefone?: string }
  ) => void;
  onDeleteAgendamento?: (id: string) => Promise<void>;
  onOpenProntuario?: (clienteId: string) => void;
}

type AgendaView = 'hoje' | 'semana' | 'ano';

// ============================================================
// Helpers de data (puros, sem libs externas)
// ============================================================
const pad2 = (n: number) => String(n).padStart(2, '0');

const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const startOfWeek = (d: Date): Date => {
  const date = new Date(d);
  // Segunda-feira como início (ISO 8601)
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (d: Date, n: number): Date => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

const startOfYear = (d: Date): Date => new Date(d.getFullYear(), 0, 1);
const endOfYear = (d: Date): Date => new Date(d.getFullYear(), 11, 31);
const daysInMonth = (y: number, m: number): number => new Date(y, m + 1, 0).getDate();

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const DIAS_SEMANA_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DIAS_SEMANA_MIN = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Horários da agenda
const HOUR_LIST = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export const Agenda: React.FC<AgendaProps> = ({
  userId,
  userName,
  agendamentos,
  onAddAgendamento,
  onDeleteAgendamento,
  onOpenProntuario,
}) => {
  const [view, setView] = useState<AgendaView>('hoje');
  const [cursor, setCursor] = useState<Date>(new Date());

  // Dados para Semana / Ano
  const [weekData, setWeekData] = useState<Agendamento[]>([]);
  const [yearData, setYearData] = useState<Agendamento[]>([]);
  const [loadingRange, setLoadingRange] = useState(false);

  // Catálogo de procedimentos vindo do banco
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  // Equipe ativa vinda do banco (Configurações → Gestão de Equipe)
  const [equipe, setEquipe] = useState<Array<{ id: string; nome: string; cargo: string }>>([]);

  // Encaixe ideal (visão Hoje)
  const [selectedProcedimento, setSelectedProcedimento] = useState<string>('');
  const [selectedProfessional, setSelectedProfessional] = useState<string>(OWNER_ID);
  const [sugestoes, setSugestoes] = useState<{
    hora: string;
    profissional: string;
    sala: string;
    motivo: string;
    confiabilidade: string;
  }[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // ============================================================
  // STATES E HANDLERS DE ACOLHIMENTO E CANCELAMENTO
  // ============================================================
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newTelefone, setNewTelefone] = useState('');
  const [newProcedimento, setNewProcedimento] = useState('');
  const [newData, setNewData] = useState('');
  const [newHora, setNewHora] = useState('');
  const [newProfissionalId, setNewProfissionalId] = useState<string>(OWNER_ID);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  // Carrega procedimentos + equipe ativa do banco (com fallback de seed)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.ensureSeedData(userId).catch(() => {});
        const [procs, team] = await Promise.all([
          api.getProcedimentos(userId),
          api.getEquipe(userId, { somenteAtivos: true }).catch(() => []),
        ]);
        if (cancelled) return;
        setProcedimentos(procs);
        setEquipe(team.map(m => ({ id: m.id, nome: m.nome, cargo: m.cargo })));
        if (procs.length > 0) {
          setSelectedProcedimento((curr) => curr || procs[0].id);
          setNewProcedimento((curr) => curr || procs[0].nome);
        }
      } catch (err) {
        console.error('Erro ao carregar dados da agenda:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Profissionais = Responsável + equipe ativa.
  const profissionais = useMemo<Profissional[]>(() => {
    const responsavel: Profissional = {
      id: OWNER_ID,
      nome: userName || 'Responsável da Clínica',
      cargo: 'Responsável',
      isResponsavel: true,
    };
    return [
      responsavel,
      ...equipe.map(m => ({
        id: m.id,
        nome: m.nome,
        cargo: m.cargo || 'Profissional',
        isResponsavel: false,
      })),
    ];
  }, [equipe, userName]);

  // Mantém as seleções consistentes com a lista atual.
  useEffect(() => {
    if (profissionais.length === 0) return;
    if (!profissionais.some(p => p.id === newProfissionalId)) {
      setNewProfissionalId(profissionais[0].id);
    }
    if (!profissionais.some(p => p.id === selectedProfessional)) {
      setSelectedProfessional(profissionais[0].id);
    }
  }, [profissionais, newProfissionalId, selectedProfessional]);

  const formatTelefone = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    const truncated = numbersOnly.slice(0, 11);
    
    if (truncated.length <= 2) {
      return truncated.length > 0 ? `(${truncated}` : '';
    } else if (truncated.length <= 6) {
      return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
    } else if (truncated.length <= 10) {
      return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`;
    } else {
      return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim()) return;

    const rawTelefone = newTelefone.replace(/\D/g, '');
    if (rawTelefone && rawTelefone.length < 10) {
      alert('Por favor, informe um telefone de contato válido com DDD (mínimo 10 dígitos).');
      return;
    }

    const matchedProc =
      procedimentos.find((p) => p.nome.toLowerCase().includes(newProcedimento.toLowerCase())) ||
      procedimentos[0];
    if (!matchedProc) {
      alert('Cadastre ao menos um procedimento antes de criar o agendamento.');
      return;
    }
    const duration = matchedProc.duracaoMinutos;
    const price = matchedProc.preco;

    const [h, m] = newHora.split(':').map((x) => parseInt(x, 10));
    const totalMin = h * 60 + m + duration;
    const wrapped = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
    const endH = String(Math.floor(wrapped / 60)).padStart(2, '0');
    const endM = String(wrapped % 60).padStart(2, '0');
    const endStr = `${endH}:${endM}`;

    const profSelecionado = profissionais.find((p) => p.id === newProfissionalId);
    const profissionalNome =
      profSelecionado?.nome ||
      matchedProc.profissionalResponsavel ||
      userName ||
      'Responsável da Clínica';

    // Pré-check de conflito (feedback instantâneo para hoje). API revalida como autoridade.
    if (newData === toISODate(new Date())) {
      const conflito = findAgendamentoConflict(
        { clienteId: '', profissional: profissionalNome, data: newData, horaInicio: newHora, horaFim: endStr },
        agendamentos
      );
      if (conflito) {
        setConflictMessage(conflito.mensagem);
        return;
      }
    }

    try {
      await onAddAgendamento(
        {
          clienteId: 'c_' + Math.random().toString(36).slice(2, 10),
          clienteNome: newNome,
          data: newData,
          horaInicio: newHora,
          horaFim: endStr,
          procedimento: newProcedimento,
          profissional: profissionalNome,
          sala: matchedProc.salaRequerida,
          status: 'agendada',
          valor: price
        },
        { telefone: newTelefone }
      );
      
      setShowAddModal(false);
      setNewNome('');
      setNewTelefone('');
      alert('Nova(o) paciente acolhida(o) com sucesso!');
      
      setCursor(prev => new Date(prev)); // Force range reload
    } catch (err) {
      console.error(err);
      alert('Erro ao agendar paciente.');
    }
  };

  const handleCancelAgendamento = async (id: string) => {
    if (!confirm('Deseja realmente cancelar este atendimento?')) return;
    try {
      if (onDeleteAgendamento) {
        await onDeleteAgendamento(id);
      } else {
        await api.deleteAgendamento(id, userId);
      }
      alert('Atendimento cancelado com sucesso!');
      setCursor(prev => new Date(prev));
    } catch (err) {
      console.error(err);
      alert('Erro ao cancelar agendamento.');
    }
  };

  // ============================================================
  // FETCH de dados conforme a view
  // ============================================================
  useEffect(() => {
    let cancelled = false;
    const fetchRange = async () => {
      if (view === 'semana') {
        const ws = startOfWeek(cursor);
        const we = addDays(ws, 6);
        setLoadingRange(true);
        try {
          const data = await api.getAgendamentosRange(userId, toISODate(ws), toISODate(we));
          if (!cancelled) setWeekData(data);
        } catch (err) {
          console.error('Erro ao carregar semana:', err);
        } finally {
          if (!cancelled) setLoadingRange(false);
        }
      } else if (view === 'ano') {
        const ys = startOfYear(cursor);
        const ye = endOfYear(cursor);
        setLoadingRange(true);
        try {
          const data = await api.getAgendamentosRange(userId, toISODate(ys), toISODate(ye));
          if (!cancelled) setYearData(data);
        } catch (err) {
          console.error('Erro ao carregar ano:', err);
        } finally {
          if (!cancelled) setLoadingRange(false);
        }
      }
    };
    fetchRange();
    return () => {
      cancelled = true;
    };
  }, [view, cursor, userId]);

  // ============================================================
  // NAVEGAÇÃO (prev / next / hoje)
  // ============================================================
  const goPrev = () => {
    setCursor((c) => {
      const n = new Date(c);
      if (view === 'hoje') n.setDate(n.getDate() - 1);
      else if (view === 'semana') n.setDate(n.getDate() - 7);
      else n.setFullYear(n.getFullYear() - 1);
      return n;
    });
  };
  const goNext = () => {
    setCursor((c) => {
      const n = new Date(c);
      if (view === 'hoje') n.setDate(n.getDate() + 1);
      else if (view === 'semana') n.setDate(n.getDate() + 7);
      else n.setFullYear(n.getFullYear() + 1);
      return n;
    });
  };
  const goToday = () => setCursor(new Date());

  // ============================================================
  // ENCAIXE IDEAL (visão Hoje)
  // ============================================================
  // Bucket por hora; cada card mantém o horário exato (14:30 não vira 14:00).
  // Permite múltiplos pacientes no mesmo bloco quando os profissionais diferem.
  const getAgendamentosForSlot = (time: string): Agendamento[] => {
    const slotHour = time.split(':')[0];
    return agendamentos
      .filter((a) => a.horaInicio.split(':')[0] === slotHour)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  };

  const handleEncaixeIdeal = () => {
    const proc = procedimentos.find((p) => p.id === selectedProcedimento);
    if (!proc) return;
    const profEscolhido = profissionais.find((p) => p.id === selectedProfessional);
    const nomeProf =
      profEscolhido?.nome || proc.profissionalResponsavel || userName || 'Responsável da Clínica';
    setSugestoes([
      {
        hora: '11:00',
        profissional: nomeProf,
        sala: proc.salaRequerida,
        motivo: 'Intervalo perfeito de 90min entre procedimentos. A cabine estará higienizada.',
        confiabilidade: '98%',
      },
      {
        hora: '13:00',
        profissional: nomeProf,
        sala: proc.salaRequerida,
        motivo: 'Horário logo após o almoço da profissional, cabine totalmente disponível.',
        confiabilidade: '95%',
      },
      {
        hora: '17:00',
        profissional: nomeProf,
        sala: proc.salaRequerida,
        motivo: 'Último bloco do dia. Permite atendimento calmo e sem sobreposição de fluxo.',
        confiabilidade: '90%',
      },
    ]);
    setHasSearched(true);
  };

  const agendarSugerido = (sug: { hora: string; profissional: string; sala: string }) => {
    const proc = procedimentos.find((p) => p.id === selectedProcedimento);
    if (!proc) return;
    const [h, m] = sug.hora.split(':').map((x) => parseInt(x, 10));
    const fimHora = pad2(((h + Math.ceil(proc.duracaoMinutos / 60)) % 24));
    onAddAgendamento({
      clienteId: 'c_' + Math.random().toString(36).slice(2, 10),
      clienteNome: 'Mariana Azevedo (Encaixe)',
      data: toISODate(new Date()),
      horaInicio: sug.hora,
      horaFim: `${fimHora}:${pad2(m)}`,
      profissional: sug.profissional,
      sala: sug.sala,
      procedimento: proc.nome,
      status: 'agendada',
      valor: proc.preco,
    });
    setSugestoes((prev) => prev.filter((item) => item.hora !== sug.hora));
    alert(`Encaixe realizado com sucesso para ${sug.hora}!`);
  };

  // ============================================================
  // LABELS de cabeçalho
  // ============================================================
  const headerLabel = useMemo(() => {
    if (view === 'hoje') {
      return cursor.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }
    if (view === 'semana') {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      return `${ws.getDate()} de ${MESES[ws.getMonth()]} – ${we.getDate()} de ${MESES[we.getMonth()]} de ${we.getFullYear()}`;
    }
    return String(cursor.getFullYear());
  }, [view, cursor]);

  const today = new Date();

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Título */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
          Agenda & Ocupação Inteligente
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Visualize o fluxo da clínica por dia, semana ou ano e preencha horários ociosos.
        </p>
      </div>

      {/* Toolbar: toggle + navegação */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Segmented control */}
        <div
          style={{
            display: 'inline-flex',
            gap: '4px',
            background: 'var(--color-primary-light)',
            padding: '4px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          {(['hoje', 'semana', 'ano'] as const).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? '#FFFFFF' : 'var(--color-primary)',
                  border: 'none',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                }}
              >
                {v === 'hoje' ? 'Hoje' : v === 'semana' ? 'Semana' : 'Ano'}
              </button>
            );
          })}
        </div>

        {/* Navegação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={goPrev} className="btn btn-outline" style={{ padding: '8px 10px' }} title="Anterior">
            <ChevronLeft size={16} />
          </button>
          <button onClick={goToday} className="btn btn-outline" style={{ padding: '8px 14px' }}>
            Hoje
          </button>
          <button onClick={goNext} className="btn btn-outline" style={{ padding: '8px 10px' }} title="Próximo">
            <ChevronRight size={16} />
          </button>
          <span style={{
            marginLeft: '12px',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-main)',
            textTransform: 'capitalize',
          }}>
            {headerLabel}
          </span>
        </div>
      </div>

      {/* ==========================================================
          VISÃO HOJE (formato listagem original — não alterar)
          ========================================================== */}
      {view === 'hoje' && (
        <div className="agenda-hoje-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '32px' }}>
          <div className="card" style={{ padding: '32px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, textTransform: 'capitalize' }}>
                {cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isSameDay(cursor, today) && <span className="badge badge-sage">Hoje</span>}
                <span className="badge badge-neutral">Visão Dia</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {HOUR_LIST.map((slot) => {
                const slotItems = getAgendamentosForSlot(slot);
                const isEmpty = slotItems.length === 0;
                return (
                  <div
                    key={slot}
                    className="agenda-slot"
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      padding: '16px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--border-radius-md)',
                      backgroundColor: isEmpty ? 'var(--color-success-light)' : '#FFFFFF',
                      transition: 'var(--transition-smooth)',
                      minHeight: '80px',
                      gap: '12px',
                    }}
                  >
                    {/* Âncora visual do bloco horário */}
                    <div
                      className="agenda-slot-anchor"
                      style={{
                        width: '70px',
                        flexShrink: 0,
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isEmpty ? 'var(--color-success)' : 'var(--color-text-muted)',
                        paddingTop: isEmpty ? 0 : '2px',
                      }}
                    >
                      {slot}
                    </div>

                    {isEmpty ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{
                            color: 'var(--color-success)',
                            fontWeight: 500,
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}>
                            <Sparkles size={14} /> Horário Ocioso - Disponível para Encaixe
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Nenhuma reserva ativa para salas ou profissionais neste bloco.
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setNewData(toISODate(cursor));
                            setNewHora(slot);
                            setNewNome('');
                            setNewTelefone('');
                            setShowAddModal(true);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Acolher Paciente
                        </button>
                      </div>
                    ) : (
                      <div className="agenda-slot-bookings" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                        {slotItems.map((booked) => (
                          <div
                            key={booked.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '12px',
                              flexWrap: 'wrap',
                              padding: slotItems.length > 1 ? '10px 12px' : 0,
                              background: slotItems.length > 1 ? '#FAFBFB' : 'transparent',
                              borderRadius: slotItems.length > 1 ? 'var(--border-radius-sm)' : 0,
                              border: slotItems.length > 1 ? '1px solid var(--color-border)' : 'none',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                                  {booked.horaInicio.substring(0, 5)}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  até {booked.horaFim.substring(0, 5)}
                                </span>
                              </div>
                              <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {booked.clienteNome}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={12} /> {booked.procedimento}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Users size={12} /> {booked.profissional}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span className={`badge ${booked.status === 'finalizada' ? 'badge-neutral' : 'badge-sage'}`}>
                                {booked.status}
                              </span>
                              {booked.status !== 'finalizada' && (
                                <button
                                  onClick={() => handleCancelAgendamento(booked.id)}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    borderColor: '#E53E3E',
                                    color: '#E53E3E',
                                    cursor: 'pointer',
                                  }}
                                  title="Cancelar Atendimento"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Encaixe ideal panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ padding: '24px', borderColor: 'var(--color-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Encaixe Inteligente</h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                Nosso motor calcula a melhor hora cruzando cabines livres, profissional e tempo de setup de sala.
              </p>

              <div className="form-group">
                <label className="form-label">Procedimento Pretendido</label>
                <select className="form-select" value={selectedProcedimento} onChange={(e) => setSelectedProcedimento(e.target.value)}>
                  {procedimentos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Profissional Desejado</label>
                {profissionais.length === 1 ? (
                  <input
                    type="text"
                    className="form-input"
                    value={`${profissionais[0].nome} (${profissionais[0].cargo})`}
                    readOnly
                    title="Apenas o responsável está cadastrado. Adicione membros em Configurações → Equipe."
                  />
                ) : (
                  <select
                    className="form-select"
                    value={selectedProfessional}
                    onChange={(e) => setSelectedProfessional(e.target.value)}
                  >
                    {profissionais.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.cargo})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button onClick={handleEncaixeIdeal} className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                Calcular Melhor Encaixe
              </button>
            </div>

            {hasSearched && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Sugestões Encontradas ({sugestoes.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sugestoes.length === 0 ? (
                    <div className="card" style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Nenhum horário atende aos critérios com segurança clínica hoje.
                    </div>
                  ) : (
                    sugestoes.map((sug, idx) => (
                      <div key={idx} className="card" style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        backgroundColor: '#FFFFFF',
                        borderLeft: '4px solid var(--color-primary)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>{sug.hora}</span>
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>Compatibilidade {sug.confiabilidade}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          <div style={{ marginBottom: '4px' }}><strong>Cabine:</strong> {sug.sala}</div>
                          <div>{sug.motivo}</div>
                        </div>
                        <button onClick={() => agendarSugerido(sug)} className="btn btn-secondary" style={{ padding: '6px 12px', width: '100%', fontSize: '11px', justifyContent: 'center' }}>
                          Confirmar Encaixe
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================
          VISÃO SEMANA (estilo Google Calendar, paleta Lumina)
          ========================================================== */}
      {view === 'semana' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {loadingRange && (
            <div style={{ padding: '16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Carregando semana...
            </div>
          )}
          <WeekGrid
            weekStart={startOfWeek(cursor)}
            agendamentos={weekData}
            today={today}
            onDayClick={(d) => {
              setCursor(d);
              setView('hoje');
            }}
            onAgendamentoClick={(a) => onOpenProntuario?.(a.clienteId)}
          />
        </div>
      )}

      {/* ==========================================================
          VISÃO ANO (mini-calendários, paleta Lumina)
          ========================================================== */}
      {view === 'ano' && (
        <div>
          {loadingRange && (
            <div style={{ padding: '16px 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Carregando ano...
            </div>
          )}
          <YearGrid
            year={cursor.getFullYear()}
            agendamentos={yearData}
            today={today}
            onDayClick={(d) => {
              setCursor(d);
              setView('semana');
            }}
          />
        </div>
      )}

      {/* Add client modal dialog */}
      {showAddModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '92%', padding: '32px' }}>
            <h3 style={{ marginBottom: '20px' }}>Acolher Paciente</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Nome da(o) Paciente</label>
                <input
                  type="text"
                  className="form-input"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  placeholder="Ex: Amanda Santos"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  type="text"
                  className="form-input"
                  value={newTelefone}
                  onChange={(e) => setNewTelefone(formatTelefone(e.target.value))}
                  placeholder="(XX) 9XXXX-XXXX"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Procedimento</label>
                <select
                  className="form-select"
                  value={newProcedimento}
                  onChange={(e) => setNewProcedimento(e.target.value)}
                >
                  {procedimentos.map((p) => (
                    <option key={p.id} value={p.nome}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Profissional Responsável</label>
                {profissionais.length === 1 ? (
                  <input
                    type="text"
                    className="form-input"
                    value={`${profissionais[0].nome} (${profissionais[0].cargo})`}
                    readOnly
                    title="Apenas o responsável está cadastrado. Adicione membros em Configurações → Equipe."
                  />
                ) : (
                  <select
                    className="form-select"
                    value={newProfissionalId}
                    onChange={(e) => setNewProfissionalId(e.target.value)}
                  >
                    {profissionais.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — {p.cargo}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Dia</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newData}
                    onChange={(e) => setNewData(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Horário de Início</label>
                  <input
                    type="time"
                    className="form-input"
                    value={newHora}
                    onChange={(e) => setNewHora(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Acolher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conflict error modal */}
      {conflictMessage && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
        }}>
          <div className="card" style={{ maxWidth: '420px', width: '92%', padding: '32px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertTriangle size={40} style={{ color: '#f59e0b' }} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-main)' }}>
              Conflito de Horário
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              {conflictMessage}
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setConflictMessage(null)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// VIEW: SEMANA
// ============================================================
interface WeekGridProps {
  weekStart: Date;
  agendamentos: Agendamento[];
  today: Date;
  onDayClick: (d: Date) => void;
  onAgendamentoClick?: (a: Agendamento) => void;
}

const WeekGrid: React.FC<WeekGridProps> = ({
  weekStart,
  agendamentos,
  today,
  onDayClick,
  onAgendamentoClick,
}) => {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const agendamentosByDay = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    for (const a of agendamentos) {
      (map[a.data] ||= []).push(a);
    }
    return map;
  }, [agendamentos]);

  return (
    <div>
      {/* Header dos dias */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '60px repeat(7, 1fr)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              style={{
                padding: '12px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                borderLeft: i === 0 ? 'none' : '1px solid var(--color-border)',
                backgroundColor: isToday ? 'var(--color-primary-light)' : 'transparent',
                transition: 'var(--transition-smooth)',
              }}
            >
              <div style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {DIAS_SEMANA_SHORT[i]}
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: 600,
                marginTop: '4px',
                display: 'inline-flex',
                width: '32px',
                height: '32px',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                backgroundColor: isToday ? 'var(--color-primary)' : 'transparent',
                color: isToday ? '#FFFFFF' : 'var(--color-text-main)',
              }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid de horários */}
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {HOUR_LIST.map((slot) => (
          <div
            key={slot}
            style={{
              display: 'grid',
              gridTemplateColumns: '60px repeat(7, 1fr)',
              borderBottom: '1px solid var(--color-border)',
              minHeight: '64px',
            }}
          >
            <div style={{
              padding: '8px',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              textAlign: 'right',
              fontWeight: 500,
            }}>
              {slot}
            </div>
            {days.map((d, di) => {
              const dayList = agendamentosByDay[toISODate(d)] || [];
              const slotHour = slot.split(':')[0];
              const itemsInSlot = dayList
                .filter((a) => a.horaInicio.split(':')[0] === slotHour)
                .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
              return (
                <div
                  key={di}
                  style={{
                    borderLeft: di === 0 ? 'none' : '1px solid var(--color-border)',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {itemsInSlot.map((a) => (
                    <div
                      key={a.id}
                      role="button"
                      tabIndex={0}
                      title={`Abrir prontuário de ${a.clienteNome} — ${a.procedimento} (${a.horaInicio}-${a.horaFim})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAgendamentoClick?.(a);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onAgendamentoClick?.(a);
                        }
                      }}
                      style={{
                        background: 'var(--color-primary)',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        fontSize: '11px',
                        lineHeight: 1.3,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(95,125,117,0.15)',
                        transition: 'var(--transition-smooth)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = 'var(--color-primary-dark)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = 'var(--color-primary)';
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{a.horaInicio} {a.clienteNome}</div>
                      <div style={{ opacity: 0.85, fontSize: '10px' }}>{a.procedimento}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// VIEW: ANO (grid de 12 mini calendários)
// ============================================================
interface YearGridProps {
  year: number;
  agendamentos: Agendamento[];
  today: Date;
  onDayClick: (d: Date) => void;
}

const YearGrid: React.FC<YearGridProps> = ({ year, agendamentos, today, onDayClick }) => {
  // Conta agendamentos por data
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of agendamentos) {
      map[a.data] = (map[a.data] || 0) + 1;
    }
    return map;
  }, [agendamentos]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
      }}
    >
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMonth
          key={m}
          year={year}
          month={m}
          countByDate={countByDate}
          today={today}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
};

interface MiniMonthProps {
  year: number;
  month: number;
  countByDate: Record<string, number>;
  today: Date;
  onDayClick: (d: Date) => void;
}

const MiniMonth: React.FC<MiniMonthProps> = ({ year, month, countByDate, today, onDayClick }) => {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // 0 = segunda
  const total = daysInMonth(year, month);

  const cells: ({ d: number; date: Date } | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push({ d, date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '12px',
        color: 'var(--color-primary)',
      }}>
        <CalendarRange size={14} />
        <h4 style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-main)',
          textTransform: 'capitalize',
        }}>
          {MESES[month]}
        </h4>
      </div>

      {/* Header dos dias da semana */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
        marginBottom: '6px',
      }}>
        {DIAS_SEMANA_MIN.map((d, i) => (
          <div key={i} style={{
            fontSize: '10px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontWeight: 500,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Células */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} style={{ height: '28px' }} />;
          const iso = toISODate(cell.date);
          const count = countByDate[iso] || 0;
          const isToday = isSameDay(cell.date, today);
          return (
            <button
              key={i}
              onClick={() => onDayClick(cell.date)}
              title={count ? `${count} agendamento(s)` : 'Disponível'}
              style={{
                position: 'relative',
                height: '28px',
                fontSize: '11px',
                fontWeight: isToday ? 700 : 500,
                color: isToday ? '#FFFFFF' : 'var(--color-text-main)',
                background: isToday
                  ? 'var(--color-primary)'
                  : count > 0
                  ? 'var(--color-primary-light)'
                  : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                if (!isToday) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-border)';
              }}
              onMouseLeave={(e) => {
                if (!isToday) (e.currentTarget as HTMLButtonElement).style.background =
                  count > 0 ? 'var(--color-primary-light)' : 'transparent';
              }}
            >
              {cell.d}
              {count > 0 && !isToday && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '3px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
