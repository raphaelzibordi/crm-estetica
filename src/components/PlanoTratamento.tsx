import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  BarChart2,
  X,
  Camera,
  ArrowLeftRight,
  Calendar,
  Pencil,
  Check,
} from 'lucide-react';
import type { PlanoTratamento as PlanoTratamentoType, SessaoTratamento } from '../types';
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

function NivelBar({ valor, max = 5 }: { valor: number; max?: number }) {
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            backgroundColor: i < valor ? '#6366f1' : '#e5e7eb',
            flexShrink: 0,
          }}
        />
      ))}
      <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '4px' }}>{valor}/{max}</span>
    </div>
  );
}

function MiniGrafico({ sessoes }: { sessoes: SessaoTratamento[] }) {
  const realizadas = sessoes.filter((s) => s.realizada && s.nivelResposta !== null);
  if (realizadas.length < 2) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '32px' }}>
      {realizadas.map((s) => (
        <div
          key={s.id}
          title={`Sessão ${s.numeroSessao}: nível ${s.nivelResposta}/5`}
          style={{
            width: '12px',
            height: `${((s.nivelResposta ?? 0) / 5) * 100}%`,
            minHeight: '4px',
            backgroundColor: '#6366f1',
            borderRadius: '2px 2px 0 0',
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}

export const PlanoTratamento: React.FC<Props> = ({ clienteId, userId, userName: _userName, onAgendar }) => {
  const [planos, setPlanos] = useState<PlanoTratamentoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlano, setSelectedPlano] = useState<PlanoTratamentoType | null>(null);
  const [sessoes, setSessoes] = useState<SessaoTratamento[]>([]);
  const [loadingSessoes, setLoadingSessoes] = useState(false);
  const [expandedSessao, setExpandedSessao] = useState<number | null>(null);

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

  // Registrar sessão
  const [showRegistrarSessao, setShowRegistrarSessao] = useState(false);
  const [sessaoNumero, setSessaoNumero] = useState(1);
  const [sessaoObs, setSessaoObs] = useState('');
  const [sessaoMateriais, setSessaoMateriais] = useState('');
  const [sessaoNivel, setSessaoNivel] = useState<number>(3);
  const [sessaoFotoAntes, setSessaoFotoAntes] = useState<string | null>(null);
  const [sessaoFotoDepois, setSessaoFotoDepois] = useState<string | null>(null);
  const [savingSessao, setSavingSessao] = useState(false);
  const fotoAntesRef = useRef<HTMLInputElement>(null);
  const fotoDepoisRef = useRef<HTMLInputElement>(null);

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

  // Comparativo
  const [showComparativo, setShowComparativo] = useState(false);

  useEffect(() => {
    loadPlanos();
  }, [clienteId, userId]);

  useEffect(() => {
    if (selectedPlano) loadSessoes(selectedPlano.id);
  }, [selectedPlano]);

  async function loadPlanos() {
    setLoading(true);
    try {
      const data = await api.getPlanosTratamento(userId, clienteId);
      setPlanos(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadSessoes(planoId: string) {
    setLoadingSessoes(true);
    try {
      const data = await api.getSessoesTratamento(userId, planoId);
      setSessoes(data);
    } finally {
      setLoadingSessoes(false);
    }
  }

  function openRegistrarSessao(numero: number) {
    setSessaoNumero(numero);
    setSessaoObs('');
    setSessaoMateriais('');
    setSessaoNivel(3);
    setSessaoFotoAntes(null);
    setSessaoFotoDepois(null);
    setShowRegistrarSessao(true);
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

  async function handleSalvarSessao(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlano) return;
    setSavingSessao(true);
    try {
      const sessao = await api.registrarSessaoTratamento(userId, selectedPlano.id, {
        numeroSessao: sessaoNumero,
        observacoesClinicas: sessaoObs.trim(),
        materiaisUsados: sessaoMateriais.trim(),
        fotoAntes: sessaoFotoAntes,
        fotoDepois: sessaoFotoDepois,
        nivelResposta: sessaoNivel,
      });
      setSessoes((prev) => {
        const filtered = prev.filter((s) => s.numeroSessao !== sessao.numeroSessao);
        return [...filtered, sessao].sort((a, b) => a.numeroSessao - b.numeroSessao);
      });
      // reload plano to catch auto-concluido
      const updated = await api.getPlanosTratamento(userId, clienteId);
      setPlanos(updated);
      const refreshed = updated.find((p) => p.id === selectedPlano.id);
      if (refreshed) setSelectedPlano(refreshed);
      setShowRegistrarSessao(false);
    } finally {
      setSavingSessao(false);
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

  function handleFotoFile(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string | null) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  }

  const sessoesRealizadas = sessoes.filter((s) => s.realizada).length;
  const proximaSessaoNum = sessoesRealizadas + 1;
  const pct = selectedPlano ? Math.round((sessoesRealizadas / selectedPlano.totalSessoes) * 100) : 0;

  const primeiraRealizada = sessoes.find((s) => s.realizada);
  const ultimaRealizada = [...sessoes].filter((s) => s.realizada).pop();
  const podeComparar = sessoesRealizadas >= 2;

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
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.objetivo}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '2px', backgroundColor: STATUS_COLOR[p.status], width: `0%` }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {p.totalSessoes} sessões previstas
                        </span>
                      </div>
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
          onClick={() => { setSelectedPlano(null); setSessoes([]); setEditingNomeId(null); }}
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

      {/* Progress */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            Sessão {sessoesRealizadas} de {selectedPlano.totalSessoes}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{pct}% concluído</span>
        </div>
        <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '3px',
            backgroundColor: selectedPlano.status === 'concluido' ? '#16a34a' : 'var(--color-primary)',
            width: `${pct}%`, transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {selectedPlano.status === 'ativo' && sessoesRealizadas < selectedPlano.totalSessoes && (
          <button
            onClick={() => openRegistrarSessao(proximaSessaoNum)}
            className="btn btn-primary"
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} />
            Registrar Sessão {proximaSessaoNum}
          </button>
        )}
        {podeComparar && (
          <button
            onClick={() => setShowComparativo(true)}
            className="btn btn-outline"
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeftRight size={14} />
            Comparativo
          </button>
        )}
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

      {/* Session Timeline */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BarChart2 size={16} style={{ color: 'var(--color-primary)' }} />
          <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Linha do Tempo</h4>
          {sessoesRealizadas >= 2 && (
            <div style={{ marginLeft: 'auto' }}>
              <MiniGrafico sessoes={sessoes} />
            </div>
          )}
        </div>

        {loadingSessoes ? (
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Carregando sessões...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: selectedPlano.totalSessoes }).map((_, idx) => {
              const num = idx + 1;
              const sessao = sessoes.find((s) => s.numeroSessao === num);
              const isRealizada = sessao?.realizada ?? false;
              const isProxima = selectedPlano.status === 'ativo' && num === proximaSessaoNum;
              const isExpanded = expandedSessao === num;

              return (
                <div key={num} style={{
                  border: `1px solid ${isRealizada ? '#bbf7d0' : isProxima ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--border-radius-md)',
                  backgroundColor: isRealizada ? '#f0fdf4' : isProxima ? 'var(--color-primary-light, #f5f3ff)' : '#fff',
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setExpandedSessao(isExpanded ? null : num)}
                    disabled={!isRealizada}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '12px 14px', background: 'none', border: 'none',
                      cursor: isRealizada ? 'pointer' : 'default', textAlign: 'left',
                    }}
                  >
                    {isRealizada ? (
                      <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                    ) : (
                      <Circle size={18} style={{ color: isProxima ? 'var(--color-primary)' : '#d1d5db', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                        Sessão {num}
                      </span>
                      {isRealizada && sessao?.dataRealizada && (
                        <span style={{ fontSize: '11px', color: '#16a34a', marginLeft: '8px' }}>
                          {sessao.dataRealizada.split('-').reverse().join('/')}
                        </span>
                      )}
                      {!isRealizada && isProxima && (
                        <span style={{ fontSize: '11px', color: 'var(--color-primary)', marginLeft: '8px' }}>
                          Próxima sessão
                        </span>
                      )}
                      {!isRealizada && !isProxima && (
                        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>Pendente</span>
                      )}
                    </div>
                    {isRealizada && sessao?.nivelResposta && (
                      <NivelBar valor={sessao.nivelResposta} />
                    )}
                    {isProxima && selectedPlano.status === 'ativo' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openRegistrarSessao(num); }}
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: '11px' }}
                      >
                        Registrar
                      </button>
                    )}
                    {isRealizada && (
                      isExpanded ? <ChevronUp size={14} style={{ color: '#9ca3af' }} /> : <ChevronDown size={14} style={{ color: '#9ca3af' }} />
                    )}
                  </button>

                  {/* Expanded session detail */}
                  {isExpanded && sessao && (
                    <div style={{ padding: '0 14px 14px 42px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sessao.observacoesClinicas && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Evolução clínica</span>
                          <p style={{ fontSize: '13px', marginTop: '4px' }}>{sessao.observacoesClinicas}</p>
                        </div>
                      )}
                      {sessao.materiaisUsados && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Materiais / Produtos</span>
                          <p style={{ fontSize: '13px', marginTop: '4px' }}>{sessao.materiaisUsados}</p>
                        </div>
                      )}
                      {(sessao.fotoAntes || sessao.fotoDepois) && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Fotos</span>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            {sessao.fotoAntes && (
                              <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '4px', left: '4px', fontSize: '9px', fontWeight: 700, background: '#374151', color: '#fff', padding: '1px 6px', borderRadius: '3px', zIndex: 1 }}>ANTES</div>
                                <img src={sessao.fotoAntes} alt="Antes" style={{ width: '100px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} />
                              </div>
                            )}
                            {sessao.fotoDepois && (
                              <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '4px', left: '4px', fontSize: '9px', fontWeight: 700, background: '#16a34a', color: '#fff', padding: '1px 6px', borderRadius: '3px', zIndex: 1 }}>DEPOIS</div>
                                <img src={sessao.fotoDepois} alt="Depois" style={{ width: '100px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Registrar Sessão ─────────────────────────────── */}
      {showRegistrarSessao && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }} onClick={() => setShowRegistrarSessao(false)}>
          <div className="modal-inner" style={{
            backgroundColor: '#fff', borderRadius: 'var(--border-radius-lg)',
            padding: '28px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                Registrar Sessão {sessaoNumero} — {selectedPlano.nomeProtocolo}
              </h3>
              <button onClick={() => setShowRegistrarSessao(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSalvarSessao} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Observações Clínicas *</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={sessaoObs}
                  onChange={(e) => setSessaoObs(e.target.value)}
                  placeholder="Evolução clínica, resposta ao tratamento, intercorrências..."
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="form-label">Materiais / Produtos Usados</label>
                <input
                  className="form-input"
                  value={sessaoMateriais}
                  onChange={(e) => setSessaoMateriais(e.target.value)}
                  placeholder="Ex: Sérum vitamina C, laser 1064nm"
                />
              </div>
              <div>
                <label className="form-label">Nível de Resposta ({sessaoNivel}/5)</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSessaoNivel(n)}
                      style={{
                        width: '36px', height: '36px', borderRadius: '8px', border: '1px solid',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        borderColor: sessaoNivel >= n ? '#6366f1' : '#e5e7eb',
                        backgroundColor: sessaoNivel >= n ? '#6366f1' : '#f9fafb',
                        color: sessaoNivel >= n ? '#fff' : '#6b7280',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  1 = sem resposta · 5 = excelente resposta
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Foto Antes</label>
                  <button
                    type="button"
                    onClick={() => fotoAntesRef.current?.click()}
                    className="btn btn-outline"
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}
                  >
                    <Camera size={13} />
                    {sessaoFotoAntes ? 'Trocar' : 'Selecionar'}
                  </button>
                  <input type="file" ref={fotoAntesRef} accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => handleFotoFile(e, setSessaoFotoAntes)} />
                  {sessaoFotoAntes && <img src={sessaoFotoAntes} alt="Antes" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginTop: '6px' }} />}
                </div>
                <div>
                  <label className="form-label">Foto Depois</label>
                  <button
                    type="button"
                    onClick={() => fotoDepoisRef.current?.click()}
                    className="btn btn-outline"
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}
                  >
                    <Camera size={13} />
                    {sessaoFotoDepois ? 'Trocar' : 'Selecionar'}
                  </button>
                  <input type="file" ref={fotoDepoisRef} accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => handleFotoFile(e, setSessaoFotoDepois)} />
                  {sessaoFotoDepois && <img src={sessaoFotoDepois} alt="Depois" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginTop: '6px' }} />}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                <button type="button" onClick={() => setShowRegistrarSessao(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSessao}>
                  {savingSessao ? 'Salvando...' : 'Salvar Sessão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* ── Modal: Comparativo (CA-04) ─────────────────────────── */}
      {showComparativo && primeiraRealizada && ultimaRealizada && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }} onClick={() => setShowComparativo(false)}>
          <div className="modal-inner" style={{
            backgroundColor: '#fff', borderRadius: 'var(--border-radius-lg)',
            padding: '28px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Comparativo de Evolução</h3>
              <button onClick={() => setShowComparativo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {[
                { label: `Sessão ${primeiraRealizada.numeroSessao} (Inicial)`, sessao: primeiraRealizada, cor: '#f1f5f9' },
                { label: `Sessão ${ultimaRealizada.numeroSessao} (Atual)`, sessao: ultimaRealizada, cor: '#f0fdf4' },
              ].map(({ label, sessao, cor }) => (
                <div key={sessao.id} style={{ padding: '16px', backgroundColor: cor, borderRadius: '8px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase' }}>
                    {label}
                  </p>
                  {sessao.dataRealizada && (
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
                      {sessao.dataRealizada.split('-').reverse().join('/')}
                    </p>
                  )}
                  {sessao.nivelResposta && (
                    <div style={{ marginBottom: '10px' }}>
                      <NivelBar valor={sessao.nivelResposta} />
                    </div>
                  )}
                  {sessao.fotoAntes && (
                    <img src={sessao.fotoAntes} alt="Foto" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  {sessao.observacoesClinicas && (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-main)', lineHeight: 1.5 }}>{sessao.observacoesClinicas}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Gráfico de evolução de resposta */}
            {sessoes.filter((s) => s.realizada && s.nivelResposta !== null).length >= 2 && (
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase' }}>Evolução da Resposta ao Tratamento</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '60px', padding: '0 4px' }}>
                  {sessoes.filter((s) => s.realizada && s.nivelResposta !== null).map((s) => (
                    <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                      <div
                        title={`Sessão ${s.numeroSessao}: nível ${s.nivelResposta}/5`}
                        style={{
                          width: '100%', borderRadius: '3px 3px 0 0',
                          backgroundColor: '#6366f1',
                          height: `${((s.nivelResposta ?? 0) / 5) * 100}%`,
                          minHeight: '4px',
                          transition: 'height 0.3s',
                        }}
                      />
                      <span style={{ fontSize: '9px', color: '#9ca3af' }}>S{s.numeroSessao}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginTop: '4px', padding: '0 4px' }}>
                  <span>Nível 1</span>
                  <span>Nível 5</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
