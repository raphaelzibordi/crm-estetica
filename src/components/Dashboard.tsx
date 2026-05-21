import React, { useState, useEffect, useMemo } from 'react';
import type { Agendamento, Procedimento, Profissional, StatusJornada } from '../types';
import { Clock, UserCheck, UserPlus, CheckCircle, User, Pencil, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { findAgendamentoConflict } from '../lib/agendaConflict';
import { RegistrarPresenca } from './RegistrarPresenca';

const OWNER_ID = '__owner__';

interface DashboardProps {
  agendamentos: Agendamento[];
  onUpdateStatus: (id: string, newStatus: StatusJornada, extras?: { metodoPagamento?: Agendamento['metodoPagamento'] }) => void;
  onUpdateAgendamentoDados?: (id: string, updates: { horaInicio?: string; horaFim?: string; procedimento?: string; profissional?: string }) => void;
  onOpenProntuario: (clienteId: string) => void;
  onAddAgendamento: (
    agendamento: Omit<Agendamento, 'id'>,
    extra?: { telefone?: string }
  ) => void;
  onDeleteAgendamento?: (id: string) => void;
  userId?: string;
  userName?: string;
}

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Returns visual alert props for a scheduled (agendada) card based on current time.
// Proximity warning  : ≤ 15 min until appointment → warm amber pastel
// Overdue            : appointment time already passed → soft rose pastel
// On time / no alert : null  (caller skips styling)
function getScheduleAlertStyle(
  horaInicio: string,
  now: Date,
): {
  background: string;
  borderColor: string;
  label: string;
  labelBg: string;
  labelColor: string;
} | null {
  const [h, m] = (horaInicio || '').substring(0, 5).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const apptMin = h * 60 + m;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const diff = apptMin - nowMin; // negative = past, positive = future
  if (diff < 0) {
    return {
      background: '#FFF1F2',
      borderColor: '#FECDD3',
      label: 'Atrasada',
      labelBg: '#FECDD3',
      labelColor: '#9F1239',
    };
  }
  if (diff <= 15) {
    return {
      background: '#FFFBEB',
      borderColor: '#FDE68A',
      label: 'Em breve',
      labelBg: '#FEF3C7',
      labelColor: '#78350F',
    };
  }
  return null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  agendamentos,
  onUpdateStatus,
  onUpdateAgendamentoDados,
  onOpenProntuario,
  onAddAgendamento,
  onDeleteAgendamento,
  userId,
  userName,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [equipe, setEquipe] = useState<Array<{ id: string; nome: string; cargo: string }>>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState<string | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState<Agendamento['metodoPagamento']>('pix');
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [registrarPresencaAgendamento, setRegistrarPresencaAgendamento] = useState<Agendamento | null>(null);

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
      } catch (err) {
        console.error('Erro ao carregar dados de acolhimento:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Lista de profissionais para o select de acolhimento:
  // o Responsável sempre figura como primeira opção; os demais vêm da equipe ativa cadastrada.
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const obterDataHoraFormatada = () => {
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const dia = currentDateTime.getDate();
    const mes = meses[currentDateTime.getMonth()];
    const ano = currentDateTime.getFullYear();
    const hora = String(currentDateTime.getHours()).padStart(2, '0');
    const minuto = String(currentDateTime.getMinutes()).padStart(2, '0');
    const prefixo = currentDateTime.getHours() === 1 ? 'É' : 'São';
    
    return `Hoje é dia ${dia} de ${mes} de ${ano} • ${prefixo} ${hora}:${minuto}h`;
  };

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

  const [newNome, setNewNome] = useState('');
  const [newTelefone, setNewTelefone] = useState('');
  const [newProcedimento, setNewProcedimento] = useState('');
  const [newProfissionalId, setNewProfissionalId] = useState<string>(OWNER_ID);
  const [newHora, setNewHora] = useState('14:30');
  const [newData, setNewData] = useState<string>(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (procedimentos.length > 0 && !newProcedimento) {
      setNewProcedimento(procedimentos[0].nome);
    }
  }, [procedimentos, newProcedimento]);

  // Sempre que a lista de profissionais muda, garante que a seleção atual ainda é válida.
  // Cenário A (apenas o Responsável): auto-seleciona o dono.
  // Cenário B (equipe cadastrada): mantém o que está, ou cai no primeiro válido.
  useEffect(() => {
    if (profissionais.length === 0) return;
    const aindaExiste = profissionais.some(p => p.id === newProfissionalId);
    if (!aindaExiste) setNewProfissionalId(profissionais[0].id);
  }, [profissionais, newProfissionalId]);

  // Edit-card state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHora, setEditHora] = useState('');
  const [editProcedimento, setEditProcedimento] = useState('');
  const [editProfissionalId, setEditProfissionalId] = useState<string>(OWNER_ID);

  const openEditModal = (item: Agendamento) => {
    setEditingId(item.id);
    setEditHora(item.horaInicio.substring(0, 5));
    setEditProcedimento(item.procedimento);
    const match = profissionais.find((p) => p.nome === item.profissional);
    setEditProfissionalId(match?.id ?? profissionais[0]?.id ?? OWNER_ID);
  };

  const handleSaveEdit = () => {
    if (!editingId || !onUpdateAgendamentoDados) return;
    const prof = profissionais.find((p) => p.id === editProfissionalId);
    const proc = procedimentos.find((p) => p.nome === editProcedimento);
    const duracao = proc?.duracaoMinutos ?? 60;
    onUpdateAgendamentoDados(editingId, {
      horaInicio: editHora,
      horaFim: addMinutesToTime(editHora, duracao),
      procedimento: editProcedimento,
      profissional: prof?.nome ?? editProcedimento,
    });
    setEditingId(null);
  };

  // DnD state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<StatusJornada | null>(null);

  const colunas: { id: StatusJornada; label: string; desc: string }[] = [
    { id: 'agendada', label: 'Confirmadas para Hoje', desc: 'Próximos agendamentos' },
    { id: 'chegou', label: 'Chegaram na Clínica', desc: 'Em recepção / aguardando' },
    { id: 'atendimento', label: 'Em Cabine', desc: 'Procedimento em andamento' },
    { id: 'checkout', label: 'Checkout / Conclusão', desc: 'Pós-procedimento imediato' },
  ];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim()) return;

    const rawTelefone = newTelefone.replace(/\D/g, '');
    if (rawTelefone && rawTelefone.length < 10) {
      alert('Por favor, informe um telefone de contato válido com DDD (mínimo 10 dígitos).');
      return;
    }

    const proc = procedimentos.find((p) => p.nome === newProcedimento);
    const duracao = proc?.duracaoMinutos ?? 60;
    const valor = proc?.preco ?? 0;
    const sala = proc?.salaRequerida || 'Cabine 01 - Clínica';
    const profSelecionado = profissionais.find((p) => p.id === newProfissionalId);
    const profissional =
      profSelecionado?.nome ||
      proc?.profissionalResponsavel ||
      userName ||
      'Responsável da Clínica';
    const horaFim = addMinutesToTime(newHora, duracao);

    // Pré-check de conflito (feedback instantâneo). API repete a validação como autoridade.
    const conflito = findAgendamentoConflict(
      { clienteId: '', profissional, data: newData, horaInicio: newHora, horaFim },
      agendamentos
    );
    if (conflito) {
      setConflictMessage(conflito.mensagem);
      return;
    }

    onAddAgendamento(
      {
        clienteId: 'c_' + Math.random().toString(36).slice(2, 10),
        clienteNome: newNome.trim(),
        data: newData,
        horaInicio: newHora,
        horaFim,
        profissional,
        sala,
        procedimento: newProcedimento,
        status: 'agendada',
        valor,
      },
      { telefone: newTelefone.trim() || undefined }
    );

    setNewNome('');
    setNewTelefone('');
    setShowAddModal(false);
  };

  // ============================================================
  // KANBAN DnD HANDLERS
  // ============================================================
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverCol(null);
  };

  const handleDragOverColumn = (
    e: React.DragEvent<HTMLDivElement>,
    colId: StatusJornada
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) setDragOverCol(colId);
  };

  const handleDropOnColumn = (
    e: React.DragEvent<HTMLDivElement>,
    colId: StatusJornada
  ) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragOverCol(null);
    setDragId(null);
    if (!id) return;
    const item = agendamentos.find((a) => a.id === id);
    if (!item || item.status === colId) return;
    onUpdateStatus(id, colId);
  };

  /**
   * UX Design Decision: Humanized Pace & Waiting alerts
   * Clients in the aesthetics industry pay for custom time and deep presence.
   * Highlight waiting times gently (using terracotta #D98E73) if they stay in the lobby
   * for more than 10 minutes to signal the team to deliver an herbal tea or massage.
   */
  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header section with humanized greeting */}
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
            Olá, {userName || 'Helena'}! Aqui está o ritmo da clínica hoje.
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Acompanhe a jornada de cuidados e proporcione uma experiência memorável.
          </p>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 500, 
            color: 'var(--color-primary)', 
            marginTop: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px' 
          }}>
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-primary)', 
              boxShadow: '0 0 0 0 rgba(95, 125, 117, 0.7)',
              animation: 'pulse 2s infinite' 
            }} />
            {obterDataHoraFormatada()}
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          <UserPlus size={16} />
          <span>Acolher nova(o) paciente</span>
        </button>
      </div>

      {/* Grid columns */}
      <div className="esteira-container">
        {colunas.map((col) => {
          // Checkout column also retains 'finalizada' for the day so the receptionist
          // can see what was actually completed and billed; finalized cards stay
          // until midnight (when App.tsx refetches "today's" agendamentos).
          const colAgendamentos = agendamentos.filter((a) =>
            col.id === 'checkout'
              ? a.status === 'checkout' || a.status === 'finalizada'
              : a.status === col.id,
          );
          const isHover = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className="esteira-coluna"
              onDragOver={(e) => handleDragOverColumn(e, col.id)}
              onDragLeave={() => setDragOverCol((prev) => (prev === col.id ? null : prev))}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
              style={{
                outline: isHover ? '2px dashed var(--color-primary)' : 'none',
                outlineOffset: isHover ? '-4px' : 0,
                backgroundColor: isHover ? 'var(--color-primary-light)' : undefined,
                transition: 'var(--transition-smooth)',
              }}
            >
              <div className="esteira-coluna-header">
                <div>
                  <h3 className="esteira-coluna-titulo">{col.label}</h3>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{col.desc}</span>
                </div>
                <span className="esteira-coluna-contador">{colAgendamentos.length}</span>
              </div>

              <div className="esteira-cards-list">
                {colAgendamentos.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '120px',
                    border: '1px dashed #E0E0E0',
                    borderRadius: 'var(--border-radius-md)',
                    color: 'var(--color-text-muted)',
                    fontSize: '12px',
                    textAlign: 'center',
                    padding: '16px',
                    backgroundColor: '#FFFFFF'
                  }}>
                    {isHover ? 'Solte aqui para mover' : 'Sem atendimentos nesta etapa'}
                  </div>
                ) : (
                  colAgendamentos.map((item) => {
                    const isOverWait = col.id === 'chegou' && (item.tempoEsperaMinutos ?? 0) >= 10;
                    const isDragging = dragId === item.id;
                    const isFinalizada = item.status === 'finalizada';
                    const scheduleAlert = col.id === 'agendada'
                      ? getScheduleAlertStyle(item.horaInicio, currentDateTime)
                      : null;
                    return (
                      <div
                        key={item.id}
                        className={`esteira-card ${isDragging ? 'active-drag' : ''}`}
                        draggable={!isFinalizada}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={handleDragEnd}
                        style={{
                          cursor: isFinalizada ? 'default' : (isDragging ? 'grabbing' : 'grab'),
                          opacity: isFinalizada ? 0.78 : 1,
                          ...(isFinalizada
                            ? { backgroundColor: 'var(--color-success-light)', borderColor: 'var(--color-success)' }
                            : {}),
                          ...(scheduleAlert && !isDragging
                            ? { backgroundColor: scheduleAlert.background, borderColor: scheduleAlert.borderColor }
                            : {}),
                        }}
                      >
                        <div className="esteira-card-header" style={{ alignItems: 'flex-start' }}>
                          {item.clienteFoto ? (
                            <img
                              src={item.clienteFoto}
                              alt={item.clienteNome}
                              className="esteira-card-avatar"
                              draggable={false}
                            />
                          ) : (
                            <div className="esteira-card-avatar" style={{ backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexShrink: 0 }}>
                              <User size={16} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span
                              className="esteira-card-nome"
                              onClick={() => onOpenProntuario(item.clienteId)}
                              style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {item.clienteNome}
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Clock size={10} />
                              <span>{item.horaInicio.substring(0, 5)}</span>
                              <span>•</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.profissional}</span>
                            </div>
                          </div>
                          {onUpdateAgendamentoDados && !isFinalizada && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                              title="Editar atendimento"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-text-muted)', flexShrink: 0, lineHeight: 1 }}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>

                        <div className="esteira-card-procedimento">
                          {item.procedimento}
                        </div>

                        {scheduleAlert && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: scheduleAlert.labelBg,
                              color: scheduleAlert.labelColor,
                            }}>
                              <AlertTriangle size={9} />
                              {scheduleAlert.label}
                            </span>
                          </div>
                        )}

                        <div className="esteira-card-footer">
                          {col.id === 'chegou' ? (
                            <span className={isOverWait ? 'tempo-espera-alerta' : ''} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              <span>Espera: {item.tempoEsperaMinutos || 0}m</span>
                            </span>
                          ) : col.id === 'atendimento' ? (
                            <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                              <UserCheck size={12} />
                              <span>Em Atendimento</span>
                            </span>
                          ) : isFinalizada ? (
                            <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <CheckCircle size={12} />
                              <span>R$ {item.valor}{item.metodoPagamento ? ` · ${item.metodoPagamento}` : ''}</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              Preço: R$ {item.valor}
                            </span>
                          )}

                          {/* Trigger state changes visually */}
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {(col.id === 'agendada' || col.id === 'chegou') && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Tem certeza que deseja cancelar esta consulta?')) {
                                    onDeleteAgendamento?.(item.id);
                                  }
                                }}
                                className="btn btn-outline"
                                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', borderColor: '#fca5a5', color: '#ef4444' }}
                                title="Cancelar Consulta"
                              >
                                Cancelar
                              </button>
                            )}
                            {col.id === 'agendada' && (
                              <button
                                onClick={() => onUpdateStatus(item.id, 'chegou')}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}
                                title="Marcar Chegada"
                              >
                                Chegou
                              </button>
                            )}
                            {col.id === 'chegou' && (
                              <button
                                onClick={() => onUpdateStatus(item.id, 'atendimento')}
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}
                                title="Iniciar Atendimento"
                              >
                                Atender
                              </button>
                            )}
                            {col.id === 'atendimento' && (
                              <button
                                onClick={() => onUpdateStatus(item.id, 'checkout')}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}
                                title="Enviar para Checkout"
                              >
                                Concluir
                              </button>
                            )}
                            {col.id === 'checkout' && !isFinalizada && (
                              <>
                                <button
                                  onClick={() => setRegistrarPresencaAgendamento(item)}
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', borderColor: '#5f7d75', color: '#5f7d75' }}
                                  title="Registrar Presença"
                                >
                                  Presença
                                </button>
                                <button
                                  onClick={() => {
                                    setMetodoPagamento('pix');
                                    setShowCheckoutModal(item.id);
                                  }}
                                  className="btn btn-primary"
                                  style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', backgroundColor: 'var(--color-success)' }}
                                  title="Finalizar e Cobrar"
                                >
                                  <CheckCircle size={10} /> Finalizar
                                </button>
                              </>
                            )}
                            {col.id === 'checkout' && isFinalizada && (
                              <span
                                className="badge badge-success"
                                style={{ fontSize: '10px', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <CheckCircle size={10} /> Concluída
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

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
            <h3 style={{ marginBottom: '20px' }}>Agendar Cuidados</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Nome da Cliente</label>
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
                  {procedimentos.length === 0 ? (
                    <option value="">Cadastre procedimentos primeiro</option>
                  ) : (
                    procedimentos.map((p) => (
                      <option key={p.id} value={p.nome}>
                        {p.nome} — R$ {p.preco.toLocaleString('pt-BR')}
                      </option>
                    ))
                  )}
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={newHora.split(':')[0]}
                      onChange={(e) => setNewHora(`${e.target.value}:${newHora.split(':')[1] || '00'}`)}
                    >
                      {Array.from({ length: 15 }, (_, i) => i + 8).map(h => {
                        const hr = h.toString().padStart(2, '0');
                        return <option key={hr} value={hr}>{hr}h</option>;
                      })}
                    </select>
                    <span style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--color-text-main)' }}>:</span>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={newHora.split(':')[1] || '00'}
                      onChange={(e) => setNewHora(`${newHora.split(':')[0] || '08'}:${e.target.value}`)}
                    >
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                        <option key={m} value={m}>{m}m</option>
                      ))}
                    </select>
                  </div>
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
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit appointment modal */}
      {editingId && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '400px', width: '92%', padding: '28px' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>Editar Atendimento</h3>

            <div className="form-group">
              <label className="form-label">Horário de Início</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="form-select"
                  style={{ flex: 1 }}
                  value={editHora.split(':')[0] || '08'}
                  onChange={(e) => setEditHora(`${e.target.value}:${editHora.split(':')[1] || '00'}`)}
                >
                  {Array.from({ length: 15 }, (_, i) => i + 8).map(h => {
                    const hr = h.toString().padStart(2, '0');
                    return <option key={hr} value={hr}>{hr}h</option>;
                  })}
                </select>
                <span style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--color-text-main)' }}>:</span>
                <select
                  className="form-select"
                  style={{ flex: 1 }}
                  value={editHora.split(':')[1] || '00'}
                  onChange={(e) => setEditHora(`${editHora.split(':')[0] || '08'}:${e.target.value}`)}
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                    <option key={m} value={m}>{m}m</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Procedimento</label>
              <select
                className="form-select"
                value={editProcedimento}
                onChange={(e) => setEditProcedimento(e.target.value)}
              >
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Profissional</label>
              {profissionais.length === 1 ? (
                <input
                  type="text"
                  className="form-input"
                  value={`${profissionais[0].nome} (${profissionais[0].cargo})`}
                  readOnly
                />
              ) : (
                <select
                  className="form-select"
                  value={editProfissionalId}
                  onChange={(e) => setEditProfissionalId(e.target.value)}
                >
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="btn btn-outline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="btn btn-primary"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout / Payment-method modal */}
      {showCheckoutModal && (
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
          <div className="card" style={{ maxWidth: '420px', width: '92%', padding: '32px' }}>
            <h3 style={{ marginBottom: '8px' }}>Finalizar Atendimento</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Selecione a forma de pagamento utilizada para concluir o checkout.
            </p>

            <div className="form-group">
              <label className="form-label">Forma de Pagamento</label>
              <select
                className="form-select"
                value={metodoPagamento}
                onChange={(e) => setMetodoPagamento(e.target.value as Agendamento['metodoPagamento'])}
              >
                <option value="pix">Pix</option>
                <option value="credito">Cartão de Crédito</option>
                <option value="debito">Cartão de Débito</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(null)}
                className="btn btn-outline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (showCheckoutModal) {
                    onUpdateStatus(showCheckoutModal, 'finalizada', { metodoPagamento });
                  }
                  setShowCheckoutModal(null);
                }}
                className="btn btn-primary"
              >
                Confirmar e Finalizar
              </button>
            </div>
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

      {/* Registrar Presença Modal */}
      {registrarPresencaAgendamento && (
        <RegistrarPresenca
          agendamento={registrarPresencaAgendamento}
          userId={userId || ''}
          onClose={() => setRegistrarPresencaAgendamento(null)}
          onSuccess={() => {
            setRegistrarPresencaAgendamento(null);
            // Reload agendamentos to reflect updated attendance status
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};
