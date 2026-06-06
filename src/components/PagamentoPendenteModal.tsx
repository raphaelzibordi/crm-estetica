import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PagamentoPendenteModalProps {
  status: 'past_due' | 'suspended';
  clinicName: string;
  diasAtraso: number | null;
  tentativas: number;
  suspensoEm: Date | null;
  plano: 'basico' | 'pro' | 'enterprise';
  periodicidade: 'mensal' | 'anual';
  onClose?: () => void;
}

export const PagamentoPendenteModal: React.FC<PagamentoPendenteModalProps> = ({
  status,
  clinicName,
  diasAtraso,
  tentativas,
  suspensoEm,
  plano,
  periodicidade,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuspended = status === 'suspended';

  const titulo = isSuspended
    ? 'Sua assinatura Lumina foi suspensa'
    : 'Identificamos um problema com seu pagamento';

  const subtitulo = isSuspended
    ? `O acesso da clínica ${clinicName || ''} foi suspenso${suspensoEm ? ` em ${suspensoEm.toLocaleDateString('pt-BR')}` : ''} após 3 tentativas de cobrança sem sucesso. Regularize o pagamento para restaurar o acesso — a liberação é automática em poucos minutos após a confirmação.`
    : `Não conseguimos confirmar o pagamento da assinatura da clínica ${clinicName || ''}${diasAtraso != null ? ` há ${diasAtraso} dia(s)` : ''}. Tentaremos cobrar novamente automaticamente (tentativa ${Math.min(tentativas + 1, 3)}/3), mas você pode regularizar agora para evitar a suspensão do acesso.`;

  const accentColor = isSuspended ? 'var(--color-danger, #c0392b)' : 'var(--color-warning)';
  const accentBg = isSuspended ? 'var(--color-danger-light, #fbeae8)' : 'var(--color-warning-light)';

  const handleRegularizar = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('clinic-billing', {
        body: { action: 'start-checkout', plano, periodicidade },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Não foi possível gerar o link de pagamento. Tente novamente.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar link de pagamento. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 2200,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '92%',
          padding: '36px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.18)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
            color: accentColor,
          }}
        >
          <AlertTriangle size={20} />
        </div>

        <h2 style={{ fontSize: '19px', color: 'var(--color-text-main)', fontWeight: 600, marginBottom: '8px' }}>
          {titulo}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '22px' }}>
          {subtitulo}
        </p>

        {error && (
          <p style={{ fontSize: '12.5px', color: 'var(--color-danger, #c0392b)', marginBottom: '16px' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleRegularizar}
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', marginBottom: onClose ? '10px' : 0 }}
        >
          {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Regularizar pagamento'}
        </button>

        {onClose && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Lembrar mais tarde
          </button>
        )}
      </div>
    </div>
  );
};
