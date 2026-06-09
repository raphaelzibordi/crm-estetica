import React from 'react';
import { Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdminSuspendedModalProps {
  clinicName: string;
}

export const AdminSuspendedModal: React.FC<AdminSuspendedModalProps> = ({ clinicName }) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 2300,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '460px',
          width: '92%',
          padding: '36px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--color-danger-light, #fbeae8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
            color: 'var(--color-danger, #c0392b)',
          }}
        >
          <Ban size={20} />
        </div>

        <h2 style={{ fontSize: '19px', color: 'var(--color-text-main)', fontWeight: 600, marginBottom: '8px' }}>
          Sua conta foi suspensa
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '22px' }}>
          O acesso da clínica <strong>{clinicName || ''}</strong> ao Lumina CRM foi suspenso pelo
          administrador da plataforma. Nenhum dado foi removido.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
          Para regularizar a situação, entre em contato com o suporte Lumina.
        </p>

        <a
          href="mailto:suporte@luminaclin.com"
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            textAlign: 'center',
            background: 'var(--color-primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            padding: '13px',
            borderRadius: '8px',
            textDecoration: 'none',
            marginBottom: '10px',
          }}
        >
          Falar com o suporte
        </a>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleLogout}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
};
