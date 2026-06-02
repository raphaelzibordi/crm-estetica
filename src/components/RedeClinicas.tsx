import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
  ChevronRight,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Settings,
  BarChart3,
  RefreshCw,
  Network,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Rede, Unidade, PainelRede } from '../types';

interface RedeClinicasProps {
  userId: string;
  onRedeUpdated?: () => void;
}

type PeriodoPreset = '7d' | '30d' | '90d';
type TabAtiva = 'painel' | 'unidades' | 'configuracoes';

const PERIODO_LABELS: Record<PeriodoPreset, string> = {
  '7d':  'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
};

function getPeriodoDates(preset: PeriodoPreset): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const dias = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - dias);
  return {
    dataInicio: inicio.toISOString().split('T')[0],
    dataFim:    hoje.toISOString().split('T')[0],
  };
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Modal de criar/editar unidade ─────────────────────────────────
interface ClinicaPerfil {
  nomeClinica: string;
  telefone: string;
  endereco: string;
}

interface UnidadeModalProps {
  redeId: string;
  unidade?: Unidade;
  defaultValues?: ClinicaPerfil;
  onSave: () => void;
  onClose: () => void;
}

const UnidadeModal: React.FC<UnidadeModalProps> = ({ redeId, unidade, defaultValues, onSave, onClose }) => {
  const [nome, setNome]         = useState(unidade?.nome     ?? defaultValues?.nomeClinica ?? '');
  const [cnpj, setCnpj]         = useState(unidade?.cnpj     ?? '');
  const [endereco, setEndereco] = useState(unidade?.endereco ?? defaultValues?.endereco    ?? '');
  const [telefone, setTelefone] = useState(unidade?.telefone ?? defaultValues?.telefone    ?? '');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const handleSave = async () => {
    if (!nome.trim()) { setError('Nome da unidade é obrigatório.'); return; }
    setSaving(true);
    setError('');
    try {
      if (unidade) {
        await api.updateUnidade(unidade.id, { nome, cnpj, endereco, telefone });
      } else {
        await api.createUnidade({ redeId, nome, cnpj, endereco, telefone });
      }
      onSave();
    } catch (e: any) {
      setError(e.message ?? 'Erro ao salvar unidade.');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--color-text-main)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-inner"
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '28px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700 }}>
          {unidade ? 'Editar Unidade' : 'Nova Unidade'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Nome da Unidade *</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Unidade Centro"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>CNPJ</label>
            <input
              value={cnpj}
              onChange={e => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Endereço</label>
            <input
              value={endereco}
              onChange={e => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Telefone</label>
            <input
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              style={fieldStyle}
            />
          </div>
        </div>

        {error && (
          <p style={{ color: 'var(--color-warning)', fontSize: '13px', margin: '12px 0 0' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', background: 'transparent',
              border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)',
              color: 'var(--color-text-main)', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px', background: 'var(--color-primary)',
              border: 'none', borderRadius: 'var(--border-radius-sm)',
              color: '#fff', fontSize: '14px', fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modal de criar rede ───────────────────────────────────────────
interface RedeModalProps {
  clinicaAtual?: ClinicaPerfil;
  onSave: (rede: Rede) => void;
  onClose: () => void;
}

const RedeModal: React.FC<RedeModalProps> = ({ clinicaAtual, onSave, onClose }) => {
  const [nome, setNome]               = useState('');
  const [descricao, setDescricao]     = useState('');
  const [incluirClinica, setIncluirClinica] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const handleSave = async () => {
    if (!nome.trim()) { setError('Nome da rede é obrigatório.'); return; }
    setSaving(true);
    try {
      const rede = await api.createRede({
        nome,
        descricao,
        pacienteCompartilhado: false,
        descontoVolumePct: 0,
      });
      // Auto-cria a clínica atual como primeira unidade se solicitado
      if (incluirClinica && clinicaAtual?.nomeClinica) {
        await api.createUnidade({
          redeId:   rede.id,
          nome:     clinicaAtual.nomeClinica,
          cnpj:     '',
          endereco: clinicaAtual.endereco,
          telefone: clinicaAtual.telefone,
        });
      }
      onSave(rede);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao criar rede.');
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--color-text-main)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-inner"
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--border-radius-lg)',
          padding: '28px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'var(--color-primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Network size={20} color="var(--color-primary)" />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Criar Rede de Clínicas</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nome da Rede *
            </label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Clínicas Bella Vita"
              style={fieldStyle}
              autoFocus
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descrição opcional da rede"
              rows={2}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          </div>

          {/* Clínica atual como primeira unidade */}
          {clinicaAtual?.nomeClinica && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Primeira unidade
              </label>
              <button
                type="button"
                onClick={() => setIncluirClinica(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px',
                  background: incluirClinica ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  border: `1px solid ${incluirClinica ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                  background: incluirClinica ? 'var(--color-primary)' : 'transparent',
                  border: `2px solid ${incluirClinica ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {incluirClinica && <span style={{ color: '#fff', fontSize: '12px', lineHeight: 1 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                    {clinicaAtual.nomeClinica}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Adicionar como primeira unidade da rede
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {error && (
          <p style={{ color: 'var(--color-warning)', fontSize: '13px', margin: '10px 0 0' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', background: 'transparent',
              border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)',
              color: 'var(--color-text-main)', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px', background: 'var(--color-primary)',
              border: 'none', borderRadius: 'var(--border-radius-sm)',
              color: '#fff', fontSize: '14px', fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Criando...' : 'Criar Rede'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────
export const RedeClinicas: React.FC<RedeClinicasProps> = ({ userId, onRedeUpdated }) => {
  const [redes, setRedes]             = useState<Rede[]>([]);
  const [redeAtiva, setRedeAtiva]     = useState<Rede | null>(null);
  const [unidades, setUnidades]       = useState<Unidade[]>([]);
  const [painel, setPainel]           = useState<PainelRede | null>(null);
  const [tabAtiva, setTabAtiva]       = useState<TabAtiva>('painel');
  const [periodo, setPeriodo]         = useState<PeriodoPreset>('30d');
  const [loading, setLoading]         = useState(true);
  const [loadingPainel, setLoadingPainel] = useState(false);
  const [showRedeModal, setShowRedeModal] = useState(false);
  const [editUnidade, setEditUnidade] = useState<Unidade | undefined>(undefined);
  const [showUnidadeModal, setShowUnidadeModal] = useState(false);
  const [perfilClinica, setPerfilClinica] = useState<ClinicaPerfil | null>(null);

  // Config state
  const [pacienteCompartilhado, setPacienteCompartilhado] = useState(false);
  const [descontoVolume, setDescontoVolume] = useState(0);
  const [savingConfig, setSavingConfig] = useState(false);

  const loadRedes = useCallback(async () => {
    try {
      const [redesData, perfil] = await Promise.all([
        api.getRedes(userId),
        api.getPerfil(userId),
      ]);
      setRedes(redesData);
      if (redesData.length > 0 && !redeAtiva) {
        setRedeAtiva(redesData[0]);
      }
      if (perfil) {
        setPerfilClinica({
          nomeClinica: perfil.nome_clinica ?? '',
          telefone:    perfil.telefone     ?? '',
          endereco:    perfil.endereco     ?? '',
        });
      }
    } catch (e) {
      console.error('[Rede] Erro ao carregar redes:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, redeAtiva]);

  const loadUnidades = useCallback(async (redeId: string) => {
    try {
      const data = await api.getUnidades(redeId, userId);
      setUnidades(data);
    } catch (e) {
      console.error('[Rede] Erro ao carregar unidades:', e);
    }
  }, [userId]);

  const loadPainel = useCallback(async (redeId: string) => {
    setLoadingPainel(true);
    try {
      const { dataInicio, dataFim } = getPeriodoDates(periodo);
      const data = await api.getPainelRede(redeId, dataInicio, dataFim);
      setPainel(data);
    } catch (e) {
      console.error('[Rede] Erro ao carregar painel:', e);
    } finally {
      setLoadingPainel(false);
    }
  }, [periodo]);

  useEffect(() => { loadRedes(); }, [loadRedes]);

  useEffect(() => {
    if (!redeAtiva) return;
    setPacienteCompartilhado(redeAtiva.pacienteCompartilhado);
    setDescontoVolume(redeAtiva.descontoVolumePct);
    loadUnidades(redeAtiva.id);
    loadPainel(redeAtiva.id);
  }, [redeAtiva, loadUnidades, loadPainel]);

  useEffect(() => {
    if (redeAtiva) loadPainel(redeAtiva.id);
  }, [periodo]);

  const handleSaveRede = (rede: Rede) => {
    setRedes(prev => [...prev, rede]);
    setRedeAtiva(rede);
    setShowRedeModal(false);
    onRedeUpdated?.();
  };

  const handleSaveUnidade = () => {
    setShowUnidadeModal(false);
    setEditUnidade(undefined);
    if (redeAtiva) loadUnidades(redeAtiva.id);
    onRedeUpdated?.();
  };

  const handleToggleUnidade = async (u: Unidade) => {
    try {
      await api.updateUnidade(u.id, { ativo: !u.ativo }, userId);
      setUnidades(prev => prev.map(x => x.id === u.id ? { ...x, ativo: !u.ativo } : x));
    } catch (e) {
      console.error('[Rede] Erro ao alterar status da unidade:', e);
    }
  };

  const handleSaveConfig = async () => {
    if (!redeAtiva) return;
    setSavingConfig(true);
    try {
      await api.updateRede(redeAtiva.id, {
        pacienteCompartilhado,
        descontoVolumePct: descontoVolume,
      }, userId);
      setRedeAtiva(prev => prev ? { ...prev, pacienteCompartilhado, descontoVolumePct: descontoVolume } : null);
    } catch (e) {
      console.error('[Rede] Erro ao salvar config:', e);
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Empty state: sem rede ─────────────────────────────────────
  if (!loading && redes.length === 0) {
    return (
      <div style={{ padding: '32px', maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'var(--color-primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Network size={22} color="var(--color-primary)" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Rede de Clínicas</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Agrupe suas unidades e acompanhe tudo em um painel consolidado
            </p>
          </div>
        </div>

        {/* Clínica atual cadastrada */}
        {perfilClinica?.nomeClinica && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-md)',
            padding: '16px 18px',
            marginBottom: '16px',
          }}>
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sua clínica cadastrada
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'var(--color-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Building2 size={18} color="var(--color-primary)" />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{perfilClinica.nomeClinica}</div>
                {perfilClinica.telefone && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{perfilClinica.telefone}</div>
                )}
                {perfilClinica.endereco && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{perfilClinica.endereco}</div>
                )}
              </div>
            </div>
          </div>
        )}

        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px' }}>
          Crie uma rede para agrupar suas unidades. Sua clínica atual será adicionada automaticamente como primeira unidade.
        </p>

        <button
          onClick={() => setShowRedeModal(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '12px 24px', background: 'var(--color-primary)',
            border: 'none', borderRadius: 'var(--border-radius-md)',
            color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Criar Rede de Clínicas
        </button>

        {showRedeModal && (
          <RedeModal
            clinicaAtual={perfilClinica ?? undefined}
            onSave={handleSaveRede}
            onClose={() => setShowRedeModal(false)}
          />
        )}
      </div>
    );
  }

  const maxFaturamento = painel ? Math.max(...painel.metricas.map(m => m.faturamento), 1) : 1;

  // ── Layout principal ──────────────────────────────────────────
  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'var(--color-primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Network size={22} color="var(--color-primary)" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
              {redeAtiva?.nome ?? 'Rede de Clínicas'}
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {unidades.filter(u => u.ativo).length} unidade(s) ativa(s)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {redes.length > 1 && (
            <select
              value={redeAtiva?.id ?? ''}
              onChange={e => {
                const r = redes.find(x => x.id === e.target.value);
                if (r) setRedeAtiva(r);
              }}
              style={{
                padding: '8px 12px', background: 'var(--bg-card)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)',
                color: 'var(--color-text-main)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              {redes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowRedeModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', background: 'transparent',
              border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)',
              color: 'var(--color-text-main)', fontSize: '13px', cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Nova Rede
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)', marginBottom: '24px' }}>
        {(['painel', 'unidades', 'configuracoes'] as TabAtiva[]).map(t => (
          <button
            key={t}
            onClick={() => setTabAtiva(t)}
            style={{
              padding: '10px 18px', background: 'none', border: 'none',
              borderBottom: tabAtiva === t ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tabAtiva === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: tabAtiva === t ? 600 : 400, fontSize: '14px', cursor: 'pointer',
              marginBottom: '-1px', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {t === 'painel'         && <><BarChart3 size={15} />Painel Consolidado</>}
            {t === 'unidades'       && <><Building2 size={15} />Unidades</>}
            {t === 'configuracoes'  && <><Settings size={15} />Configurações</>}
          </button>
        ))}
      </div>

      {/* ── TAB: PAINEL ───────────────────────────────────────── */}
      {tabAtiva === 'painel' && (
        <div>
          {/* Seletor de período */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(Object.keys(PERIODO_LABELS) as PeriodoPreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  style={{
                    padding: '7px 14px', fontSize: '13px', fontWeight: 500,
                    borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
                    background: periodo === p ? 'var(--color-primary)' : 'var(--bg-card)',
                    color: periodo === p ? '#fff' : 'var(--color-text-muted)',
                    border: periodo === p ? 'none' : '1px solid var(--color-border)',
                    transition: 'all 0.15s',
                  }}
                >
                  {PERIODO_LABELS[p]}
                </button>
              ))}
            </div>
            <button
              onClick={() => redeAtiva && loadPainel(redeAtiva.id)}
              disabled={loadingPainel}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', background: 'transparent',
                border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)',
                color: 'var(--color-text-muted)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} style={{ animation: loadingPainel ? 'spin 1s linear infinite' : 'none' }} />
              Atualizar
            </button>
          </div>

          {loadingPainel ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
              Carregando métricas...
            </div>
          ) : painel ? (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {[
                  { label: 'Faturamento Total', value: fmt(painel.totalFaturamento), icon: DollarSign, color: '#22c55e' },
                  { label: 'Total de Atendimentos', value: painel.totalAgendamentos.toString(), icon: Calendar, color: 'var(--color-primary)' },
                  { label: 'Ticket Médio Geral', value: fmt(painel.ticketMedioGeral), icon: TrendingUp, color: '#f59e0b' },
                  { label: 'Unidades Ativas', value: unidades.filter(u => u.ativo).length.toString(), icon: Building2, color: '#8b5cf6' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: `${color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={18} color={color} />
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-main)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Ranking por unidade */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-md)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={16} color="var(--color-primary)" />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Comparativo por Unidade</h3>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {PERIODO_LABELS[periodo]}
                  </span>
                </div>

                {painel.metricas.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Nenhuma métrica disponível para o período selecionado.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ minWidth: '540px' }}>
                    {/* Header da tabela */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 120px',
                      gap: '12px',
                      padding: '10px 20px',
                      background: 'var(--color-bg)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      <span>Unidade</span>
                      <span style={{ textAlign: 'right' }}>Faturamento</span>
                      <span style={{ textAlign: 'right' }}>Atendimentos</span>
                      <span style={{ textAlign: 'right' }}>Ticket Médio</span>
                      <span>Ocupação</span>
                    </div>

                    {painel.metricas.map((m, idx) => {
                      const pct = Math.round((m.faturamento / maxFaturamento) * 100);
                      return (
                        <div
                          key={m.unidadeId}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 1fr 120px',
                            gap: '12px',
                            padding: '14px 20px',
                            borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              background: 'var(--color-primary-light)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)',
                              flexShrink: 0,
                            }}>
                              {idx + 1}
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{m.unidadeNome}</span>
                          </div>
                          <span style={{ textAlign: 'right', fontSize: '14px', fontWeight: 600, color: '#22c55e' }}>
                            {fmt(m.faturamento)}
                          </span>
                          <span style={{ textAlign: 'right', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                            {m.agendamentosFinalizados}/{m.totalAgendamentos}
                          </span>
                          <span style={{ textAlign: 'right', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                            {fmt(m.ticketMedio)}
                          </span>
                          <div>
                            <div style={{
                              height: '6px', borderRadius: '100px',
                              background: 'var(--color-border)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%', width: `${pct}%`,
                                background: 'var(--color-primary)',
                                borderRadius: '100px',
                                transition: 'width 0.6s ease-out',
                              }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', display: 'block', textAlign: 'right' }}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
              Selecione ou crie uma rede para ver o painel consolidado.
            </div>
          )}
        </div>
      )}

      {/* ── TAB: UNIDADES ─────────────────────────────────────── */}
      {tabAtiva === 'unidades' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              onClick={() => { setEditUnidade(undefined); setShowUnidadeModal(true); }}
              disabled={!redeAtiva}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', background: 'var(--color-primary)',
                border: 'none', borderRadius: 'var(--border-radius-sm)',
                color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={15} />
              Nova Unidade
            </button>
          </div>

          {unidades.length === 0 ? (
            <div
              style={{
                background: 'var(--bg-card)', border: '2px dashed var(--color-border)',
                borderRadius: 'var(--border-radius-md)', padding: '48px',
                textAlign: 'center', color: 'var(--color-text-muted)',
              }}
            >
              <Building2 size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '15px' }}>Nenhuma unidade cadastrada ainda.</p>
              <p style={{ margin: '6px 0 0', fontSize: '13px' }}>Crie sua primeira unidade para começar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {unidades.map(u => (
                <div
                  key={u.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '18px 20px',
                    display: 'flex', alignItems: 'center', gap: '16px',
                    opacity: u.ativo ? 1 : 0.5,
                  }}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px',
                    background: u.ativo ? 'var(--color-primary-light)' : 'var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Building2 size={20} color={u.ativo ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>{u.nome}</span>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '100px',
                        background: u.ativo ? '#22c55e20' : 'var(--color-border)',
                        color: u.ativo ? '#22c55e' : 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}>
                        {u.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {u.cnpj     && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>CNPJ: {u.cnpj}</span>}
                      {u.telefone && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{u.telefone}</span>}
                      {u.endereco && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{u.endereco}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => { setEditUnidade(u); setShowUnidadeModal(true); }}
                      title="Editar"
                      style={{
                        padding: '8px', background: 'transparent',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)',
                        color: 'var(--color-text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleUnidade(u)}
                      title={u.ativo ? 'Desativar' : 'Ativar'}
                      style={{
                        padding: '8px', background: 'transparent',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)',
                        color: u.ativo ? '#22c55e' : 'var(--color-text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {u.ativo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CONFIGURAÇÕES ────────────────────────────────── */}
      {tabAtiva === 'configuracoes' && redeAtiva && (
        <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Paciente compartilhado */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="var(--color-primary)" />
                  Paciente Compartilhado
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  Quando ativado, o cadastro de pacientes é único na rede — a ficha e o
                  histórico de atendimentos se consolidam entre todas as unidades.
                </p>
              </div>
              <button
                onClick={() => setPacienteCompartilhado(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: pacienteCompartilhado ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  flexShrink: 0,
                }}
              >
                {pacienteCompartilhado
                  ? <ToggleRight size={32} />
                  : <ToggleLeft size={32} />}
              </button>
            </div>
          </div>

          {/* Desconto de volume */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)',
              padding: '20px',
            }}
          >
            <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={16} color="var(--color-primary)" />
              Desconto de Volume por Unidade
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Percentual de desconto aplicado na assinatura para redes com múltiplas unidades.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={descontoVolume}
                onChange={e => setDescontoVolume(Number(e.target.value))}
                style={{
                  width: '100px', padding: '8px 12px',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  color: 'var(--color-text-main)', fontSize: '14px', outline: 'none',
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>%</span>
            </div>
          </div>

          {/* Permissões do gestor */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)',
              padding: '20px',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChevronRight size={16} color="var(--color-primary)" />
              Permissões do Gestor de Rede
            </h4>
            <ul style={{ margin: 0, padding: '0 0 0 20px', color: 'var(--color-text-muted)', fontSize: '13px', lineHeight: '1.8' }}>
              <li>Leitura de todas as unidades (sem acesso operacional direto)</li>
              <li>Acesso ao painel consolidado de métricas</li>
              <li>Configuração de paciente compartilhado</li>
              <li>Gerenciamento de unidades e membros da rede</li>
              <li>Operação em unidade específica requer permissão explícita</li>
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              style={{
                padding: '11px 24px', background: 'var(--color-primary)',
                border: 'none', borderRadius: 'var(--border-radius-sm)',
                color: '#fff', fontSize: '14px', fontWeight: 600,
                cursor: savingConfig ? 'wait' : 'pointer', opacity: savingConfig ? 0.7 : 1,
              }}
            >
              {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showRedeModal && (
        <RedeModal
          clinicaAtual={perfilClinica ?? undefined}
          onSave={handleSaveRede}
          onClose={() => setShowRedeModal(false)}
        />
      )}
      {showUnidadeModal && redeAtiva && (
        <UnidadeModal
          redeId={redeAtiva.id}
          unidade={editUnidade}
          defaultValues={editUnidade ? undefined : (perfilClinica ?? undefined)}
          onSave={handleSaveUnidade}
          onClose={() => { setShowUnidadeModal(false); setEditUnidade(undefined); }}
        />
      )}
    </div>
  );
};
