import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { HistoricoPresenca, RiscoFalta } from '../types';

interface HistoricoPresencaProps {
  clienteId: string;
  userId: string;
}

export const HistoricoPresenca: React.FC<HistoricoPresencaProps> = ({ clienteId, userId }) => {
  const [historico, setHistorico] = useState<HistoricoPresenca[]>([]);
  const [risco, setRisco] = useState<RiscoFalta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [clienteId, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hist, r] = await Promise.all([
        api.getAttendanceHistory(clienteId, userId),
        api.getNoShowRisk(clienteId, userId),
      ]);
      setHistorico(hist);
      setRisco(r);
    } catch (e) {
      console.error('Erro ao carregar histórico de presença', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
      </div>
    );
  }

  const statusIcon = (status?: string) => {
    if (status === 'compareceu') return <CheckCircle2 size={18} style={{ color: '#10b981' }} />;
    if (status === 'faltou') return <XCircle size={18} style={{ color: '#ef4444' }} />;
    if (status === 'desmarcou') return <AlertCircle size={18} style={{ color: '#f59e0b' }} />;
    return null;
  };

  const statusLabel = (status?: string) => {
    if (status === 'compareceu') return 'Compareceu';
    if (status === 'faltou') return 'Faltou';
    if (status === 'desmarcou') return 'Desmarcou';
    return '—';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Risk Alert */}
      {risco && risco.temRisco && (
        <div style={{
          padding: '16px 14px',
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#d97706', fontSize: '14px' }}>Risco de Falta</div>
            <div style={{ fontSize: '13px', color: '#92400e', marginTop: '4px' }}>
              {risco.faltasUltimos60dias} falta{risco.faltasUltimos60dias !== 1 ? 's' : ''} nos últimos 60 dias
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {risco && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{
            padding: '12px 14px',
            background: 'var(--color-primary-light)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>
              {risco.totalComparecimentos}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Comparecimentos
            </div>
          </div>
          <div style={{
            padding: '12px 14px',
            background: '#fee2e2',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
              {risco.faltasUltimos60dias}
            </div>
            <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '4px' }}>
              Faltas (60 dias)
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {historico.length === 0 ? (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '13px',
        }}>
          Nenhum histórico de presença registrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {historico.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '14px',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {statusIcon(item.presencaStatus)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                    {item.procedimento}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {new Date(item.data).toLocaleDateString('pt-BR')} às {item.horaInicio}
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  {item.profissional}
                </div>
                <div style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: item.presencaStatus === 'compareceu' ? '#d1fae5' :
                              item.presencaStatus === 'faltou' ? '#fee2e2' : '#fef3c7',
                  color: item.presencaStatus === 'compareceu' ? '#065f46' :
                         item.presencaStatus === 'faltou' ? '#7f1d1d' : '#92400e',
                }}>
                  {statusLabel(item.presencaStatus)}
                </div>
                {item.faltaMotivo && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                    Motivo: {item.faltaMotivo}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
