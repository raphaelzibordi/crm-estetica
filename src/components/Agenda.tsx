import React, { useState } from 'react';
import type { Agendamento } from '../types';
import { Users, Clock, Sparkles } from 'lucide-react';
import { mockProcedimentos } from '../data/mockData';

interface AgendaProps {
  agendamentos: Agendamento[];
  onAddAgendamento: (agendamento: Omit<Agendamento, 'id'>) => void;
}

export const Agenda: React.FC<AgendaProps> = ({ agendamentos, onAddAgendamento }) => {
  const [selectedProcedimento, setSelectedProcedimento] = useState<string>(mockProcedimentos[0].id);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('Dra. Helena Martins');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Time slots for the calendar view (08:00 - 17:00)
  const slots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  // Helper to find if an appointment is booked for a specific hour block
  const getAgendamentoForSlot = (time: string) => {
    return agendamentos.find(a => {
      const [aHour] = a.horaInicio.split(':');
      const [slotHour] = time.split(':');
      return aHour === slotHour;
    });
  };

  const handleEncaixeIdeal = () => {
    const proc = mockProcedimentos.find(p => p.id === selectedProcedimento);
    if (!proc) return;

    // Simulate smart logic matching professionals and cabins
    // For Helena and Botox (45m), find slots that do not have appointments
    const suggestionsList = [
      {
        hora: '11:00',
        profissional: proc.profissionalResponsavel,
        sala: proc.salaRequerida,
        motivo: 'Intervalo perfeito de 90min entre procedimentos. A cabine estará higienizada.',
        confiabilidade: '98%'
      },
      {
        hora: '13:00',
        profissional: proc.profissionalResponsavel,
        sala: proc.salaRequerida,
        motivo: 'Horário logo após o almoço da profissional, cabine totalmente disponível.',
        confiabilidade: '95%'
      },
      {
        hora: '17:00',
        profissional: proc.profissionalResponsavel,
        sala: proc.salaRequerida,
        motivo: 'Último bloco do dia. Permite atendimento calmo e sem sobreposição de fluxo.',
        confiabilidade: '90%'
      }
    ];

    setSugestoes(suggestionsList);
    setHasSearched(true);
  };

  const agendarSugerido = (sug: any) => {
    const proc = mockProcedimentos.find(p => p.id === selectedProcedimento);
    if (!proc) return;

    onAddAgendamento({
      clienteId: 'c_temp',
      clienteNome: 'Mariana Azevedo (Encaixe)',
      data: '2026-05-17',
      horaInicio: sug.hora,
      horaFim: '12:00', // auto compute based on duration later
      profissional: sug.profissional,
      sala: sug.sala,
      procedimento: proc.nome,
      status: 'agendada',
      valor: proc.preco
    });

    // Remove slot from suggestions or reset
    setSugestoes(prev => prev.filter(item => item.hora !== sug.hora));
    alert(`Encaixe realizado com sucesso para ${sug.hora}! Mariana Azevedo foi agendada.`);
  };

  /**
   * UX Comment: 
   * High performance agendas focus on optimization of void times.
   * Our calendar visually highlights "Horário Ocioso" (Idle Slots) in safe green,
   * while showcasing active hours elegantly. The "Encaixe Ideal" engine acts as an 
   * active receptionist assistant, analyzing 3 vectors (professional, cabin/machine, and patient buffer).
   */
  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
          Agenda & Ocupação Inteligente
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Visualize o fluxo do dia e preencha horários vagos com o algoritmo de encaixe ideal.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '32px' }}>
        
        {/* Left Side: Dynamic Day Grid */}
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Quarta-feira, 17 de Maio de 2026</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-sage">Hoje</span>
              <span className="badge badge-neutral">Visão Dia</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {slots.map(slot => {
              const booked = getAgendamentoForSlot(slot);
              
              return (
                <div key={slot} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '16px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-md)',
                  backgroundColor: booked ? '#FFFFFF' : 'var(--color-success-light)',
                  transition: 'var(--transition-smooth)',
                  minHeight: '80px'
                }}>
                  {/* Hour */}
                  <div style={{ 
                    width: '70px', 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    color: booked ? 'var(--color-text-main)' : 'var(--color-success)' 
                  }}>
                    {slot}
                  </div>

                  {/* Slot Details */}
                  {booked ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{booked.clienteNome}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '12px', marginTop: '4px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {booked.procedimento}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={12} /> {booked.profissional}
                          </span>
                        </div>
                      </div>
                      <span className={`badge ${
                        booked.status === 'finalizada' ? 'badge-neutral' : 'badge-sage'
                      }`}>
                        {booked.status}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                      <div>
                        <span style={{ 
                          color: 'var(--color-success)', 
                          fontWeight: 500, 
                          fontSize: '13px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Sparkles size={14} /> Horário Ocioso - Disponível para Encaixe
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Nenhuma reserva ativa para salas ou profissionais neste bloco.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Encaixe Ideal Algorithm Panel */}
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
              <select 
                className="form-select" 
                value={selectedProcedimento} 
                onChange={(e) => setSelectedProcedimento(e.target.value)}
              >
                {mockProcedimentos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Profissional Desejado</label>
              <select 
                className="form-select"
                value={selectedProfessional}
                onChange={(e) => setSelectedProfessional(e.target.value)}
              >
                <option value="Dra. Helena Martins">Dra. Helena Martins (Médica)</option>
                <option value="Esteticista Sarah Kelly">Esteticista Sarah Kelly (Estética)</option>
              </select>
            </div>

            <button 
              onClick={handleEncaixeIdeal} 
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
            >
              Calcular Melhor Encaixe
            </button>
          </div>

          {/* Results Suggestions */}
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
                      borderLeft: '4px solid var(--color-primary)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {sug.hora}
                        </span>
                        <span className="badge badge-success" style={{ fontSize: '10px' }}>
                          Compatibilidade {sug.confiabilidade}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>Cabine:</strong> {sug.sala}
                        </div>
                        <div>
                          {sug.motivo}
                        </div>
                      </div>

                      <button 
                        onClick={() => agendarSugerido(sug)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', width: '100%', fontSize: '11px', justifyContent: 'center' }}
                      >
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
    </div>
  );
};
