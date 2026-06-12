import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, X, BarChart2, Settings2, Clock, AlertTriangle,
  ChevronRight, Zap, MessageSquare, Mail, CheckSquare,
  MoreHorizontal, User, Phone, Globe, Trash2, Edit3,
  ArrowRightCircle, History, FileText, Tag, Users,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  FunilEtapa, FunilEtapaTipo, Lead, LeadAutomacao, LeadHistorico, LeadOrigem,
} from '../types';
import { RankingPacientes } from './RankingPacientes';

// ── Utilitários ───────────────────────────────────────────────────────

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const ORIGENS: { value: LeadOrigem; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'google',    label: 'Google' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'outro',     label: 'Outro' },
];

const ORIGEM_LABELS: Record<LeadOrigem, string> = {
  instagram: 'Instagram', google: 'Google', indicacao: 'Indicação',
  whatsapp: 'WhatsApp', tiktok: 'TikTok', outro: 'Outro',
};

const TIPO_COR: Record<FunilEtapaTipo, string> = {
  ativo:      'var(--color-primary)',
  convertido: '#10B981',
  perdido:    '#EF4444',
};

// ── Props ─────────────────────────────────────────────────────────────

interface CRMProps {
  userId: string;
  userName: string;
  onConvertidoAgendar?: (clienteId: string, clienteNome: string) => void;
  permissoes?: import('../types').Permissoes | null;
}

// ── Estado inicial do formulário de lead ─────────────────────────────

const LEAD_VAZIO = {
  nome: '', telefone: '', email: '',
  procedimentoInteresse: '', origem: 'outro' as LeadOrigem, observacoes: '',
};

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

