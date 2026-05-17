import React, { useState, useEffect } from 'react';
import type { Cliente, ProntuarioEstetico, EvolucaoClinica } from '../types';
import { FileText, Camera, Plus } from 'lucide-react';
import { api } from '../lib/api';

interface ProntuarioProps {
  selectedClienteId: string | null;
  userId: string;
  onClose?: () => void;
}

export const Prontuario: React.FC<ProntuarioProps> = ({ selectedClienteId, userId }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [activeClienteId, setActiveClienteId] = useState<string>(selectedClienteId || '');
  const [evolucoes, setEvolucoes] = useState<EvolucaoClinica[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  
  // States for adding a new clinical evolution
  const [newEvolucaoText, setNewEvolucaoText] = useState('');
  const [newEvolucaoProc, setNewEvolucaoProc] = useState('Toxina Botulínica (Botox)');
  const [newEvolucaoObs, setNewEvolucaoObs] = useState('');

  useEffect(() => {
    loadClientes();
  }, [userId]);

  useEffect(() => {
    if (activeClienteId) {
      loadEvolucoes(activeClienteId);
    }
  }, [activeClienteId, userId]);

  const loadClientes = async () => {
    try {
      const data = await api.getClientes(userId);
      setClientes(data);
      if (data.length > 0 && !activeClienteId) {
        setActiveClienteId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClientes(false);
    }
  };

  const loadEvolucoes = async (clienteId: string) => {
    try {
      const data = await api.getEvolucoes(userId, clienteId);
      setEvolucoes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const currentCliente = clientes.find(c => c.id === activeClienteId);
  const currentProntuario = { clienteId: activeClienteId, evolucoes, galeria: [] };

  const handleAddEvolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvolucaoText.trim() || !activeClienteId) return;

    try {
      await api.createEvolucao(activeClienteId, {
        data: new Date().toISOString().split('T')[0],
        profissional: 'Profissional Logado', // could fetch from session
        procedimento: newEvolucaoProc,
        relatoNatural: newEvolucaoText,
        observacoesTecnicas: newEvolucaoObs || 'Sem intercorrências técnicas.'
      }, userId);

      setNewEvolucaoText('');
      setNewEvolucaoObs('');
      alert('Evolução clínica registrada com sucesso no prontuário.');
      loadEvolucoes(activeClienteId);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar evolução.');
    }
  };

  if (loadingClientes) {
    return <div>Carregando prontuários...</div>;
  }

  if (clientes.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Nenhuma cliente cadastrada no seu perfil ainda. Crie novos agendamentos para registrar clientes.
      </div>
    );
  }

  /**
   * UX Design Decision: Natural Language & Visual Side-by-Side
   * Aesthetic clinical evolutions are often cold and hard to digest.
   * We present clinical timelines as "Histórico de Bem-estar" in rich natural texts, 
   * followed by technical specs (batch number, syringe count) in separate small pills.
   * Photos of before-after are shown side-by-side with discrete borders representing luxury.
   */
  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
          Prontuário Estético Visual
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Consulte o histórico completo de bem-estar de suas clientes, evoluções clínicas e evoluções de fotos.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Side: Client Selector */}
        <div className="card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '16px', textTransform: 'uppercase' }}>
            Selecione a Cliente
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clientes.map(cliente => (
              <button
                key={cliente.id}
                onClick={() => {
                  setActiveClienteId(cliente.id);
                  // Sync with active selections if needed
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid ' + (activeClienteId === cliente.id ? 'var(--color-primary)' : 'transparent'),
                  backgroundColor: activeClienteId === cliente.id ? 'var(--color-primary-light)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <img 
                  src={cliente.fotoUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'} 
                  alt={cliente.nome} 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>{cliente.nome}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Última visita: {cliente.dataUltimaVisita ? new Date(cliente.dataUltimaVisita).toLocaleDateString('pt-BR') : 'N/A'}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Prontuário Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {currentCliente && (
            <div className="card" style={{ padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img 
                  src={currentCliente.fotoUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'} 
                  alt={currentCliente.nome} 
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                />
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>{currentCliente.nome}</h2>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    <span>Nasc: {currentCliente.dataNascimento ? new Date(currentCliente.dataNascimento).toLocaleDateString('pt-BR') : 'N/A'}</span>
                    <span>•</span>
                    <span>Contato: {currentCliente.telefone}</span>
                    <span>•</span>
                    <span>E-mail: {currentCliente.email}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {(currentCliente.tags || []).map((tag: string) => (
                  <span key={tag} className="badge badge-sage">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Galeria Antes e Depois */}
          <div className="card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Camera size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Evolução por Imagem (Antes & Depois)</h3>
            </div>

            {currentProntuario.galeria.length === 0 ? (
              <div style={{ 
                padding: '40px', 
                border: '1px dashed var(--color-border)', 
                borderRadius: 'var(--border-radius-md)', 
                textAlign: 'center', 
                color: 'var(--color-text-muted)' 
              }}>
                Nenhuma foto registrada para esta cliente ainda. Registre a evolução na próxima consulta.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {currentProntuario.galeria.map((gal) => (
                  <div key={gal.id}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '12px' }}>
                      {/* Antes */}
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--border-radius-md)' }}>
                        <img 
                          src={gal.imagemAntes} 
                          alt="Antes" 
                          style={{ width: '100%', height: '240px', objectFit: 'cover' }}
                        />
                        <div style={{ 
                          position: 'absolute', 
                          bottom: '12px', 
                          left: '12px', 
                          background: 'rgba(44, 48, 46, 0.75)', 
                          color: '#FFFFFF', 
                          padding: '4px 10px', 
                          borderRadius: '4px',
                          fontSize: '11px' 
                        }}>
                          Antes ({new Date(gal.dataAntes).toLocaleDateString('pt-BR')})
                        </div>
                      </div>

                      {/* Depois */}
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--border-radius-md)' }}>
                        <img 
                          src={gal.imagemDepois} 
                          alt="Depois" 
                          style={{ width: '100%', height: '240px', objectFit: 'cover' }}
                        />
                        <div style={{ 
                          position: 'absolute', 
                          bottom: '12px', 
                          left: '12px', 
                          background: 'var(--color-primary)', 
                          color: '#FFFFFF', 
                          padding: '4px 10px', 
                          borderRadius: '4px',
                          fontSize: '11px' 
                        }}>
                          Evolução ({new Date(gal.dataDepois).toLocaleDateString('pt-BR')})
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                      {gal.descricao}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico e Nova Evolução */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
            
            {/* Timeline of Evolutions */}
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Histórico de Bem-Estar</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                {currentProntuario.evolucoes.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Sem evoluções registradas.</p>
                ) : (
                  currentProntuario.evolucoes.map((ev, idx) => (
                    <div key={ev.id} style={{ 
                      position: 'relative', 
                      paddingLeft: '24px', 
                      borderLeft: '2px solid var(--color-primary-light)',
                      paddingBottom: idx === currentProntuario.evolucoes.length - 1 ? '0' : '16px'
                    }}>
                      {/* Timeline circle indicator */}
                      <div style={{
                        position: 'absolute',
                        left: '-6px',
                        top: '4px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary)',
                        border: '2px solid #FFFFFF'
                      }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                          {new Date(ev.data).toLocaleDateString('pt-BR')}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {ev.profissional}
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                        {ev.procedimento}
                      </div>

                      <p style={{ fontSize: '13px', color: 'var(--color-text-main)', lineHeight: '1.5', marginBottom: '8px' }}>
                        {ev.relatoNatural}
                      </p>

                      <div style={{ 
                        fontSize: '11px', 
                        backgroundColor: '#F8F9F8', 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        color: 'var(--color-text-muted)', 
                        border: '1px solid #ECECEC' 
                      }}>
                        <strong>Anotação Técnica:</strong> {ev.observacoesTecnicas}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Form for New Evolution */}
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <Plus size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Nova Evolução Clínica</h3>
              </div>

              <form onSubmit={handleAddEvolucao}>
                <div className="form-group">
                  <label className="form-label">Procedimento Realizado</label>
                  <select 
                    className="form-select"
                    value={newEvolucaoProc}
                    onChange={(e) => setNewEvolucaoProc(e.target.value)}
                  >
                    <option value="Toxina Botulínica (Botox)">Toxina Botulínica (Botox)</option>
                    <option value="Lavieen (Pele de Porcelana)">Lavieen (Pele de Porcelana)</option>
                    <option value="Preenchimento com Ácido Hialurônico">Preenchimento com Ácido Hialurônico</option>
                    <option value="Bioestimulador de Colágeno (Radiesse)">Bioestimulador de Colágeno (Radiesse)</option>
                    <option value="Peeling Químico Renovador">Peeling Químico Renovador</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Relato da Paciente (Texto Natural e Acolhedor)</label>
                  <textarea 
                    rows={4}
                    className="form-textarea"
                    placeholder="Ex: Cliente adorou o resultado inicial. Apresentou leve rubor na bochecha, pele iluminada de imediato."
                    value={newEvolucaoText}
                    onChange={(e) => setNewEvolucaoText(e.target.value)}
                    style={{ resize: 'none' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parâmetros e Lotes (Dados Técnicos)</label>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="Ex: Restylane Refyne 0.5ml. Lote H9031."
                    value={newEvolucaoObs}
                    onChange={(e) => setNewEvolucaoObs(e.target.value)}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  Registrar no Prontuário
                </button>
              </form>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
