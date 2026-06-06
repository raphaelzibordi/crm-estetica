import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type PlanoBilling = 'basico' | 'pro' | 'enterprise';
export type PeriodicidadeBilling = 'mensal' | 'anual';

interface PlanoModalProps {
  motivo: 'trial_expirado' | 'renovacao_anual';
  clinicName: string;
  diasRestantes?: number | null;
  onClose: () => void;
}

const PLANOS: { id: PlanoBilling; nome: string; mensal: string; anual: string }[] = [
  { id: 'basico',     nome: 'Básico',     mensal: 'R$ 39,90/mês',  anual: 'R$ 358,80/ano (12x R$ 29,90)' },
  { id: 'pro',        nome: 'Pro',        mensal: 'R$ 89,90/mês',  anual: 'R$ 838,80/ano (12x R$ 69,90)' },
  { id: 'enterprise', nome: 'Enterprise', mensal: 'R$ 119,90/mês', anual: 'R$ 1.188,00/ano (12x R$ 99,90)' },
];

export const PlanoModal: React.FC<PlanoModalProps> = ({ motivo, clinicName, diasRestantes, onClose }) => {
  const [plano, setPlano] = useState<PlanoBilling>('basico');
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadeBilling>('mensal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titulo = motivo === 'trial_expirado'
    ? 'Seu período de teste terminou'
    : 'Sua assinatura anual está vencendo';

  const subtitulo = motivo === 'trial_expirado'
    ? `A clínica ${clinicName || ''} precisa de um plano ativo para continuar usando o Lumina CRM.`
    : `Faltam ${diasRestantes ?? 0} dia(s) para o vencimento da sua assinatura anual. Escolha como deseja continuar.`;

  const handleConfirmar = async () => {
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
      setError(err instanceof Error ? err.message : 'Erro ao iniciar pagamento. Tente novamente.');
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
        zIndex: 2100,
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
            background: 'var(--color-primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
            color: 'var(--color-primary)',
          }}
        >
          <CreditCard size={20} />
        </div>

        <h2 style={{ fontSize: '19px', color: 'var(--color-text-main)', fontWeight: 600, marginBottom: '8px' }}>
          {titulo}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '22px' }}>
          {subtitulo}
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', display: 'block', marginBottom: '8px' }}>
            Escolha o plano
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PLANOS.map(p => (
              <label
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: plano === p.id ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border, #e2e8e0)',
                  background: plano === p.id ? 'var(--color-primary-light)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="radio" name="plano" checked={plano === p.id} onChange={() => setPlano(p.id)} />
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-text-main)' }}>{p.nome}</strong>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {periodicidade === 'mensal' ? p.mensal : p.anual}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', display: 'block', marginBottom: '8px' }}>
            Periodicidade
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['mensal', 'anual'] as const).map(per => (
              <button
                key={per}
                type="button"
                onClick={() => setPeriodicidade(per)}
                className={periodicidade === per ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {per === 'mensal' ? 'Mensal' : 'Anual (à vista)'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: '12.5px', color: 'var(--color-danger, #c0392b)', marginBottom: '16px' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirmar}
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }}
        >
          {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Continuar para pagamento'}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Lembrar mais tarde
        </button>
      </div>
    </div>
  );
};
