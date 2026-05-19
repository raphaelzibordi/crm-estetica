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
  const [isEquipe, setIsEquipe] = useState(false); // modo membro de equipe
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeClinica, setNomeClinica] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');

  const formatTelefone = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    const truncated = numbersOnly.slice(0, 11);
    
    if (truncated.length <= 2) {
      return truncated.length > 0 ? `(${truncated}` : '';
    } else if (truncated.length <= 6) {
      return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
    } else if (truncated.length <= 10) {
      return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`;
    } else {
      return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNomeClinica('');
    setTelefone('');
    setEndereco('');
    setIsEquipe(false);
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

        if (authError) {
          // Detecta membro de equipe que nunca criou a senha de acesso.
          // A RPC is_equipe_email pode ser chamada sem sessão (grant anon).
          if (authError.message?.toLowerCase().includes('invalid login credentials')) {
            const { data: isTeamMember } = await Promise.resolve(
              supabase.rpc('is_equipe_email', { lookup_email: email.trim() })
            ).catch(() => ({ data: null as boolean | null }));

            if (isTeamMember === true) {
              throw new Error(
                'Sua conta de acesso ainda não foi criada. Clique em "Cadastre-se aqui", selecione "Sou membro de equipe" e defina sua senha para ativar o acesso.'
              );
            }
          }
          throw authError;
        }

        if (!data.session) throw new Error('Sessão inválida retornada pelo servidor.');
        onLogin(data.session);

      } else {
        // ── CADASTRO ──────────────────────────────────────────────
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          throw new Error('Por favor, informe um e-mail válido (ex: seuemail@dominio.com).');
        }
        if (password.length < 6) {
          throw new Error('A senha precisa ter no mínimo 6 caracteres.');
        }

        if (!isEquipe) {
          // Validações exclusivas para dono de clínica
          if (!nomeClinica.trim()) throw new Error('Informe o nome da clínica.');
          if (!endereco.trim()) throw new Error('Informe o endereço da clínica.');
          const rawTelefone = telefone.replace(/\D/g, '');
          if (rawTelefone.length < 10) {
            throw new Error('Informe um telefone com DDD válido (mínimo 10 dígitos).');
          }
        } else {
          // Pré-valida se o e-mail foi cadastrado em alguma equipe pelo dono.
          // Evita criar contas órfãs no Supabase Auth.
          const { data: isTeamMember } = await Promise.resolve(
            supabase.rpc('is_equipe_email', { lookup_email: email.trim() })
          ).catch(() => ({ data: null as boolean | null }));

          if (isTeamMember === false) {
            throw new Error(
              'Este e-mail não está cadastrado em nenhuma equipe. Verifique com o responsável da clínica o e-mail correto.'
            );
          }
        }

        const signUpOptions = isEquipe
          ? { email: email.trim(), password }
          : {
              email: email.trim(),
              password,
              options: { data: { nome_clinica: nomeClinica, telefone, endereco } },
            };

        const { data: authData, error: authError } = await supabase.auth.signUp(signUpOptions);
        if (authError) throw authError;

        if (authData.session && authData.user) {
          // Confirmação de e-mail desativada: sessão imediata.
          if (!isEquipe) {
            // Dono: garante o registro mesmo se o trigger falhar.
            await supabase.from('usuarios').upsert(
              { id: authData.user.id, nome_clinica: nomeClinica, telefone, endereco, email: email.trim(), role: 'dono' },
              { onConflict: 'id' }
            ).then(({ error: dbError }) => {
              if (dbError) console.error('[Lumina] Erro ao salvar perfil:', dbError);
            });
          } else {
            // Membro da equipe: verifica se o trigger criou o perfil corretamente.
            // O trigger handle_new_user() deve ter definido role='equipe' e owner_id.
            const { data: perfil } = await supabase
              .from('usuarios')
              .select('role, owner_id')
              .eq('id', authData.user.id)
              .maybeSingle();

            if (!perfil || perfil.role !== 'equipe' || !perfil.owner_id) {
              await supabase.auth.signOut();
              throw new Error(
                'Não foi possível configurar seu perfil de equipe. Confirme com o responsável da clínica se o e-mail cadastrado é exatamente: ' + email.trim()
              );
            }
          }
          onLogin(authData.session);
        } else {
          setInfo(
            isEquipe
              ? 'Conta criada! Confirme seu e-mail e faça login para acessar o sistema da equipe.'
              : 'Cadastro criado! Confirme seu e-mail para liberar o acesso ao Lumina e em seguida faça login.'
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
      zIndex: 1
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
            {isLogin
              ? 'Bem-vindo de volta ao seu CRM estético.'
              : isEquipe
              ? 'Crie sua conta de acesso como membro da equipe.'
              : 'Inicie a jornada de alta performance da sua clínica.'}
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

          {/* Toggle dono / membro de equipe — visível apenas no cadastro */}
          {!isLogin && (
            <div style={{ display: 'flex', gap: '8px', background: '#f8f8f6', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              {[
                { v: false, label: 'Sou dono de clínica' },
                { v: true,  label: 'Sou membro de equipe' },
              ].map(({ v, label }) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setIsEquipe(v)}
                  style={{
                    flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600,
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                    background: isEquipe === v ? 'var(--color-primary)' : 'transparent',
                    color: isEquipe === v ? '#fff' : 'var(--color-text-muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Campos exclusivos para donos de clínica */}
          {!isLogin && !isEquipe && (
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
                  <input type="text" className="form-input" style={{ paddingLeft: '40px' }} placeholder="(XX) 9XXXX-XXXX" value={telefone} onChange={e => setTelefone(formatTelefone(e.target.value))} required />
                </div>
              </div>
            </>
          )}

          {/* Banner informativo para membros de equipe */}
          {!isLogin && isEquipe && (
            <div style={{ padding: '10px 14px', background: 'var(--color-primary-light)', borderRadius: '8px', fontSize: '12px', color: 'var(--color-primary)', lineHeight: 1.6 }}>
              Use o <strong>e-mail cadastrado pelo responsável da sua clínica</strong>. Seu acesso será configurado automaticamente.
            </div>
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
            {loading ? 'Aguarde...' : isLogin ? 'Entrar no Lumina' : isEquipe ? 'Criar acesso de equipe' : 'Criar minha conta'}
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