export const CRM: React.FC<CRMProps> = ({ userId, userName, onConvertidoAgendar, permissoes }) => {
  const pode = (acao: 'ver' | 'criar' | 'editar' | 'deletar') =>
    !permissoes || !!(permissoes['crm']?.[acao]);
  const [activeView, setActiveView] = useState<'pipeline' | 'ranking'>('pipeline');

  const [etapas, setEtapas]     = useState<FunilEtapa[]>([]);
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);

  // DnD
  const [dragLeadId, setDragLeadId]       = useState<string | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<string | null>(null);

  // Touch DnD
  const touchLeadGhostRef   = useRef<HTMLDivElement>(null);
  const touchActiveLeadRef  = useRef<{ id: string } | null>(null);
  const [touchLeadGhostPos, setTouchLeadGhostPos]     = useState<{ x: number; y: number } | null>(null);
  const [touchLeadGhostLabel, setTouchLeadGhostLabel] = useState('');

  // Modais
  const [leadModal, setLeadModal]         = useState<{ open: boolean; lead?: Lead; etapaId?: string }>({ open: false });
  const [detalheModal, setDetalheModal]   = useState<Lead | null>(null);
  const [historico, setHistorico]         = useState<LeadHistorico[]>([]);
  const [metricasOpen, setMetricasOpen]   = useState(false);
  const [etapasOpen, setEtapasOpen]       = useState(false);
  const [automacoesModal, setAutomacoesModal] = useState<FunilEtapa | null>(null);
  const [convertDialog, setConvertDialog] = useState<Lead | null>(null);

  // Notas
  const [novaNota, setNovaNota] = useState('');
  const [savingNota, setSavingNota] = useState(false);

  // Conversão
  const [convertendo, setConvertendo] = useState(false);

  // ── Carga de dados ─────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, l] = await Promise.all([
        api.initFunilPadrao(userId),
        api.getLeads(userId),
      ]);
      setEtapas(e);
      setLeads(l);
    } catch (err) {
      console.error('[CRM] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── DnD handlers ───────────────────────────────────────────────────

  const handleDragStart = (leadId: string) => setDragLeadId(leadId);
  const handleDragEnd   = () => { setDragLeadId(null); setDragOverEtapa(null); };

  const handleDragOver = (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    setDragOverEtapa(etapaId);
  };

  const handleDrop = async (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    if (!dragLeadId || dragLeadId === etapaId) { handleDragEnd(); return; }
    const lead = leads.find((l) => l.id === dragLeadId);
    if (!lead || lead.etapaId === etapaId) { handleDragEnd(); return; }

    const etapaDestino = etapas.find((et) => et.id === etapaId);
    if (etapaDestino?.tipo === 'convertido') {
      setConvertDialog(lead);
      handleDragEnd();
      return;
    }

    // Atualização otimista
    setLeads((prev) => prev.map((l) =>
      l.id === dragLeadId ? { ...l, etapaId, etapaEntradaEm: new Date().toISOString() } : l
    ));
    handleDragEnd();

    try {
      await api.moverLead(dragLeadId, etapaId, userName, userId);
      await api.dispararAutomacoesEtapa(dragLeadId, etapaId, userName, userId);
    } catch (err) {
      console.error('[CRM] Erro ao mover lead:', err);
      load();
    }
  };

  // ── Touch DnD handlers ─────────────────────────────────────────────
  const handleTouchStartLead = (
    e: React.TouchEvent<HTMLDivElement>,
    leadId: string,
    nome: string
  ) => {
    const touch = e.touches[0];
    touchActiveLeadRef.current = { id: leadId };
    setTouchLeadGhostLabel(nome);
    setTouchLeadGhostPos({ x: touch.clientX, y: touch.clientY });
    setDragLeadId(leadId);
  };

  const handleTouchMoveLead = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchActiveLeadRef.current) return;
    const touch = e.touches[0];
    setTouchLeadGhostPos({ x: touch.clientX, y: touch.clientY });
    const ghostEl = touchLeadGhostRef.current;
    if (ghostEl) ghostEl.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (ghostEl) ghostEl.style.display = '';
    const col = el?.closest('[data-dnd-col]');
    const colId = col?.getAttribute('data-dnd-col') ?? null;
    setDragOverEtapa(colId);
  };

  const handleTouchEndLead = async () => {
    if (!touchActiveLeadRef.current) return;
    const leadId = touchActiveLeadRef.current.id;
    const etapaId = dragOverEtapa;
    touchActiveLeadRef.current = null;
    setTouchLeadGhostPos(null);
    setDragLeadId(null);
    setDragOverEtapa(null);
    if (!leadId || !etapaId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.etapaId === etapaId) return;
    const etapaDestino = etapas.find((et) => et.id === etapaId);
    if (etapaDestino?.tipo === 'convertido') {
      setConvertDialog(lead);
      return;
    }
    setLeads((prev) => prev.map((l) =>
      l.id === leadId ? { ...l, etapaId, etapaEntradaEm: new Date().toISOString() } : l
    ));
    try {
      await api.moverLead(leadId, etapaId, userName, userId);
      await api.dispararAutomacoesEtapa(leadId, etapaId, userName, userId);
    } catch (err) {
      console.error('[CRM] Erro ao mover lead (touch):', err);
      load();
    }
  };

  // ── Salvar lead (criar ou editar) ──────────────────────────────────

  const [savingLead, setSavingLead] = useState(false);
  const [leadForm, setLeadForm] = useState(LEAD_VAZIO);

  const abrirCriarLead = (etapaId: string) => {
    setLeadForm(LEAD_VAZIO);
    setLeadModal({ open: true, etapaId });
  };

  const abrirEditarLead = (lead: Lead) => {
    setLeadForm({
      nome: lead.nome, telefone: lead.telefone, email: lead.email,
      procedimentoInteresse: lead.procedimentoInteresse,
      origem: lead.origem, observacoes: lead.observacoes,
    });
    setLeadModal({ open: true, lead });
  };

  const salvarLead = async () => {
    if (!leadForm.nome.trim()) return;
    setSavingLead(true);
    try {
      if (leadModal.lead) {
        const atualizado = await api.updateLead(leadModal.lead.id, leadForm, userId);
        setLeads((prev) => prev.map((l) => l.id === atualizado.id ? atualizado : l));
      } else {
        const novo = await api.createLead({
          ...leadForm,
          etapaId: leadModal.etapaId ?? etapas[0]?.id ?? '',
          responsavelId: null, responsavelNome: null,
        }, userId);
        setLeads((prev) => [novo, ...prev]);
      }
      setLeadModal({ open: false });
    } catch (err) {
      console.error('[CRM] Erro ao salvar lead:', err);
      alert('Erro ao salvar lead. Tente novamente.');
    } finally {
      setSavingLead(false);
    }
  };

  // ── Excluir lead ───────────────────────────────────────────────────

  const excluirLead = async (lead: Lead) => {
    if (!confirm(`Excluir o lead "${lead.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.deleteLead(lead.id, userId);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      if (detalheModal?.id === lead.id) setDetalheModal(null);
    } catch (err) {
      console.error('[CRM] Erro ao excluir:', err);
      alert('Erro ao excluir lead.');
    }
  };

  // ── Detalhe + histórico ────────────────────────────────────────────

  const abrirDetalhe = async (lead: Lead) => {
    setDetalheModal(lead);
    setHistorico([]);
    try {
      const h = await api.getLeadHistorico(lead.id, userId);
      setHistorico(h);
    } catch (err) {
      console.error('[CRM] Erro ao carregar histórico:', err);
    }
  };

  const enviarNota = async () => {
    if (!novaNota.trim() || !detalheModal) return;
    setSavingNota(true);
    try {
      const h = await api.addLeadNota(detalheModal.id, novaNota, userName, userId);
      setHistorico((prev) => [h, ...prev]);
      setNovaNota('');
    } catch (err) {
      console.error('[CRM] Erro ao salvar nota:', err);
    } finally {
      setSavingNota(false);
    }
  };

  // ── Conversão para paciente (CA-05) ────────────────────────────────

  const confirmarConversao = async () => {
    if (!convertDialog) return;
    setConvertendo(true);
    try {
      const { lead: leadConvertido, clienteId } = await api.converterLeadEmPaciente(
        convertDialog.id, userName, userId
      );
      setLeads((prev) => prev.map((l) => l.id === leadConvertido.id ? leadConvertido : l));
      setConvertDialog(null);
      if (onConvertidoAgendar) {
        onConvertidoAgendar(clienteId, convertDialog.nome);
      } else {
        alert(`"${convertDialog.nome}" foi convertido em paciente com sucesso!`);
      }
    } catch (err) {
      console.error('[CRM] Erro ao converter lead:', err);
      alert('Erro ao converter lead em paciente.');
    } finally {
      setConvertendo(false);
    }
  };

  // ── Métricas (CA-06) ───────────────────────────────────────────────

  const [metricas, setMetricas] = useState<Awaited<ReturnType<typeof api.getFunilMetricas>> | null>(null);

  const abrirMetricas = async () => {
    const m = await api.getFunilMetricas(etapas, leads);
    setMetricas(m);
    setMetricasOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-muted)' }}>
        Carregando funil de leads...
      </div>
    );
  }

  const leadsPorEtapa = (etapaId: string) => leads.filter((l) => l.etapaId === etapaId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px 16px', flexShrink: 0,
        borderBottom: '1px solid var(--color-border)',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {activeView === 'pipeline' ? 'Pipeline de Leads' : 'Ranking de Pacientes'}
            </h1>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {activeView === 'pipeline'
                ? `${leads.length} lead${leads.length !== 1 ? 's' : ''} no funil`
                : 'Score por LTV, frequência e ticket médio'}
            </span>
          </div>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '4px', background: '#f8f8f6', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '4px' }}>
            <button
              onClick={() => setActiveView('pipeline')}
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '7px', background: activeView === 'pipeline' ? 'var(--color-primary)' : 'transparent', color: activeView === 'pipeline' ? '#fff' : 'var(--color-text-muted)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <BarChart2 size={13} /> Pipeline
            </button>
            <button
              onClick={() => setActiveView('ranking')}
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '7px', background: activeView === 'ranking' ? 'var(--color-primary)' : 'transparent', color: activeView === 'ranking' ? '#fff' : 'var(--color-text-muted)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Users size={13} /> Ranking de Pacientes
            </button>
          </div>
        </div>
        {activeView === 'pipeline' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={abrirMetricas} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <BarChart2 size={15} /> Métricas
            </button>
            <button onClick={() => setEtapasOpen(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <Settings2 size={15} /> Etapas
            </button>
            {pode('criar') && (
              <button onClick={() => abrirCriarLead(etapas[0]?.id ?? '')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <Plus size={15} /> Novo Lead
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Ranking de Pacientes (US-016) ─────────────────────────── */}
      {activeView === 'ranking' && <RankingPacientes userId={userId} />}

      {/* ── Kanban ────────────────────────────────────────────────── */}
      {activeView === 'pipeline' && <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden',
        display: 'flex', gap: '12px', padding: '16px 24px',
      }}>
        {etapas.map((etapa) => {
          const etapaLeads = leadsPorEtapa(etapa.id);
          const isOver = dragOverEtapa === etapa.id;
          return (
            <div
              key={etapa.id}
              data-dnd-col={etapa.id}
              onDragOver={(e) => handleDragOver(e, etapa.id)}
              onDrop={(e) => handleDrop(e, etapa.id)}
              onDragLeave={() => setDragOverEtapa(null)}
              style={{
                width: '280px', minWidth: '280px', display: 'flex', flexDirection: 'column',
                background: isOver ? 'var(--color-primary-light)' : 'var(--color-bg-secondary, #F9FAFB)',
                border: `2px ${isOver ? 'dashed' : 'solid'} ${isOver ? etapa.cor : 'var(--color-border)'}`,
                borderRadius: '12px', transition: 'all 0.15s ease',
              }}
            >
              {/* Header da coluna */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px',
                borderBottom: `3px solid ${etapa.cor}`,
                borderRadius: '10px 10px 0 0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: etapa.cor }} />
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-main)' }}>
                    {etapa.nome}
                  </span>
                  <span style={{
                    background: etapa.cor + '22', color: etapa.cor,
                    fontSize: '11px', fontWeight: 700,
                    padding: '1px 7px', borderRadius: '100px',
                  }}>
                    {etapaLeads.length}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setAutomacoesModal(etapa)}
                    title="Automações"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-text-muted)', borderRadius: '4px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = etapa.cor)}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                  >
                    <Zap size={13} />
                  </button>
                  {etapa.tipo === 'ativo' && (
                    <button
                      onClick={() => abrirCriarLead(etapa.id)}
                      title="Adicionar lead"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-text-muted)', borderRadius: '4px' }}
                      onMouseEnter={e => (e.currentTarget.style.color = etapa.cor)}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {etapaLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    etapa={etapa}
                    isDragging={dragLeadId === lead.id}
                    onDragStart={() => handleDragStart(lead.id)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStartLead(e, lead.id, lead.nome)}
                    onTouchMove={handleTouchMoveLead}
                    onTouchEnd={handleTouchEndLead}
                    onDetalhes={() => abrirDetalhe(lead)}
                    onEditar={() => abrirEditarLead(lead)}
                    onExcluir={() => excluirLead(lead)}
                    onConverter={() => setConvertDialog(lead)}
                  />
                ))}

                {etapaLeads.length === 0 && (
                  <div style={{
                    textAlign: 'center', padding: '20px 8px',
                    color: 'var(--color-text-muted)', fontSize: '12px',
                    border: '1px dashed var(--color-border)', borderRadius: '8px',
                  }}>
                    Nenhum lead nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>}

      {/* ── Modal: Criar/Editar Lead (CA-02) ───────────────────────── */}
      {leadModal.open && (
        <ModalOverlay onClose={() => setLeadModal({ open: false })}>
          <div style={{ width: '460px', maxWidth: '100%' }}>
            <ModalHeader
              title={leadModal.lead ? 'Editar Lead' : 'Novo Lead'}
              onClose={() => setLeadModal({ open: false })}
            />
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input
                  className="form-input"
                  value={leadForm.nome}
                  onChange={(e) => setLeadForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Maria Silva"
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input
                    className="form-input"
                    value={leadForm.telefone}
                    onChange={(e) => setLeadForm((f) => ({ ...f, telefone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail</label>
                  <input
                    className="form-input"
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="contato@email.com"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Procedimento de interesse</label>
                <input
                  className="form-input"
                  value={leadForm.procedimentoInteresse}
                  onChange={(e) => setLeadForm((f) => ({ ...f, procedimentoInteresse: e.target.value }))}
                  placeholder="Ex: Botox, Laser CO2, Harmonização..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Origem</label>
                <select
                  className="form-input"
                  value={leadForm.origem}
                  onChange={(e) => setLeadForm((f) => ({ ...f, origem: e.target.value as LeadOrigem }))}
                >
                  {ORIGENS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {!leadModal.lead && (
                <div className="form-group">
                  <label className="form-label">Etapa inicial</label>
                  <select
                    className="form-input"
                    value={leadModal.etapaId ?? etapas[0]?.id ?? ''}
                    onChange={(e) => setLeadModal((m) => ({ ...m, etapaId: e.target.value }))}
                  >
                    {etapas.filter((et) => et.tipo === 'ativo').map((et) => (
                      <option key={et.id} value={et.id}>{et.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  className="form-input"
                  value={leadForm.observacoes}
                  onChange={(e) => setLeadForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Informações adicionais sobre o contato..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button className="btn-secondary" onClick={() => setLeadModal({ open: false })}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={salvarLead}
                  disabled={savingLead || !leadForm.nome.trim()}
                >
                  {savingLead ? 'Salvando...' : leadModal.lead ? 'Salvar' : 'Criar Lead'}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Detalhe + Histórico (CA-03) ─────────────────────── */}
      {detalheModal && (
        <ModalOverlay onClose={() => setDetalheModal(null)}>
          <div style={{ width: '520px', maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <ModalHeader
              title={detalheModal.nome}
              onClose={() => setDetalheModal(null)}
            />
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Info do lead */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <InfoItem icon={<Phone size={13} />} label="Telefone" value={detalheModal.telefone || '—'} />
                <InfoItem icon={<Mail size={13} />}  label="E-mail"   value={detalheModal.email || '—'} />
                <InfoItem icon={<Tag size={13} />}   label="Procedimento" value={detalheModal.procedimentoInteresse || '—'} />
                <InfoItem icon={<Globe size={13} />} label="Origem"   value={ORIGEM_LABELS[detalheModal.origem]} />
                <InfoItem icon={<Clock size={13} />} label="Entrada"  value={formatData(detalheModal.createdAt)} />
                <InfoItem
                  icon={<AlertTriangle size={13} />}
                  label="Dias na etapa"
                  value={`${diasDesde(detalheModal.etapaEntradaEm)} dia(s)`}
                />
              </div>
              {detalheModal.observacoes && (
                <div style={{ background: 'var(--color-bg-secondary, #F9FAFB)', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Observações</span>
                  <span style={{ fontSize: '13px' }}>{detalheModal.observacoes}</span>
                </div>
              )}

              {/* Adicionar nota */}
              <div>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Adicionar nota</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="form-input"
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    placeholder="Registre uma observação..."
                    onKeyDown={(e) => e.key === 'Enter' && enviarNota()}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn-primary"
                    onClick={enviarNota}
                    disabled={savingNota || !novaNota.trim()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {/* Histórico */}
              <div>
                <h3 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                  Histórico ({historico.length})
                </h3>
                {historico.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Sem movimentações registradas.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {historico.map((h) => (
                      <HistoricoItem key={h.id} item={h} etapas={etapas} />
                    ))}
                  </div>
                )}
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px', borderTop: '1px solid var(--color-border)' }}>
                <button className="btn-secondary" onClick={() => { setDetalheModal(null); abrirEditarLead(detalheModal); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <Edit3 size={13} /> Editar
                </button>
                {!detalheModal.clienteId && (
                  <button
                    onClick={() => { setDetalheModal(null); setConvertDialog(detalheModal); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    <ArrowRightCircle size={13} /> Converter em Paciente
                  </button>
                )}
                <button className="btn-danger" onClick={() => { setDetalheModal(null); excluirLead(detalheModal); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginLeft: 'auto' }}>
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Converter Lead (CA-05) ──────────────────────────── */}
      {convertDialog && (
        <ModalOverlay onClose={() => setConvertDialog(null)}>
          <div style={{ width: '400px', maxWidth: '100%', padding: '28px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>Converter em Paciente</h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Deseja transformar <strong>{convertDialog.nome}</strong> em paciente e criar uma ficha no sistema?
              </p>
            </div>
            <div style={{ background: 'var(--color-primary-light)', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '13px', color: 'var(--color-primary)' }}>
              Os dados do lead (nome, telefone, e-mail) serão usados para criar a ficha do paciente. Você poderá criar o agendamento em seguida.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => setConvertDialog(null)} style={{ flex: 1 }}>Cancelar</button>
              <button
                onClick={confirmarConversao}
                disabled={convertendo}
                style={{ flex: 1, background: '#10B981', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', cursor: convertendo ? 'wait' : 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                {convertendo ? 'Convertendo...' : 'Confirmar Conversão'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Métricas (CA-06) ─────────────────────────────────── */}
      {metricasOpen && metricas && (
        <ModalOverlay onClose={() => setMetricasOpen(false)}>
          <div style={{ width: '560px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <ModalHeader title="Métricas do Funil" onClose={() => setMetricasOpen(false)} />
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Totais */}
              <div className="metricas-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {[
                  { label: 'Total leads', value: metricas.totalLeads },
                  { label: 'Hoje',   value: metricas.leadsHoje },
                  { label: '7 dias', value: metricas.leadsSemana },
                  { label: '30 dias', value: metricas.leadsMes },
                ].map((m) => (
                  <div key={m.label} style={{ background: 'var(--color-primary-light)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>{m.value}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Por etapa */}
              <div>
                <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600 }}>Leads por etapa</h3>
                {etapas.map((et) => {
                  const count = metricas.leadsPorEtapa[et.id] ?? 0;
                  const pct = metricas.totalLeads > 0 ? Math.round((count / metricas.totalLeads) * 100) : 0;
                  return (
                    <div key={et.id} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '13px' }}>
                        <span>{et.nome}</span>
                        <span style={{ fontWeight: 600 }}>{count} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ background: 'var(--color-border)', borderRadius: '4px', height: '6px' }}>
                        <div style={{ background: et.cor, borderRadius: '4px', height: '6px', width: `${pct}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tempo médio por etapa */}
              <div>
                <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600 }}>Tempo médio por etapa</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {etapas.filter((et) => et.tipo === 'ativo').map((et) => (
                    <div key={et.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-secondary, #F9FAFB)', borderRadius: '8px', fontSize: '13px' }}>
                      <span>{et.nome}</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        {metricas.tempoMedioPorEtapa[et.id] ?? 0} dias
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por origem */}
              <div>
                <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600 }}>Leads por origem</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Object.entries(metricas.leadsPorOrigem).sort((a, b) => b[1] - a[1]).map(([origem, count]) => (
                    <div key={origem} style={{
                      background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                      borderRadius: '100px', padding: '4px 12px', fontSize: '13px', fontWeight: 500,
                    }}>
                      {ORIGEM_LABELS[origem as LeadOrigem] ?? origem}: {count}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal: Configurar Etapas ────────────────────────────────── */}
      {etapasOpen && (
        <EtapasConfigModal
          etapas={etapas}
          userId={userId}
          onClose={() => setEtapasOpen(false)}
          onSave={(e) => { setEtapas(e); setEtapasOpen(false); }}
        />
      )}

      {/* ── Modal: Automações por etapa (CA-04) ─────────────────────── */}
      {automacoesModal && (
        <AutomacoesModal
          etapa={automacoesModal}
          userId={userId}
          onClose={() => setAutomacoesModal(null)}
        />
      )}

      {/* Touch drag ghost */}
      {touchLeadGhostPos && (
        <div
          ref={touchLeadGhostRef}
          style={{
            position: 'fixed',
            left: touchLeadGhostPos.x - 80,
            top: touchLeadGhostPos.y - 20,
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
          {touchLeadGhostLabel}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// CARD DO LEAD
// ═══════════════════════════════════════════════════════════════════════

interface LeadCardProps {
  lead: Lead;
  etapa: FunilEtapa;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: () => void;
  onDetalhes: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onConverter: () => void;
}

const LeadCard: React.FC<LeadCardProps> = ({
  lead, etapa, isDragging, onDragStart, onDragEnd, onTouchStart, onTouchMove, onTouchEnd,
  onDetalhes, onEditar, onExcluir, onConverter,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dias = diasDesde(lead.etapaEntradaEm);
  const semMovimento30 = dias >= 30;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      draggable={etapa.tipo !== 'perdido'}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={etapa.tipo !== 'perdido' ? onTouchStart : undefined}
      onTouchMove={etapa.tipo !== 'perdido' ? onTouchMove : undefined}
      onTouchEnd={etapa.tipo !== 'perdido' ? onTouchEnd : undefined}
      onClick={onDetalhes}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        padding: '12px',
        cursor: etapa.tipo !== 'perdido' ? 'grab' : 'pointer',
        touchAction: etapa.tipo !== 'perdido' ? 'none' : undefined,
        opacity: isDragging ? 0.4 : 1,
        transition: 'box-shadow 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Alerta 30 dias */}
      {semMovimento30 && (
        <div style={{
          position: 'absolute', top: '8px', right: '8px',
          background: '#FEF3C7', color: '#D97706',
          borderRadius: '100px', padding: '2px 7px',
          fontSize: '10px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '3px',
        }}>
          <AlertTriangle size={9} /> {dias}d parado
        </div>
      )}

      {/* Nome */}
      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--color-text-main)', marginBottom: '6px', paddingRight: semMovimento30 ? '70px' : '24px' }}>
        {lead.nome}
        {lead.clienteId && (
          <span style={{ marginLeft: '6px', fontSize: '10px', background: '#D1FAE5', color: '#065F46', borderRadius: '100px', padding: '1px 6px' }}>
            Convertido
          </span>
        )}
      </div>

      {/* Procedimento */}
      {lead.procedimentoInteresse && (
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
          {lead.procedimentoInteresse}
        </div>
      )}

      {/* Meta */}
      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Clock size={10} /> {formatData(lead.createdAt)}
        </span>
        {lead.responsavelNome && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <User size={10} /> {lead.responsavelNome}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Globe size={10} /> {ORIGEM_LABELS[lead.origem]}
        </span>
      </div>

      {/* Menu ações */}
      <div
        ref={menuRef}
        style={{ position: 'absolute', bottom: '8px', right: '8px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: 'var(--color-text-muted)', lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', right: 0,
            background: 'var(--bg-card)', border: '1px solid var(--color-border)',
            borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: '4px', zIndex: 100, minWidth: '160px',
            animation: 'fadeIn 0.1s ease-out',
          }}>
            {[
              { icon: <History size={12} />, label: 'Ver histórico', action: onDetalhes },
              { icon: <Edit3 size={12} />, label: 'Editar', action: onEditar },
              ...(etapa.tipo !== 'convertido' && !lead.clienteId
                ? [{ icon: <ArrowRightCircle size={12} />, label: 'Converter', action: onConverter }]
                : []),
              { icon: <Trash2 size={12} />, label: 'Excluir', action: onExcluir, danger: true },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { setMenuOpen(false); item.action(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', background: 'none', border: 'none',
                  padding: '8px 10px', cursor: 'pointer', borderRadius: '6px',
                  fontSize: '12.5px', color: (item as any).danger ? '#EF4444' : 'var(--color-text-main)',
                  textAlign: 'left', fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = (item as any).danger ? '#FEE2E2' : 'var(--color-primary-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ITEM DE HISTÓRICO
// ═══════════════════════════════════════════════════════════════════════

const HistoricoItem: React.FC<{ item: LeadHistorico; etapas: FunilEtapa[] }> = ({ item, etapas }) => {
  const etapaNova  = etapas.find((e) => e.id === item.etapaNovaId);
  const etapaAnt   = etapas.find((e) => e.id === item.etapaAnteriorId);

  const icons: Record<LeadHistorico['tipo'], React.ReactNode> = {
    movimentacao: <ChevronRight size={12} />,
    nota:         <FileText size={12} />,
    tarefa:       <CheckSquare size={12} />,
    automacao:    <Zap size={12} />,
  };

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div style={{
        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
        background: 'var(--color-primary-light)', color: 'var(--color-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icons[item.tipo]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-main)' }}>
          {item.tipo === 'movimentacao' ? (
            <>
              {etapaAnt ? <><strong>{etapaAnt.nome}</strong> → </> : 'Criado em '}
              <strong>{etapaNova?.nome ?? 'Desconhecido'}</strong>
            </>
          ) : (
            item.observacao ?? '—'
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
          {item.usuarioNome} · {new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAR ETAPAS
// ═══════════════════════════════════════════════════════════════════════

const EtapasConfigModal: React.FC<{
  etapas: FunilEtapa[];
  userId: string;
  onClose: () => void;
  onSave: (etapas: FunilEtapa[]) => void;
}> = ({ etapas, userId, onClose, onSave }) => {
  const [lista, setLista] = useState<FunilEtapa[]>(etapas);
  const [novo, setNovo]   = useState('');
  const [saving, setSaving] = useState(false);

  const adicionarEtapa = async () => {
    if (!novo.trim()) return;
    setSaving(true);
    try {
      const etapa = await api.createFunilEtapa({
        nome: novo, ordem: lista.length, cor: '#6B7280', tipo: 'ativo',
      }, userId);
      setLista((prev) => [...prev, etapa]);
      setNovo('');
    } catch {
      alert('Erro ao criar etapa.');
    } finally {
      setSaving(false);
    }
  };

  const renomearEtapa = async (id: string, nome: string) => {
    if (!nome.trim()) return;
    try {
      const atualizada = await api.updateFunilEtapa(id, { nome }, userId);
      setLista((prev) => prev.map((e) => e.id === id ? atualizada : e));
    } catch {
      alert('Erro ao renomear etapa.');
    }
  };

  const excluirEtapa = async (etapa: FunilEtapa) => {
    if (!confirm(`Excluir a etapa "${etapa.nome}"?`)) return;
    try {
      await api.deleteFunilEtapa(etapa.id, userId);
      setLista((prev) => prev.filter((e) => e.id !== etapa.id));
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao excluir etapa.');
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: '440px' }}>
        <ModalHeader title="Configurar Etapas do Funil" onClose={onClose} />
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {lista.map((etapa) => (
            <div key={etapa.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: etapa.cor, flexShrink: 0 }} />
              <input
                className="form-input"
                defaultValue={etapa.nome}
                onBlur={(e) => renomearEtapa(etapa.id, e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{
                fontSize: '11px', background: TIPO_COR[etapa.tipo] + '22',
                color: TIPO_COR[etapa.tipo], borderRadius: '100px', padding: '2px 8px', flexShrink: 0,
              }}>
                {etapa.tipo}
              </span>
              {etapa.tipo === 'ativo' && (
                <button onClick={() => excluirEtapa(etapa)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px' }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <input
              className="form-input"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="Nome da nova etapa"
              onKeyDown={(e) => e.key === 'Enter' && adicionarEtapa()}
              style={{ flex: 1 }}
            />
            <button className="btn-primary" onClick={adicionarEtapa} disabled={saving || !novo.trim()}>
              <Plus size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button className="btn-primary" onClick={() => onSave(lista)}>Fechar</button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// AUTOMAÇÕES POR ETAPA (CA-04)
// ═══════════════════════════════════════════════════════════════════════

const AutomacoesModal: React.FC<{
  etapa: FunilEtapa;
  userId: string;
  onClose: () => void;
}> = ({ etapa, userId, onClose }) => {
  const [automacoes, setAutomacoes] = useState<LeadAutomacao[]>([]);
  const [loading, setLoading]       = useState(true);
  const [criando, setCriando]       = useState(false);
  const [form, setForm] = useState<{
    tipo: LeadAutomacao['tipo'];
    gatilho: LeadAutomacao['gatilho'];
    diasEspera: string;
    mensagem: string;
    tarefaTitulo: string;
  }>({ tipo: 'tarefa', gatilho: 'ao_entrar', diasEspera: '3', mensagem: '', tarefaTitulo: '' });

  useEffect(() => {
    (async () => {
      const a = await api.getLeadAutomacoes(etapa.id, userId);
      setAutomacoes(a);
      setLoading(false);
    })();
  }, [etapa.id, userId]);

  const criar = async () => {
    setCriando(true);
    try {
      const nova = await api.createLeadAutomacao({
        etapaId:     etapa.id,
        tipo:        form.tipo,
        gatilho:     form.gatilho,
        diasEspera:  form.gatilho === 'apos_dias' ? Number(form.diasEspera) : null,
        mensagem:    form.tipo !== 'tarefa' ? form.mensagem : null,
        tarefaTitulo: form.tipo === 'tarefa' ? form.tarefaTitulo : null,
        ativo:       true,
      }, userId);
      setAutomacoes((prev) => [...prev, nova]);
      setForm({ tipo: 'tarefa', gatilho: 'ao_entrar', diasEspera: '3', mensagem: '', tarefaTitulo: '' });
    } catch {
      alert('Erro ao criar automação.');
    } finally {
      setCriando(false);
    }
  };

  const toggleAtivo = async (a: LeadAutomacao) => {
    const atualizada = await api.updateLeadAutomacao(a.id, { ativo: !a.ativo }, userId);
    setAutomacoes((prev) => prev.map((x) => x.id === a.id ? atualizada : x));
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir esta automação?')) return;
    await api.deleteLeadAutomacao(id, userId);
    setAutomacoes((prev) => prev.filter((a) => a.id !== id));
  };

  const tipoIcon: Record<LeadAutomacao['tipo'], React.ReactNode> = {
    whatsapp: <MessageSquare size={12} />,
    email:    <Mail size={12} />,
    tarefa:   <CheckSquare size={12} />,
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <ModalHeader title={`Automações — ${etapa.nome}`} onClose={onClose} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Aviso WhatsApp/Email */}
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400E' }}>
            <strong>Nota:</strong> Automações de WhatsApp e E-mail registram a intenção no histórico do lead.
            O envio real será ativado quando a integração WhatsApp (E3-G4) estiver disponível.
          </div>

          {/* Lista de automações */}
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Carregando...</p>
          ) : automacoes.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Nenhuma automação configurada.</p>
          ) : (
            automacoes.map((a) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                background: 'var(--color-bg-secondary, #F9FAFB)', borderRadius: '8px', padding: '12px',
                opacity: a.ativo ? 1 : 0.5,
              }}>
                <div style={{ color: 'var(--color-primary)', marginTop: '2px' }}>{tipoIcon[a.tipo]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                    {a.tipo === 'tarefa' ? a.tarefaTitulo : a.mensagem}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {a.tipo} · {a.gatilho === 'ao_entrar' ? 'ao entrar na etapa' : `após ${a.diasEspera} dias`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => toggleAtivo(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: a.ativo ? '#10B981' : 'var(--color-text-muted)' }}>
                    {a.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                  <button onClick={() => excluir(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Formulário nova automação */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Nova automação</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as LeadAutomacao['tipo'] }))}>
                  <option value="tarefa">Tarefa (lembrete)</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Gatilho</label>
                <select className="form-input" value={form.gatilho} onChange={(e) => setForm((f) => ({ ...f, gatilho: e.target.value as LeadAutomacao['gatilho'] }))}>
                  <option value="ao_entrar">Ao entrar na etapa</option>
                  <option value="apos_dias">Após N dias parado</option>
                </select>
              </div>
            </div>
            {form.gatilho === 'apos_dias' && (
              <div className="form-group">
                <label className="form-label">Número de dias</label>
                <input className="form-input" type="number" min="1" max="90" value={form.diasEspera}
                  onChange={(e) => setForm((f) => ({ ...f, diasEspera: e.target.value }))} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">{form.tipo === 'tarefa' ? 'Título da tarefa' : 'Mensagem'}</label>
              <textarea
                className="form-input"
                value={form.tipo === 'tarefa' ? form.tarefaTitulo : form.mensagem}
                onChange={(e) => form.tipo === 'tarefa'
                  ? setForm((f) => ({ ...f, tarefaTitulo: e.target.value }))
                  : setForm((f) => ({ ...f, mensagem: e.target.value }))}
                placeholder={form.tipo === 'tarefa' ? 'Ex: Ligar para o lead' : 'Texto da mensagem...'}
                rows={2}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={criar} disabled={criando}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <Plus size={13} /> {criando ? 'Criando...' : 'Adicionar automação'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// UTILITÁRIOS DE UI
// ═══════════════════════════════════════════════════════════════════════

const ModalOverlay: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <div
    className="modal-overlay"
    style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.15s ease-out',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div
      className="modal-inner"
      style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        overflowY: 'auto',
        maxHeight: '95vh',
        maxWidth: '96vw',
      }}
    >
      {children}
    </div>
  </div>
);

const ModalHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px 14px',
    borderBottom: '1px solid var(--color-border)',
  }}>
    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>{title}</h2>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', borderRadius: '6px' }}>
      <X size={18} />
    </button>
  </div>
);

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ background: 'var(--color-bg-secondary, #F9FAFB)', borderRadius: '8px', padding: '10px 12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-main)', wordBreak: 'break-word' }}>{value}</div>
  </div>
);
