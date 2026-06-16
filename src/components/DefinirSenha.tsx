import { useEffect, useState } from 'react';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
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
  const [sessionValida, setSessionValida] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ password: novaSenha }),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        setErro(json.error ?? 'Ocorreu um erro ao definir a senha. Tente novamente.');
      } else {
        setSucesso(true);
      }
    } catch {
      setErro('Ocorreu um erro ao definir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (sessionValida === null) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        Carregando Lumina...
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      padding: '24px',
      overflow: 'auto',
      zIndex: 1,
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '480px',
        padding: '48px',
        animation: 'fadeIn 0.6s ease-out',
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
      }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)',
            marginBottom: '16px',
          }}>
            <Sparkles size={28} />
          </div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '8px', fontWeight: 600 }}>
            Lumina
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
            Defina sua senha para acessar o sistema.
          </p>
        </div>

        {erro && (
          <div style={{
            padding: '12px', backgroundColor: '#FEE2E2', color: '#991B1B',
            borderRadius: '6px', fontSize: '13px', marginBottom: '24px', textAlign: 'center',
          }}>
            {erro}
          </div>
        )}

        {sucesso ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              padding: '20px 16px', backgroundColor: '#ECFDF5', color: '#065F46',
              borderRadius: '8px', fontSize: '15px', fontWeight: 600, marginBottom: '8px',
            }}>
              Senha definida com sucesso!
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
              Agora você pode entrar na sua conta com o e-mail e a senha que acabou de criar.
            </p>
            <button
              onClick={onSuccess}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            >
              Ir para o login
              <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nova senha</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-text-muted)' }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="Mínimo 8 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Confirmar senha</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-text-muted)' }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="Repita a nova senha"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px', padding: '14px', fontSize: '15px' }}
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Confirmar senha'}
              {!loading && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
