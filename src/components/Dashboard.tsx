import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Agendamento, Procedimento, Profissional, Room, StatusJornada, Unidade } from '../types';
import { Clock, UserCheck, UserPlus, CheckCircle, User, Pencil, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { findAgendamentoConflict, getSalasStatus, type SalaStatus } from '../lib/agendaConflict';
import { RegistrarPresenca } from './RegistrarPresenca';

const OWNER_ID = '__owner__';

interface DashboardProps {
  agendamentos: Agendamento[];
  onUpdateStatus: (id: string, newStatus: StatusJornada, extras?: { metodoPagamento?: Agendamento['metodoPagamento']; valor?: number; procedimentos?: Agendamento['procedimentos'] }) => void;
  onUpdateAgendamentoDados?: (id: string, updates: { data?: string; horaInicio?: string; horaFim?: string; procedimento?: string; profissional?: string; sala?: string }) => void;
  onOpenProntuario: (clienteId: string) => void;
  onAddAgendamento: (
    agendamento: Omit<Agendamento, 'id'>,
    extra?: { telefone?: string }
  ) => void;
  onDeleteAgendamento?: (id: string) => void;
  userId?: string;
  userName?: string;
  plano?: string | null;
  unidadeId?: string | null;
  unidades?: Unidade[];
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
  plano,
  unidadeId,
  unidades,
}) => {
  const unidadesAtivas = (unidades ?? []).filter(u => u.ativo);
  const unidadeParaNovoCadastro = unidadeId ?? (unidadesAtivas.length === 1 ? unidadesAtivas[0].id : null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [equipe, setEquipe] = useState<Array<{ id: string; nome: string; cargo: string }>>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState<string | null>(null);
  const [metodoPagamento, setMetodoPagamento] = useState<Agendamento['metodoPagamento']>('pix');
  const [checkoutItens, setCheckoutItens] = useState<Array<{ procedimentoId: string; nome: string; preco: number; duracaoMinutos: number; valorCobrado: string }>>([]);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [registrarPresencaAgendamento, setRegistrarPresencaAgendamento] = useState<Agendamento | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.ensureSeedData(userId).catch(() => {});
        const [procs, team, loadedRooms] = await Promise.all([
          api.getProcedimentos(userId),
          api.getEquipe(userId, { somenteAtivos: true }).catch(() => []),
          api.getRooms(userId).catch(() => [] as Room[]),
        ]);
        if (cancelled) return;
        setProcedimentos(procs);
        setEquipe(team.map(m => ({ id: m.id, nome: m.nome, cargo: m.cargo })));
        setRooms(loadedRooms.filter(r => r.status === 'ativa'));
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

  const formatDataNascimento = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    const truncated = numbersOnly.slice(0, 8);
    if (truncated.length <= 2) return truncated;
    if (truncated.length <= 4) return `${truncated.slice(0, 2)}/${truncated.slice(2)}`;
    return `${truncated.slice(0, 2)}/${truncated.slice(2, 4)}/${truncated.slice(4)}`;
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

  const [showCadastrarPacienteModal, setShowCadastrarPacienteModal] = useState(false);
  const [cadastrarNome, setCadastrarNome] = useState('');
  const [cadastrarTelefone, setCadastrarTelefone] = useState('');
  const [cadastrarNasc, setCadastrarNasc] = useState('');
  const [cadastrarEmail, setCadastrarEmail] = useState('');
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);

  const [newNome, setNewNome] = useState('');
  const [newTelefone, setNewTelefone] = useState('');
  const [newProcedimento, setNewProcedimento] = useState('');
  const [newProfissionalId, setNewProfissionalId] = useState<string>(OWNER_ID);
  const [newSala, setNewSala] = useState<string>('');
  const [newHora, setNewHora] = useState('14:30');
  const [newData, setNewData] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

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
  const [editData, setEditData] = useState('');
  const [editHora, setEditHora] = useState('');
  const [editProcedimento, setEditProcedimento] = useState('');
  const [editProfissionalId, setEditProfissionalId] = useState<string>(OWNER_ID);
  const [editSala, setEditSala] = useState('');
  const [editSalaOptions, setEditSalaOptions] = useState<SalaStatus[]>([]);
  const [editSalaHistorico, setEditSalaHistorico] = useState<Array<{ from: string; to: string; changedAt: string }>>([]);

  const openEditModal = (item: Agendamento) => {
    setEditData(item.data);
    setEditingId(item.id);
    setEditHora(item.horaInicio.substring(0, 5));
    setEditProcedimento(item.procedimento);
    setEditSala(item.sala ?? '');
    setEditSalaHistorico(item.salaHistorico ?? []);
    const match = profissionais.find((p) => p.nome === item.profissional);
    setEditProfissionalId(match?.id ?? profissionais[0]?.id ?? OWNER_ID);
    // Compute sala options from rooms table (active rooms for this account)
    const allSalas = rooms.filter((r) => r.status === 'ativa').map((r) => r.name);
    if (allSalas.length > 0 && item.sala && !allSalas.includes(item.sala)) allSalas.push(item.sala);
    const options = getSalasStatus(allSalas, item.data, item.horaInicio.substring(0, 5), item.horaFim.substring(0, 5), agendamentos, item.id);
    setEditSalaOptions(options);
  };

  const handleSaveEdit = () => {
    if (!editingId || !onUpdateAgendamentoDados) return;
    const prof = profissionais.find((p) => p.id === editProfissionalId);
    const proc = procedimentos.find((p) => p.nome === editProcedimento);
    const duracao = proc?.duracaoMinutos ?? 60;
    onUpdateAgendamentoDados(editingId, {
      data: editData,
      horaInicio: editHora,
      horaFim: addMinutesToTime(editHora, duracao),
      procedimento: editProcedimento,
      profissional: prof?.nome ?? editProcedimento,
      sala: editSala || undefined,
    });
    setEditingId(null);
  };

  // DnD state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<StatusJornada | null>(null);

  // Touch DnD
  const touchGhostRef = useRef<HTMLDivElement>(null);
  const touchActiveRef = useRef<{ id: string } | null>(null);
  const [touchGhostPos, setTouchGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [touchGhostLabel, setTouchGhostLabel] = useState('');

  const colunas: { id: StatusJornada; label: string; desc: string }[] = [
    { id: 'agendada', label: 'Confirmadas para Hoje', desc: 'Próximos agendamentos' },
    { id: 'chegou', label: 'Chegaram na Clínica', desc: 'Em recepção / aguardando' },
    { id: 'atendimento', label: 'Em Cabine', desc: 'Procedimento em andamento' },
    { id: 'checkout', label: 'Checkout / Conclusão', desc: 'Pós-procedimento imediato' },
  ];

  const handleCadastrarPacienteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cadastrarNome.trim()) return;

    const rawTelefone = cadastrarTelefone.replace(/\D/g, '');
    if (rawTelefone && rawTelefone.length < 10) {
      alert('Por favor, informe um telefone de contato válido com DDD (mínimo 10 dígitos).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (cadastrarEmail && !emailRegex.test(cadastrarEmail)) {
      alert('Por favor, insira um e-mail válido.');
      return;
    }

    let dbDataNascimento = '';
    if (cadastrarNasc) {
      const parts = cadastrarNasc.split('/');
      const dia = parseInt(parts[0], 10);
      const mes = parseInt(parts[1], 10);
      const ano = parseInt(parts[2], 10);
      const dataValida =
        parts.length === 3 &&
        parts[0].length === 2 &&
        parts[1].length === 2 &&
        parts[2].length === 4 &&
        dia >= 1 && dia <= 31 &&
        mes >= 1 && mes <= 12 &&
        ano >= 1900 && ano <= new Date().getFullYear();
      if (!dataValida) {
        alert('Data de nascimento inválida. Use o formato DD/MM/AAAA com valores reais (ex: 15/08/1990).');
        return;
      }
      dbDataNascimento = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    setSalvandoCadastro(true);
    try {
      await api.createCliente({
        nome: cadastrarNome.trim(),
        telefone: cadastrarTelefone.trim() || undefined,
        email: cadastrarEmail.trim() || undefined,
        dataNascimento: dbDataNascimento || undefined,
        unidadeId: unidadeParaNovoCadastro,
      }, userId);
      setCadastrarNome('');
      setCadastrarTelefone('');
      setCadastrarNasc('');
      setCadastrarEmail('');
      setShowCadastrarPacienteModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar paciente.');
    } finally {
      setSalvandoCadastro(false);
    }
  };

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
    const sala = newSala || proc?.salaRequerida || '';
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
        clienteId: 'c_' + crypto.randomUUID().slice(0, 8),
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
    setNewSala('');
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

  // ── Touch DnD handlers ──────────────────────────────────────────────
  const handleTouchStartCard = (
    e: React.TouchEvent<HTMLDivElement>,
    id: string,
    nome: string
  ) => {
    const touch = e.touches[0];
    touchActiveRef.current = { id };
    setTouchGhostLabel(nome);
    setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
    setDragId(id);
  };

  const handleTouchMoveCard = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchActiveRef.current) return;
    const touch = e.touches[0];
    setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
    const ghostEl = touchGhostRef.current;
    if (ghostEl) ghostEl.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (ghostEl) ghostEl.style.display = '';
    const col = el?.closest('[data-dnd-col]');
    const colId = (col?.getAttribute('data-dnd-col') ?? null) as StatusJornada | null;
    setDragOverCol(colId);
  };

  const handleTouchEndCard = () => {
    if (!touchActiveRef.current) return;
    const id = touchActiveRef.current.id;
    const colId = dragOverCol;
    touchActiveRef.current = null;
    setTouchGhostPos(null);
    setDragId(null);
    setDragOverCol(null);
    if (!id || !colId) return;
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
          onClick={() => setShowCadastrarPacienteModal(true)}
          className="btn btn-primary"
        >
          <UserPlus size={16} />
          <span>Nova(o) paciente</span>
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
              data-dnd-col={col.id}
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
                        onTouchStart={!isFinalizada ? (e) => handleTouchStartCard(e, item.id, item.clienteNome) : undefined}
                        onTouchMove={!isFinalizada ? handleTouchMoveCard : undefined}
                        onTouchEnd={!isFinalizada ? handleTouchEndCard : undefined}
                        style={{
                          cursor: isFinalizada ? 'default' : (isDragging ? 'grabbing' : 'grab'),
                          touchAction: isFinalizada ? undefined : 'none',
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
                                    setCheckoutItens(
                                      item.procedimentos && item.procedimentos.length > 0
                                        ? item.procedimentos.map((p) => ({
                                            procedimentoId: p.procedimentoId,
                                            nome: p.nome,
                                            preco: p.preco,
                                            duracaoMinutos: p.duracaoMinutos,
                                            valorCobrado: String(p.valorCobrado ?? p.preco ?? ''),
                                          }))
                                        : [{
                                            procedimentoId: '',
                                            nome: item.procedimento,
                                            preco: item.valor,
                                            duracaoMinutos: 0,
                                            valorCobrado: String(item.valor ?? ''),
                                          }]
                                    );
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
      {showCadastrarPacienteModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => setShowCadastrarPacienteModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '440px', width: '92%', padding: '32px' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '20px' }}>Cadastrar Paciente</h3>
            <form onSubmit={handleCadastrarPacienteSubmit}>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input
                  type="text"
                  className="form-input"
                  value={cadastrarNome}
                  onChange={e => setCadastrarNome(e.target.value)}
                  placeholder="Ex: Amanda Santos"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  type="text"
                  className="form-input"
                  value={cadastrarTelefone}
                  onChange={e => setCadastrarTelefone(formatTelefone(e.target.value))}
                  placeholder="(XX) 9XXXX-XXXX"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Data de Nascimento</label>
                <input
                  type="text"
                  className="form-input"
                  value={cadastrarNasc}
                  onChange={e => setCadastrarNasc(formatDataNascimento(e.target.value))}
                  placeholder="DD/MM/AAAA"
                />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  type="text"
                  className="form-input"
                  value={cadastrarEmail}
                  onChange={e => setCadastrarEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowCadastrarPacienteModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvandoCadastro || !cadastrarNome.trim()}>
                  <UserPlus size={15} />
                  {salvandoCadastro ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

              {rooms.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Sala de Atendimento</label>
                  <select
                    className="form-select"
                    value={newSala}
                    onChange={(e) => setNewSala(e.target.value)}
                  >
                    <option value="">Sem sala</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}

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
              <label className="form-label">Data</label>
              <input
                type="date"
                className="form-input"
                value={editData}
                onChange={(e) => setEditData(e.target.value)}
                required
              />
            </div>

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

            {editSalaOptions.length > 0 && plano && plano !== 'basico' && (
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Sala de Atendimento
                  {editSala && (() => {
                    const s = editSalaOptions.find((o) => o.sala === editSala);
                    return s ? (
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
                        background: s.disponivel ? '#d1fae5' : '#fee2e2',
                        color: s.disponivel ? '#065f46' : '#991b1b',
                      }}>
                        {s.disponivel ? 'Disponível' : 'Ocupada'}
                      </span>
                    ) : null;
                  })()}
                </label>
                <select
                  className="form-select"
                  value={editSala}
                  onChange={(e) => setEditSala(e.target.value)}
                >
                  {editSalaOptions.map((o) => (
                    <option key={o.sala} value={o.sala}>
                      {o.disponivel ? `${o.sala} (Disponível)` : `${o.sala} (Ocupada — ${o.ocupadaPor})`}
                    </option>
                  ))}
                </select>
                {editSala && editSalaOptions.find((o) => o.sala === editSala && !o.disponivel) && (
                  <p style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>
                    Esta sala está ocupada neste horário. Ao salvar, o sistema validará e poderá bloquear a operação.
                  </p>
                )}
              </div>
            )}

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

            {editSalaHistorico.length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--color-primary-light)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Histórico de Mudanças de Sala
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {editSalaHistorico.map((entry, i) => (
                    <div key={i} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      <span style={{ color: 'var(--color-text-main)', fontWeight: 500 }}>
                        {new Date(entry.changedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {' — '}"{entry.from || '—'}" → "{entry.to}"
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              Confirme o valor cobrado e selecione a forma de pagamento para concluir o checkout.
            </p>

            <div className="form-group">
              <label className="form-label">Valor Cobrado por Procedimento (R$)</label>
              {checkoutItens.map((item, idx) => (
                <div key={item.procedimentoId || idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</span>
                  <div style={{ position: 'relative', width: '130px', flexShrink: 0 }}>
                    <span style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)',
                      fontWeight: 600,
                      fontSize: '13px',
                      pointerEvents: 'none',
                    }}>R$</span>
                    <input
                      type="number"
                      className="form-input"
                      style={{ paddingLeft: '32px' }}
                      value={item.valorCobrado}
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      onChange={(e) => {
                        const novoValor = e.target.value;
                        setCheckoutItens((prev) => prev.map((it, i) => i === idx ? { ...it, valorCobrado: novoValor } : it));
                      }}
                    />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--color-border)', marginTop: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>Total</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  R$ {checkoutItens.reduce((sum, it) => sum + (parseFloat(it.valorCobrado) || 0), 0).toLocaleString('pt-BR')}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Edite o valor de cada procedimento caso haja desconto ou ajuste antes de finalizar.
              </p>
            </div>

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
                    const itensValidos = checkoutItens.filter((it) => it.procedimentoId);
                    const procedimentosFinal = itensValidos.length > 0
                      ? itensValidos.map((it) => ({
                          procedimentoId: it.procedimentoId,
                          nome: it.nome,
                          duracaoMinutos: it.duracaoMinutos,
                          preco: it.preco,
                          valorCobrado: parseFloat(it.valorCobrado) || 0,
                        }))
                      : undefined;
                    const valorFinal = checkoutItens.reduce((sum, it) => sum + (parseFloat(it.valorCobrado) || 0), 0);
                    onUpdateStatus(showCheckoutModal, 'finalizada', {
                      metodoPagamento,
                      valor: valorFinal,
                      procedimentos: procedimentosFinal,
                    });
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

      {/* Touch drag ghost */}
      {touchGhostPos && (
        <div
          ref={touchGhostRef}
          style={{
            position: 'fixed',
            left: touchGhostPos.x - 80,
            top: touchGhostPos.y - 20,
            background: 'var(--color-primary)',
            color: '#fff',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 600,
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            opacity: 0.9,
            maxWidth: '160px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {touchGhostLabel}
        </div>
      )}
    </div>
  );
};
