import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, User, Mail, Lock, Phone, MapPin, ArrowRight } from 'lucide-react';

interface AuthProps {
  onLogin: (session: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeClinica, setNomeClinica] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLogin(data.session);
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome_clinica: nomeClinica,
              telefone,
              endereco
            }
          }
        });
        if (authError) throw authError;
        
        // Se precisar criar o registro na tabela usuarios explicitamente (opcional se houver trigger no Supabase)
        if (authData.user) {
          const { error: dbError } = await supabase.from('usuarios').insert([
            {
              id: authData.user.id,
              nome_clinica: nomeClinica,
              telefone,
              endereco,
              email
            }
          ]);
          if (dbError) console.error('Erro ao salvar perfil no banco:', dbError);
        }

        alert('Cadastro realizado com sucesso! Você já pode fazer login.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro durante a autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-bg)',
      padding: '24px'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '480px',
        padding: '48px',
        animation: 'fadeIn 0.6s ease-out',
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', marginBottom: '16px' }}>
            <Sparkles size={28} />
          </div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '8px', fontWeight: 600 }}>Lumina</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
            {isLogin ? 'Bem-vindo de volta ao seu CRM estético.' : 'Inicie a jornada de alta performance da sua clínica.'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '13px', marginBottom: '24px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {!isLogin && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome da Clínica / Profissional</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-text-muted)' }} />
                  <input type="text" className="form-input" style={{ paddingLeft: '40px' }} value={nomeClinica} onChange={e => setNomeClinica(e.target.value)} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Endereço da Clínica</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-text-muted)' }} />
                  <input type="text" className="form-input" style={{ paddingLeft: '40px' }} value={endereco} onChange={e => setEndereco(e.target.value)} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Telefone de Contato</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-text-muted)' }} />
                  <input type="text" className="form-input" style={{ paddingLeft: '40px' }} value={telefone} onChange={e => setTelefone(e.target.value)} required />
                </div>
              </div>
            </>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">E-mail</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-text-muted)' }} />
              <input type="email" className="form-input" style={{ paddingLeft: '40px' }} value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Senha</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--color-text-muted)' }} />
              <input type="password" className="form-input" style={{ paddingLeft: '40px' }} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px', padding: '14px', fontSize: '15px' }} disabled={loading}>
            {loading ? 'Aguarde...' : (isLogin ? 'Entrar no Lumina' : 'Criar minha conta')}
            {!loading && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
          </button>
        </form>

        <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          {isLogin ? 'Ainda não possui uma conta? ' : 'Já faz parte do Lumina? '}
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {isLogin ? 'Cadastre-se aqui' : 'Faça login'}
          </button>
        </div>

      </div>
    </div>
  );
};
