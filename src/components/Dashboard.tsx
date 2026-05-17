import React, { useState } from 'react';
import type { Agendamento, StatusJornada } from '../types';
import { Clock, UserCheck, UserPlus, CheckCircle } from 'lucide-react';

interface DashboardProps {
  agendamentos: Agendamento[];
  onUpdateStatus: (id: string, newStatus: StatusJornada) => void;
  onOpenProntuario: (clienteId: string) => void;
  onAddAgendamento: (
    agendamento: Omit<Agendamento, 'id'>,
    extra?: { telefone?: string }
  ) => void;
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

export const Dashboard: React.FC<DashboardProps> = ({
  agendamentos,
  onUpdateStatus,
  onOpenProntuario,
  onAddAgendamento,
  userName,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newTelefone, setNewTelefone] = useState('');
  const [newProcedimento, setNewProcedimento] = useState('Toxina Botulínica (Botox)');
  const [newHora, setNewHora] = useState('14:30');
  const [newData, setNewData] = useState<string>(() => new Date().toISOString().split('T')[0]);

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

    onAddAgendamento(
      {
        clienteId: 'c_' + Math.random().toString(36).slice(2, 10),
        clienteNome: newNome.trim(),
        data: newData,
        horaInicio: newHora,
        horaFim: addMinutesToTime(newHora, 60),
        profissional: 'Dra. Helena Martins',
        sala: 'Cabine 01 - Clínica',
        procedimento: newProcedimento,
        status: 'agendada',
        valor: 1200,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
            Olá, {userName || 'Helena'}! Aqui está o ritmo da clínica hoje.
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Acompanhe a jornada de cuidados e proporcione uma experiência memorável.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          <UserPlus size={16} />
          <span>Acolher nova/novo paciente</span>
        </button>
      </div>

      {/* Grid columns */}
      <div className="esteira-container">
        {colunas.map((col) => {
          const colAgendamentos = agendamentos.filter((a) => a.status === col.id);
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
                    return (
                      <div
                        key={item.id}
                        className={`esteira-card ${isDragging ? 'active-drag' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={handleDragEnd}
                        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                      >
                        <div className="esteira-card-header">
                          <img
                            src={item.clienteFoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={item.clienteNome}
                            className="esteira-card-avatar"
                            draggable={false}
                          />
                          <div>
                            <span
                              className="esteira-card-nome"
                              onClick={() => onOpenProntuario(item.clienteId)}
                              style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {item.clienteNome}
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {item.horaInicio} • {item.profissional.split(' ')[1] || item.profissional}
                            </div>
                          </div>
                        </div>

                        <div className="esteira-card-procedimento">
                          {item.procedimento}
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <span style={{ fontSize: '9px', background: '#F0F0F0', color: '#666', padding: '2px 6px', borderRadius: '4px' }}>
                            {item.sala.split(' - ')[0]}
                          </span>
                        </div>

                        <div className="esteira-card-footer">
                          {col.id === 'chegou' ? (
                            <span className={isOverWait ? 'tempo-espera-alerta' : ''} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              <span>Espera: {item.tempoEsperaMinutos || 0}m</span>
                            </span>
                          ) : col.id === 'atendimento' ? (
                            <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                              <UserCheck size={12} />
                              <span>Em Cabine</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              Preço: R$ {item.valor}
                            </span>
                          )}

                          {/* Trigger state changes visually */}
                          <div style={{ display: 'flex', gap: '4px' }}>
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
                            {col.id === 'checkout' && (
                              <button
                                onClick={() => onUpdateStatus(item.id, 'finalizada')}
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', backgroundColor: 'var(--color-success)' }}
                                title="Finalizar e Cobrar"
                              >
                                <CheckCircle size={10} /> Finalizar
                              </button>
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
        <div style={{
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
          <div className="card" style={{ width: '440px', padding: '32px' }}>
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
                  type="tel"
                  className="form-input"
                  value={newTelefone}
                  onChange={(e) => setNewTelefone(e.target.value)}
                  placeholder="(11) 99999-0000"
                  pattern="^[0-9()\\-\\s\\+]{8,}$"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Procedimento</label>
                <select
                  className="form-select"
                  value={newProcedimento}
                  onChange={(e) => setNewProcedimento(e.target.value)}
                >
                  <option value="Toxina Botulínica (Botox)">Toxina Botulínica (Botox)</option>
                  <option value="Lavieen (Pele de Porcelana)">Lavieen (Pele de Porcelana)</option>
                  <option value="Preenchimento com Ácido Hialurônico">Preenchimento com Ácido Hialurônico</option>
                  <option value="Bioestimulador de Colágeno (Radiesse)">Bioestimulador de Colágeno (Radiesse)</option>
                  <option value="Peeling Químico Renovador">Peeling Químico Renovador</option>
                </select>
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
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
