import React, { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Trash2,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import type { LGPDSolicitacao, LGPDStats, LGPDSolicitacaoStatus } from '../types';

interface LGPDProps {
  userId: string;
}

const TIPO_LABELS: Record<string, string> = {
  acesso:                  'Acesso aos dados',
  exclusao:                'Exclusão de dados',
  portabilidade:           'Portabilidade (exportação)',
  revogacao_consentimento: 'Revogação de consentimento',
};

const STATUS_LABELS: Record<string, string> = {
  pendente:          'Pendente',
  em_processamento:  'Em processamento',
  concluida:         'Concluída',
  rejeitada:         'Rejeitada',
};

const STATUS_COLORS: Record<string, string> = {
  pendente:          'var(--color-warning)',
  em_processamento:  'var(--color-primary)',
  concluida:         'var(--color-success)',
  rejeitada:         'var(--color-danger)',
};

function prazoLabel(prazoISO?: string): string {
  if (!prazoISO) return '—';
  const diff = new Date(prazoISO).getTime() - Date.now();
  if (diff < 0) return 'Vencido';
  const horas = Math.floor(diff / 3600000);
  if (horas < 24) return `${horas}h restantes`;
  return `${Math.floor(horas / 24)}d restantes`;
}

export const LGPD: React.FC<LGPDProps> = ({ userId }) => {
  const [stats, setStats] = useState<LGPDStats | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<LGPDSolicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<LGPDSolicitacaoStatus | 'todas'>('pendente');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [resposta, setResposta] = useState('');
  const [confirmExclusao, setConfirmExclusao] = useState<{ id: string; clienteId: string; nome: string } | null>(null);
  const [senhaConfirm, setSenhaConfirm] = useState('');
  const [exportando, setExportando] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sol] = await Promise.all([
        api.getLGPDStats(userId),
        api.getLGPDSolicitacoes(userId, filtroStatus === 'todas' ? undefined : filtroStatus),
      ]);
      setStats(s);
      setSolicitacoes(sol);
    } catch (err) {
      console.error('[LGPD] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, filtroStatus]);

  useEffect(() => { load(); }, [load]);

  const handleProcessar = async (sol: LGPDSolicitacao, novoStatus: LGPDSolicitacaoStatus) => {
    if (novoStatus === 'concluida' && sol.tipo === 'exclusao') {
      setConfirmExclusao({ id: sol.id, clienteId: sol.clienteId, nome: sol.clienteNome ?? sol.clienteId });
      return;
    }
    setProcessando(sol.id);
    try {
      await api.processarSolicitacaoLGPD(sol.id, { status: novoStatus, resposta: resposta || undefined }, userId);
      setResposta('');
      setExpandedId(null);
      await load();
    } catch (err) {
      alert('Erro ao processar solicitação.');
    } finally {
      setProcessando(null);
    }
  };

  const handleExportar = async (sol: LGPDSolicitacao) => {
    setExportando(sol.id);
    try {
      const dados = await api.exportarDadosPaciente(sol.clienteId, userId);
      await api.processarSolicitacaoLGPD(sol.id, {
        status: 'concluida',
        resposta: 'Dados exportados e enviados ao paciente.',
      }, userId);
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados_paciente_${sol.clienteId}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await load();
    } catch {
      alert('Erro ao exportar dados.');
    } finally {
      setExportando(null);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!confirmExclusao || !senhaConfirm.trim()) return;
    setProcessando(confirmExclusao.id);
    try {
      await api.anonimizarDadosPaciente(confirmExclusao.clienteId, userId);
      await api.processarSolicitacaoLGPD(confirmExclusao.id, {
        status: 'concluida',
        resposta: 'Dados pessoais não-clínicos anonimizados conforme solicitação LGPD.',
      }, userId);
      setConfirmExclusao(null);
      setSenhaConfirm('');
      setExpandedId(null);
      await load();
    } catch {
      alert('Erro ao anonimizar dados.');
    } finally {
      setProcessando(null);
    }
  };

  const pct = stats
    ? stats.totalPacientes > 0
      ? Math.round((stats.comConsentimentoServico / stats.totalPacientes) * 100)
      : 0
    : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Shield size={24} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--color-text-main)' }}>
            Conformidade LGPD
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
            Gestão de consentimentos e solicitações de titulares de dados
          </p>
        </div>
        <button
          onClick={load}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          title="Atualizar"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Painel de estatísticas */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <StatCard
            icon={<Users size={18} />}
            label="Total de pacientes"
            value={stats.totalPacientes}
            color="var(--color-text-main)"
          />
          <StatCard
            icon={<CheckCircle size={18} />}
            label={`Com consentimento (${pct}%)`}
            value={stats.comConsentimentoServico}
            color="var(--color-success)"
          />
          <StatCard
            icon={<AlertTriangle size={18} />}
            label="Sem consentimento"
            value={stats.semConsentimento}
            color={stats.semConsentimento > 0 ? 'var(--color-warning)' : 'var(--color-success)'}
          />
          <StatCard
            icon={<FileText size={18} />}
            label="Aceito marketing"
            value={stats.comConsentimentoMarketing}
            color="var(--color-primary)"
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Solicitações pendentes"
            value={stats.solicitacoesPendentes + stats.solicitacoesEmProcessamento}
            color={stats.solicitacoesPendentes > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
          />
        </div>
      )}

      {/* Barra de progresso de consentimentos */}
      {stats && stats.totalPacientes > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)',
          padding: '16px 20px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-main)' }}>
            <span>Cobertura de consentimento de serviço</span>
            <span>{pct}%</span>
          </div>
          <div style={{ background: 'var(--color-border)', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`,
              height: '100%',
              background: pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
              borderRadius: '100px',
              transition: 'width 0.4s ease',
            }} />
          </div>
          {stats.semConsentimento > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--color-warning)', margin: '8px 0 0' }}>
              {stats.semConsentimento} paciente(s) sem consentimento registrado. Colete ao abrir o prontuário.
            </p>
          )}
        </div>
      )}

      {/* Solicitações LGPD */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--border-radius-md)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--color-text-main)' }}>
            Solicitações de titulares
          </h2>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as any)}
            style={{
              fontSize: '13px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              padding: '6px 10px',
              background: 'var(--bg-card)',
              color: 'var(--color-text-main)',
              cursor: 'pointer',
            }}
          >
            <option value="pendente">Pendentes</option>
            <option value="em_processamento">Em processamento</option>
            <option value="concluida">Concluídas</option>
            <option value="rejeitada">Rejeitadas</option>
            <option value="todas">Todas</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Carregando...
          </div>
        ) : solicitacoes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            <CheckCircle size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.4 }} />
            Nenhuma solicitação encontrada.
          </div>
        ) : (
          <div>
            {solicitacoes.map(sol => (
              <SolicitacaoRow
                key={sol.id}
                sol={sol}
                expanded={expandedId === sol.id}
                onToggle={() => setExpandedId(expandedId === sol.id ? null : sol.id)}
                onProcessar={handleProcessar}
                onExportar={handleExportar}
                processando={processando === sol.id}
                exportando={exportando === sol.id}
                resposta={expandedId === sol.id ? resposta : ''}
                onRespostaChange={setResposta}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      {confirmExclusao && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--border-radius-md)',
            padding: '28px',
            width: '420px',
            maxWidth: '90vw',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Trash2 size={20} style={{ color: 'var(--color-danger)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-danger)' }}>
                Confirmar exclusão de dados
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
              Os dados pessoais não-clínicos de <strong>{confirmExclusao.nome}</strong> serão anonimizados
              de forma <strong>irreversível</strong>. Dados de prontuário são mantidos por lei (CFM — 20 anos).
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-warning)', marginBottom: '16px', fontWeight: 500 }}>
              Esta ação não pode ser desfeita. Digite "CONFIRMAR" para prosseguir.
            </p>
            <input
              type="text"
              value={senhaConfirm}
              onChange={e => setSenhaConfirm(e.target.value)}
              placeholder='Digite "CONFIRMAR"'
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: '13px',
                background: 'var(--color-bg)',
                color: 'var(--color-text-main)',
                marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setConfirmExclusao(null); setSenhaConfirm(''); }}
                style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: 500,
                  background: 'none', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
                  color: 'var(--color-text-main)',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarExclusao}
                disabled={senhaConfirm !== 'CONFIRMAR' || !!processando}
                style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                  background: senhaConfirm === 'CONFIRMAR' ? 'var(--color-danger)' : 'var(--color-border)',
                  color: senhaConfirm === 'CONFIRMAR' ? '#fff' : 'var(--color-text-muted)',
                  border: 'none', borderRadius: 'var(--border-radius-sm)',
                  cursor: senhaConfirm === 'CONFIRMAR' ? 'pointer' : 'not-allowed',
                }}
              >
                {processando ? 'Processando...' : 'Anonimizar dados'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Subcomponentes ────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color }}>
      {icon}
      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{label}</span>
    </div>
    <span style={{ fontSize: '28px', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
  </div>
);

interface SolicitacaoRowProps {
  sol: LGPDSolicitacao;
  expanded: boolean;
  onToggle: () => void;
  onProcessar: (sol: LGPDSolicitacao, status: LGPDSolicitacaoStatus) => void;
  onExportar: (sol: LGPDSolicitacao) => void;
  processando: boolean;
  exportando: boolean;
  resposta: string;
  onRespostaChange: (v: string) => void;
}

const SolicitacaoRow: React.FC<SolicitacaoRowProps> = ({
  sol, expanded, onToggle, onProcessar, onExportar, processando, exportando, resposta, onRespostaChange,
}) => {
  const isPendente = sol.status === 'pendente' || sol.status === 'em_processamento';
  const isVencido = sol.prazoLegal && new Date(sol.prazoLegal) < new Date();

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
          padding: '14px 20px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '100px', background: `${STATUS_COLORS[sol.status]}20`,
          color: STATUS_COLORS[sol.status], whiteSpace: 'nowrap',
        }}>
          {STATUS_LABELS[sol.status]}
        </span>
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
          {sol.clienteNome || sol.clienteId}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {TIPO_LABELS[sol.tipo]}
        </span>
        {sol.prazoLegal && (
          <span style={{
            fontSize: '11px', fontWeight: 500,
            color: isVencido ? 'var(--color-danger)' : 'var(--color-text-muted)',
            whiteSpace: 'nowrap',
          }}>
            {prazoLabel(sol.prazoLegal)}
          </span>
        )}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <span>Solicitado em: <strong>{new Date(sol.createdAt).toLocaleDateString('pt-BR')}</strong></span>
            <span>Tipo: <strong>{TIPO_LABELS[sol.tipo]}</strong></span>
            {sol.motivo && <span style={{ gridColumn: '1/-1' }}>Motivo: <em>{sol.motivo}</em></span>}
            {sol.resposta && <span style={{ gridColumn: '1/-1' }}>Resposta registrada: <em>{sol.resposta}</em></span>}
          </div>

          {isPendente && (
            <div style={{ marginTop: '12px' }}>
              <textarea
                value={resposta}
                onChange={e => onRespostaChange(e.target.value)}
                placeholder="Observação ou resposta ao paciente (opcional)..."
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  padding: '8px 12px', fontSize: '13px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-main)',
                  marginBottom: '10px',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {sol.tipo === 'portabilidade' ? (
                  <button
                    onClick={() => onExportar(sol)}
                    disabled={exportando}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', fontSize: '12px', fontWeight: 600,
                      background: 'var(--color-primary)', color: '#fff',
                      border: 'none', borderRadius: 'var(--border-radius-sm)',
                      cursor: exportando ? 'wait' : 'pointer',
                    }}
                  >
                    <Download size={13} />
                    {exportando ? 'Exportando...' : 'Exportar e concluir'}
                  </button>
                ) : sol.tipo === 'exclusao' ? (
                  <button
                    onClick={() => onProcessar(sol, 'concluida')}
                    disabled={processando}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', fontSize: '12px', fontWeight: 600,
                      background: 'var(--color-danger)', color: '#fff',
                      border: 'none', borderRadius: 'var(--border-radius-sm)',
                      cursor: processando ? 'wait' : 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    {processando ? 'Processando...' : 'Anonimizar dados'}
                  </button>
                ) : (
                  <button
                    onClick={() => onProcessar(sol, 'concluida')}
                    disabled={processando}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', fontSize: '12px', fontWeight: 600,
                      background: 'var(--color-success)', color: '#fff',
                      border: 'none', borderRadius: 'var(--border-radius-sm)',
                      cursor: processando ? 'wait' : 'pointer',
                    }}
                  >
                    <CheckCircle size={13} />
                    {processando ? 'Processando...' : 'Concluir solicitação'}
                  </button>
                )}
                <button
                  onClick={() => onProcessar(sol, 'em_processamento')}
                  disabled={processando || sol.status === 'em_processamento'}
                  style={{
                    padding: '8px 14px', fontSize: '12px', fontWeight: 500,
                    background: 'none', color: 'var(--color-primary)',
                    border: '1px solid var(--color-primary)',
                    borderRadius: 'var(--border-radius-sm)',
                    cursor: 'pointer',
                    opacity: sol.status === 'em_processamento' ? 0.5 : 1,
                  }}
                >
                  Em processamento
                </button>
                <button
                  onClick={() => onProcessar(sol, 'rejeitada')}
                  disabled={processando}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', fontSize: '12px', fontWeight: 500,
                    background: 'none', color: 'var(--color-danger)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: 'var(--border-radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <XCircle size={13} />
                  Rejeitar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
