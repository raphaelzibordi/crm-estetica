import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onSuccess: () => void;
}

export function DefinirSenha({ onSuccess }: Props) {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  // null = verificando, true = sessão ativa, false = token inválido/expirado
  const [sessionValida, setSessionValida] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Token expirado ou link já usado — volta para o login.
        onSuccess();
      } else {
        setSessionValida(true);
      }
    });
  }, [onSuccess]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (novaSenha.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) {
        setErro(error.message);
      } else {
        setSucesso(true);
        setTimeout(() => onSuccess(), 1500);
      }
    } finally {
      setLoading(false);
    }
  }

  if (sessionValida === null) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: 'var(--color-bg)',
        }}
      >
        Carregando Lumina...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: '12px',
          padding: '40px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        }}
      >
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '1.4rem',
            color: 'var(--color-text)',
          }}
        >
          Defina sua senha
        </h2>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.9rem',
            color: 'var(--color-text-muted)',
          }}
        >
          Crie uma senha segura para acessar o sistema.
        </p>

        {sucesso ? (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'var(--color-success-bg, #d1fae5)',
              color: 'var(--color-success, #065f46)',
              fontSize: '0.9rem',
              textAlign: 'center',
            }}
          >
            Senha definida com sucesso! Redirecionando...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="nova-senha"
                style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text)' }}
              >
                Nova senha
              </label>
              <input
                id="nova-senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-input-bg, var(--color-bg))',
                  color: 'var(--color-text)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="confirma-senha"
                style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text)' }}
              >
                Confirmar senha
              </label>
              <input
                id="confirma-senha"
                type="password"
                value={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
                placeholder="Repita a nova senha"
                required
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-input-bg, var(--color-bg))',
                  color: 'var(--color-text)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>

            {erro && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-error-bg, #fee2e2)',
                  color: 'var(--color-error, #991b1b)',
                  fontSize: '0.85rem',
                }}
              >
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? 'var(--color-primary-muted, #a78bfa)' : 'var(--color-primary, #7c3aed)',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Salvando...' : 'Confirmar senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
