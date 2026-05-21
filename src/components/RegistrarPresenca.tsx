import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Agendamento } from '../types';

interface RegistrarPresencaProps {
  agendamento: Agendamento;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegistrarPresenca: React.FC<RegistrarPresencaProps> = ({
  agendamento,
  userId,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<'compareceu' | 'faltou' | 'desmarcou' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!status) {
      alert('Selecione o status de presença.');
      return;
    }

    setSaving(true);
    try {
      await api.registerAttendance(agendamento.id, status, motivo || undefined, userId);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Erro: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const buttons = [
    {
      id: 'compareceu' as const,
      label: 'Compareceu',
      icon: CheckCircle2,
      color: '#10b981',
      bg: '#d1fae5',
      showMotivo: false,
    },
    {
      id: 'faltou' as const,
      label: 'Faltou',
      icon: XCircle,
      color: '#ef4444',
      bg: '#fee2e2',
      showMotivo: true,
    },
    {
      id: 'desmarcou' as const,
      label: 'Desmarcou',
      icon: AlertCircle,
      color: '#f59e0b',
      bg: '#fef3c7',
      showMotivo: true,
    },
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{ maxWidth: '480px', width: '92%', padding: '32px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Registrar Presença</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Appointment Info */}
        <div style={{ padding: '16px', background: 'var(--color-primary-light)', borderRadius: '8px', marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            {agendamento.procedimento}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {new Date(agendamento.data).toLocaleDateString('pt-BR')} às {agendamento.horaInicio}
            {' • '}
            {agendamento.profissional}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '8px' }}>
            {agendamento.clienteNome}
          </div>
        </div>

        {/* Status Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {buttons.map(btn => (
            <button
              key={btn.id}
              onClick={() => setStatus(btn.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                border: `2px solid ${status === btn.id ? btn.color : 'var(--color-border)'}`,
                borderRadius: '8px',
                background: status === btn.id ? btn.bg : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <btn.icon size={20} style={{ color: btn.color, flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: btn.color }}>{btn.label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Motivo Field (show for faltou/desmarcou) */}
        {status && (status === 'faltou' || status === 'desmarcou') && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text-main)',
              marginBottom: '8px',
            }}>
              {status === 'faltou' ? 'Motivo da Falta (opcional)' : 'Motivo da Desmarcação (opcional)'}
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder={status === 'faltou'
                ? 'Ex: Paciente ligou relatando doença'
                : 'Ex: Paciente solicitou remarcação'}
              className="form-input"
              style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text-main)',
            }}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!status || saving}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              background: status ? 'var(--color-primary)' : 'var(--color-text-muted)',
              color: '#fff',
              cursor: status ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {saving ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
};
