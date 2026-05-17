import React, { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { humanizeError } from '../lib/errors';
import { Sparkles, User, Mail, Lock, Phone, MapPin, ArrowRight } from 'lucide-react';

interface AuthProps {
  onLogin: (session: Session | null) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeClinica, setNomeClinica] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNomeClinica('');
    setTelefone('');
    setEndereco('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (isLogin) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        if (!data.session) {
          throw new Error('Sessão inválida retornada pelo servidor.');
        }
        onLogin(data.session);
      } else {
        // Validações mínimas no client antes de bater no Supabase
        if (!nomeClinica.trim()) throw new Error('Informe o nome da clínica.');
        if (!endereco.trim()) throw new Error('Informe o endereço da clínica.');
        if (!telefone.trim()) throw new Error('Informe um telefone de contato.');
        if (password.length < 6)
          throw new Error('A senha precisa ter no mínimo 6 caracteres.');

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nome_clinica: nomeClinica,
              telefone,
              endereco,
            },
          },
        });
        if (authError) throw authError;

        // Caso o projeto Supabase tenha confirmação de e-mail ativa, NÃO há sessão
        // — o insert na tabela `usuarios` falharia por RLS. O ideal é o trigger
        // `on_auth_user_created` (ver supabase_schema.sql).
        // Se já houver sessão (confirmação desativada), tentamos criar o perfil.
        if (authData.session && authData.user) {
          const { error: dbError } = await supabase
            .from('usuarios')
            .upsert(
              {
                id: authData.user.id,
                nome_clinica: nomeClinica,
                telefone,
                endereco,
                email: email.trim(),
              },
              { onConflict: 'id' }
            );
          if (dbError) {
            console.error('[Lumina] Erro ao salvar perfil no banco:', dbError);
          }
          onLogin(authData.session);
        } else {
          setInfo(
            'Cadastro criado! Confirme seu e-mail para liberar o acesso ao Lumina e em seguida faça login.'
          );
          resetForm();
          setIsLogin(true);
        }
      }
    } catch (err: unknown) {
      const friendly = humanizeError(err);
      setError(friendly.message);
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

        {info && (
          <div style={{ padding: '12px', backgroundColor: '#ECFDF5', color: '#065F46', borderRadius: '6px', fontSize: '13px', marginBottom: '24px', textAlign: 'center' }}>
            {info}
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
            onClick={() => { setIsLogin(!isLogin); setError(null); setInfo(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {isLogin ? 'Cadastre-se aqui' : 'Faça login'}
          </button>
        </div>

      </div>
    </div>
  );
};
