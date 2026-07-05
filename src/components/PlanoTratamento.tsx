import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  Pencil,
  Check,
} from 'lucide-react';
import type { PlanoTratamento as PlanoTratamentoType } from '../types';
import { api } from '../lib/api';

interface Props {
  clienteId: string;
  clienteNome: string;
  userId: string;
  userName?: string;
  onAgendar?: (plano: PlanoTratamentoType, procedimentoNome?: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  ativo: 'Em andamento',
  concluido: 'Concluído',
  encerrado_antecipado: 'Encerrado',
};

const STATUS_COLOR: Record<string, string> = {
  ativo: '#16a34a',
  concluido: '#2563eb',
  encerrado_antecipado: '#9ca3af',
};

const STATUS_BG: Record<string, string> = {
  ativo: '#f0fdf4',
  concluido: '#eff6ff',
  encerrado_antecipado: '#f9fafb',
};

export const PlanoTratamento: React.FC<Props> = ({ clienteId, userId, userName: _userName, onAgendar }) => {
  const [planos, setPlanos] = useState<PlanoTratamentoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlano, setSelectedPlano] = useState<PlanoTratamentoType | null>(null);

  // Novo plano
  const [showNovoPlano, setShowNovoPlano] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoObjetivo, setNovoObjetivo] = useState('');
  const [novoProcedimentos, setNovoProcedimentos] = useState('');
  const [novoTotalSessoes, setNovoTotalSessoes] = useState(6);
  const [novoFrequencia, setNovoFrequencia] = useState('');
  const [novoFrequenciaDias, setNovoFrequenciaDias] = useState<number | ''>('');
  const [novoObs, setNovoObs] = useState('');
  const [savingPlano, setSavingPlano] = useState(false);

  // Encerrar plano
  const [showEncerrar, setShowEncerrar] = useState(false);
  const [motivoEncerramento, setMotivoEncerramento] = useState('');
  const [savingEncerrar, setSavingEncerrar] = useState(false);

  // Editar nome do plano
  const [editingNomeId, setEditingNomeId] = useState<string | null>(null);
  const [editingNomeValue, setEditingNomeValue] = useState('');
  const [savingNome, setSavingNome] = useState(false);

  // Expandir plano na lista para ver procedimentos
  const [expandedPlanoId, setExpandedPlanoId] = useState<string | null>(null);

  useEffect(() => {
    loadPlanos();
  }, [clienteId, userId]);

  async function loadPlanos() {
    setLoading(true);
    try {
      const data = await api.getPlanosTratamento(userId, clienteId);
      setPlanos(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSalvarPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSavingPlano(true);
    try {
      const plano = await api.createPlanoTratamento(userId, clienteId, {
        nomeProtocolo: novoNome.trim(),
        objetivo: novoObjetivo.trim(),
        procedimentos: novoProcedimentos.trim(),
        totalSessoes: novoTotalSessoes,
        frequenciaRecomendada: novoFrequencia.trim(),
        frequenciaDias: novoFrequenciaDias !== '' ? Number(novoFrequenciaDias) : null,
        observacoesIniciais: novoObs.trim(),
        status: 'ativo',
        motivoEncerramento: null,
      });
      setPlanos((prev) => [plano, ...prev]);
      setShowNovoPlano(false);
      setNovoNome(''); setNovoObjetivo(''); setNovoProcedimentos('');
      setNovoTotalSessoes(6); setNovoFrequencia(''); setNovoFrequenciaDias(''); setNovoObs('');
    } finally {
      setSavingPlano(false);
    }
  }

  async function handleSalvarNome(planoId: string) {
    const nome = editingNomeValue.trim();
    if (!nome) { setEditingNomeId(null); return; }
    setSavingNome(true);
    try {
      await api.updatePlanoTratamento(planoId, userId, { nomeProtocolo: nome });
      setPlanos(prev => prev.map(p => p.id === planoId ? { ...p, nomeProtocolo: nome } : p));
      if (selectedPlano?.id === planoId) setSelectedPlano(prev => prev ? { ...prev, nomeProtocolo: nome } : prev);
    } finally {
      setSavingNome(false);
      setEditingNomeId(null);
    }
  }

  async function handleEncerrar(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlano || !motivoEncerramento.trim()) return;
    setSavingEncerrar(true);
    try {
      await api.updatePlanoTratamento(selectedPlano.id, userId, {
        status: 'encerrado_antecipado',
        motivoEncerramento: motivoEncerramento.trim(),
      });
      const updated = await api.getPlanosTratamento(userId, clienteId);
      setPlanos(updated);
      const refreshed = updated.find((p) => p.id === selectedPlano.id);
      if (refreshed) setSelectedPlano(refreshed);
      setShowEncerrar(false);
      setMotivoEncerramento('');
    } finally {
      setSavingEncerrar(false);
    }
  }

  // ── List view ──────────────────────────────────────────────────────
  if (!selectedPlano) {
    return (
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Planos de Tratamento</h3>
          </div>
          <button
            onClick={() => setShowNovoPlano(true)}
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} />
            <span>Novo Plano</span>
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Carregando...</p>
        ) : planos.length === 0 ? (
          <div style={{
            padding: '32px', border: '1px dashed var(--color-border)', borderRadius: 'var(--border-radius-md)',
            textAlign: 'center', color: 'var(--color-text-muted)',
          }}>
            <ClipboardList size={28} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: '13px', marginBottom: '12px' }}>Nenhum plano de tratamento cadastrado.</p>
            <button onClick={() => setShowNovoPlano(true)} className="btn btn-outline" style={{ fontSize: '12px' }}>
              Criar primeiro plano
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {planos.map((plano) => {
              const p = plano as any as PlanoTratamentoType;
              const isExpanded = expandedPlanoId === p.id;
              const nomesProcedimentos = (p.procedimentos || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

              return (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-md)',
                    backgroundColor: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '14px 16px' }}>
                    {nomesProcedimentos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedPlanoId(isExpanded ? null : p.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px', flexShrink: 0 }}
                        title={isExpanded ? 'Recolher' : 'Expandir'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                    <div
                      onClick={() => setSelectedPlano(p)}
                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        {editingNomeId === p.id ? (
                          <input
                            autoFocus
                            className="form-input"
                            value={editingNomeValue}
                            onChange={(e) => setEditingNomeValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); handleSalvarNome(p.id); }
                              if (e.key === 'Escape') setEditingNomeId(null);
                            }}
                            style={{ fontSize: '14px', fontWeight: 600, padding: '2px 8px', flex: 1 }}
                          />
                        ) : (
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {p.nomeProtocolo}
                          </span>
                        )}
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
                          color: STATUS_COLOR[p.status], backgroundColor: STATUS_BG[p.status], flexShrink: 0,
                        }}>
                          {STATUS_LABEL[p.status]}
                        </span>
                        {editingNomeId === p.id ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSalvarNome(p.id); }}
                            disabled={savingNome}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: '2px', flexShrink: 0 }}
                          >
                            <Check size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingNomeId(p.id); setEditingNomeValue(p.nomeProtocolo); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px', flexShrink: 0 }}
                            title="Editar nome"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                      {p.objetivo && (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.objetivo}
                        </p>
                      )}
                    </div>
                    <ChevronLeft
                      size={16}
                      onClick={() => setSelectedPlano(p)}
                      style={{ color: 'var(--color-text-muted)', transform: 'rotate(180deg)', flexShrink: 0, marginLeft: '12px', cursor: 'pointer' }}
                    />
                  </div>

                  {isExpanded && nomesProcedimentos.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--color-border)', backgroundColor: '#f9fafb' }}>
                      {nomesProcedimentos.map((nomeProc, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: '10px', padding: '10px 16px 10px 40px',
                            borderBottom: idx < nomesProcedimentos.length - 1 ? '1px solid var(--color-border)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: '13px', color: 'var(--color-text-main)' }}>{nomeProc}</span>
                          {onAgendar && (
                            <button
                              onClick={() => onAgendar(p, nomeProc)}
                              className="btn btn-primary"
                              title="Agendar consulta com este procedimento"
                              style={{
                                padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                                flexShrink: 0,
                              }}
                            >
                              <Calendar size={13} />
                              <span>Agendar</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Novo Plano */}
        {showNovoPlano && (
          <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
          }} onClick={() => setShowNovoPlano(false)}>
            <div className="modal-inner" style={{
              backgroundColor: '#fff', borderRadius: 'var(--border-radius-lg)',
              padding: '28px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Novo Plano de Tratamento</h3>
                <button onClick={() => setShowNovoPlano(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSalvarPlano} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Nome do Protocolo *</label>
                  <input
                    className="form-input"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Ex: Protocolo Laser Fracionado"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Objetivo</label>
                  <input
                    className="form-input"
                    value={novoObjetivo}
                    onChange={(e) => setNovoObjetivo(e.target.value)}
                    placeholder="Ex: Rejuvenescimento facial e redução de manchas"
                  />
                </div>
                <div>
                  <label className="form-label">Procedimentos Incluídos</label>
                  <input
                    className="form-input"
                    value={novoProcedimentos}
                    onChange={(e) => setNovoProcedimentos(e.target.value)}
                    placeholder="Ex: Laser CO2, Peeling químico"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Número de Sessões *</label>
                    <input
                      type="number"
                      className="form-input"
                      min={1}
                      max={100}
                      value={novoTotalSessoes}
                      onChange={(e) => setNovoTotalSessoes(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Alerta de Retorno (dias)</label>
                    <input
                      type="number"
                      className="form-input"
                      min={1}
                      value={novoFrequenciaDias}
                      onChange={(e) => setNovoFrequenciaDias(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 30"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Frequência Recomendada</label>
                  <input
                    className="form-input"
                    value={novoFrequencia}
                    onChange={(e) => setNovoFrequencia(e.target.value)}
                    placeholder="Ex: 1x por mês"
                  />
                </div>
                <div>
                  <label className="form-label">Observações Iniciais</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={novoObs}
                    onChange={(e) => setNovoObs(e.target.value)}
                    placeholder="Anotações iniciais sobre o protocolo, contraindicações, etc."
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                  <button type="button" onClick={() => setShowNovoPlano(false)} className="btn btn-outline">
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={savingPlano}>
                    {savingPlano ? 'Salvando...' : 'Criar Plano'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────
  return (
    <div className="card" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setSelectedPlano(null); setEditingNomeId(null); }}
          className="btn btn-outline"
          style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
        >
          <ChevronLeft size={14} />
          <span>Planos</span>
        </button>
        <span style={{ color: 'var(--color-text-muted)' }}>/</span>
        {editingNomeId === selectedPlano.id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
            <input
              autoFocus
              className="form-input"
              value={editingNomeValue}
              onChange={(e) => setEditingNomeValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSalvarNome(selectedPlano.id); }
                if (e.key === 'Escape') setEditingNomeId(null);
              }}
              style={{ fontSize: '14px', fontWeight: 600, padding: '3px 8px', flex: 1 }}
            />
            <button
              onClick={() => handleSalvarNome(selectedPlano.id)}
              disabled={savingNome}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: '2px' }}
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => setEditingNomeId(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{selectedPlano.nomeProtocolo}</span>
            <button
              onClick={() => { setEditingNomeId(selectedPlano.id); setEditingNomeValue(selectedPlano.nomeProtocolo); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}
              title="Editar nome"
            >
              <Pencil size={13} />
            </button>
          </>
        )}
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
          color: STATUS_COLOR[selectedPlano.status], backgroundColor: STATUS_BG[selectedPlano.status],
          flexShrink: 0,
        }}>
          {STATUS_LABEL[selectedPlano.status]}
        </span>
      </div>

      {/* Info card */}
      <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: 'var(--border-radius-md)', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {selectedPlano.objetivo && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-main)' }}><strong>Objetivo:</strong> {selectedPlano.objetivo}</p>
        )}
        {selectedPlano.frequenciaRecomendada && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-main)' }}><strong>Frequência:</strong> {selectedPlano.frequenciaRecomendada}</p>
        )}
        {selectedPlano.observacoesIniciais && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}><strong>Obs. iniciais:</strong> {selectedPlano.observacoesIniciais}</p>
        )}
        {selectedPlano.motivoEncerramento && (
          <p style={{ fontSize: '12px', color: '#ef4444' }}><strong>Motivo encerramento:</strong> {selectedPlano.motivoEncerramento}</p>
        )}
      </div>

      {/* Procedimentos do plano */}
      {(() => {
        const nomesProcedimentos = (selectedPlano.procedimentos || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (nomesProcedimentos.length === 0) return null;
        return (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
              Procedimentos do Plano
            </p>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
              {nomesProcedimentos.map((nomeProc, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '10px', padding: '10px 14px',
                    borderBottom: idx < nomesProcedimentos.length - 1 ? '1px solid var(--color-border)' : 'none',
                    backgroundColor: '#fff',
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--color-text-main)' }}>{nomeProc}</span>
                  {onAgendar && (
                    <button
                      onClick={() => onAgendar(selectedPlano, nomeProc)}
                      className="btn btn-primary"
                      title="Agendar consulta com este procedimento"
                      style={{
                        padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
                        flexShrink: 0,
                      }}
                    >
                      <Calendar size={13} />
                      <span>Agendar</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {selectedPlano.status === 'ativo' && (
          <button
            onClick={() => setShowEncerrar(true)}
            className="btn btn-outline"
            style={{ fontSize: '12px', color: '#ef4444', borderColor: '#fca5a5' }}
          >
            Encerrar Plano
          </button>
        )}
      </div>

      {/* ── Modal: Encerrar Plano ───────────────────────────────── */}
      {showEncerrar && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }} onClick={() => setShowEncerrar(false)}>
          <div className="modal-inner" style={{
            backgroundColor: '#fff', borderRadius: 'var(--border-radius-lg)',
            padding: '28px', width: '100%', maxWidth: '420px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Encerrar Plano</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              O plano será encerrado antes do número previsto de sessões. Informe o motivo.
            </p>
            <form onSubmit={handleEncerrar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <textarea
                className="form-input"
                rows={3}
                value={motivoEncerramento}
                onChange={(e) => setMotivoEncerramento(e.target.value)}
                placeholder="Ex: Paciente atingiu o resultado desejado após 4 sessões"
                required
                style={{ resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowEncerrar(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEncerrar || !motivoEncerramento.trim()}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--border-radius-md)', fontSize: '13px',
                    fontWeight: 600, backgroundColor: '#ef4444', color: '#fff', border: 'none',
                    cursor: savingEncerrar || !motivoEncerramento.trim() ? 'not-allowed' : 'pointer',
                    opacity: savingEncerrar || !motivoEncerramento.trim() ? 0.6 : 1,
                  }}
                >
                  {savingEncerrar ? 'Encerrando...' : 'Confirmar Encerramento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
