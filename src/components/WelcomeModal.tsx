import React from 'react';
import { Sparkles } from 'lucide-react';

interface WelcomeModalProps {
  userName: string;
  clinicName: string;
  onClose: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ userName, clinicName, onClose }) => {
  const greeting = getGreeting();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        zIndex: 2000,
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '420px',
          width: '90%',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.14)',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--color-primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'var(--color-primary)',
          }}
        >
          <Sparkles size={22} />
        </div>

        <h2
          style={{
            fontSize: '20px',
            color: 'var(--color-text-main)',
            fontWeight: 600,
            marginBottom: '12px',
          }}
        >
          {greeting},{' '}
          <strong>{userName || 'Colaborador'}</strong>!
        </h2>

        <p
          style={{
            fontSize: '15px',
            color: 'var(--color-text-muted)',
            lineHeight: 1.65,
            marginBottom: '28px',
          }}
        >
          Você está se conectando à clínica{' '}
          <strong style={{ color: 'var(--color-text-main)' }}>
            {clinicName || 'Lumina'}
          </strong>
          .
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onClose}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          OK, vamos lá!
        </button>
      </div>
    </div>
  );
};
