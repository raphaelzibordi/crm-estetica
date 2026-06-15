import React, { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { humanizeError } from '../lib/errors';
import { Sparkles, User, Mail, Lock, Phone, MapPin, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface AuthProps {
  onLogin: (session: Session | null) => void;
}

type PlanoBilling = 'basico' | 'pro' | 'enterprise';
type PeriodicidadeBilling = 'mensal' | 'anual';

const PLANOS: {
  id: PlanoBilling;
  nome: string;
  tagline: string;
  mensal: number;
  anual: number;
  destaque?: boolean;
}[] = [
  { id: 'basico',     nome: 'Básico',     tagline: 'Para profissionais autônomos',     mensal: 39.90,  anual: 29.90  },
  { id: 'pro',        nome: 'Pro',        tagline: 'Para clínicas em crescimento',     mensal: 89.90,  anual: 69.90,  destaque: true },
  { id: 'enterprise', nome: 'Enterprise', tagline: 'Múltiplas unidades e equipes',     mensal: 119.90, anual: 99.90  },
];

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isEquipe, setIsEquipe] = useState(false);
  const [passo, setPasso] = useState<'dados' | 'plano'>('dados');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeClinica, setNomeClinica] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');

  // Plan selection
  const [planoCadastro, setPlanoCadastro] = useState<PlanoBilling>('pro');
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadeBilling>('mensal');

  const formatTelefone = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    const truncated = numbersOnly.slice(0, 11);
    if (truncated.length <= 2) return truncated.length > 0 ? `(${truncated}` : '';
    if (truncated.length <= 6) return `(${truncated.slice(0, 2)}) ${truncated.slice(2)}`;
    if (truncated.length <= 10) return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 6)}-${truncated.slice(6)}`;
    return `(${truncated.slice(0, 2)}) ${truncated.slice(2, 7)}-${truncated.slice(7)}`;
  };

  const resetForm = () => {
    setEmail(''); setPassword(''); setNomeClinica('');
    setTelefone(''); setEndereco(''); setIsEquipe(false);
    setPasso('dados'); setPlanoCadastro('pro'); setPeriodicidade('mensal');
  };

  const validarDadosDono = (): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Por favor, informe um e-mail válido (ex: seuemail@dominio.com).';
    if (password.length < 6) return 'A senha precisa ter no mínimo 6 caracteres.';
    if (!nomeClinica.trim()) return 'Informe o nome da clínica.';
    if (!endereco.trim()) return 'Informe o endereço da clínica.';
    if (telefone.replace(/\D/g, '').length < 10) return 'Informe um telefone com DDD válido (mínimo 10 dígitos).';
    return null;
  };

  const handleContinuarParaPlano = () => {
    setError(null);
    const err = validarDadosDono();
    if (err) { setError(err); return; }
    setPasso('plano');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (isLogin) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

        if (authError) {
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

      } else if (isEquipe) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) throw new Error('Por favor, informe um e-mail válido.');
        if (password.length < 6) throw new Error('A senha precisa ter no mínimo 6 caracteres.');

        const { data: isTeamMember } = await Promise.resolve(
          supabase.rpc('is_equipe_email', { lookup_email: email.trim() })
        ).catch(() => ({ data: null as boolean | null }));

        if (isTeamMember === false) {
          throw new Error(
            'Este e-mail não está cadastrado em nenhuma equipe. Verifique com o responsável da clínica o e-mail correto.'
          );
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (authError) throw authError;

        if (authData.session && authData.user) {
          const { data: perfil } = await supabase
            .from('usuarios').select('role, owner_id').eq('id', authData.user.id).maybeSingle();
          if (!perfil || perfil.role !== 'equipe' || !perfil.owner_id) {
            await supabase.auth.signOut();
            throw new Error(
              'Não foi possível configurar seu perfil de equipe. Confirme com o responsável da clínica se o e-mail cadastrado é exatamente: ' + email.trim()
            );
          }
          onLogin(authData.session);
        } else {
          setInfo('Conta criada! Confirme seu e-mail e faça login para acessar o sistema da equipe.');
          resetForm();
          setIsLogin(true);
        }

      } else {
        // ── CADASTRO DONO: valida novamente antes de enviar ──
        const errDados = validarDadosDono();
        if (errDados) { setError(errDados); setPasso('dados'); return; }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { nome_clinica: nomeClinica, telefone, endereco } },
        });
        if (authError) throw authError;

        if (authData.session && authData.user) {
          await supabase.from('usuarios').upsert(
            { id: authData.user.id, nome_clinica: nomeClinica, telefone, endereco, email: email.trim(), role: 'dono' },
            { onConflict: 'id' }
          ).then(({ error: dbError }) => {
            if (dbError) console.error('[Lumina] Erro ao salvar perfil:', dbError);
          });

          // Inicia checkout do plano escolhido
          try {
            const { data: billingData, error: billingErr } = await supabase.functions.invoke('clinic-billing', {
              body: { action: 'start-checkout', plano: planoCadastro, periodicidade },
            });
            if (!billingErr && billingData?.checkoutUrl) {
              // Sign out antes do redirect: impede acesso ao sistema se o usuário
              // clicar em "voltar" no checkout sem concluir o pagamento.
              await supabase.auth.signOut();
              window.location.href = billingData.checkoutUrl;
              return;
            }
          } catch (_) {
            // Falha no checkout não bloqueia o acesso — PlanoModal vai aparecer ao logar
          }

          onLogin(authData.session);
        } else {
          setInfo('Cadastro criado! Confirme seu e-mail para liberar o acesso ao Lumina e em seguida faça login.');
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

  const isCadastroDono = !isLogin && !isEquipe;

  return (
    <div style={{
      position: 'fixed', inset: 0, width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)', padding: '24px',
      overflow: 'auto', zIndex: 1,
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: isCadastroDono && passo === 'plano' ? '520px' : '480px',
        padding: '48px',
        animation: 'fadeIn 0.6s ease-out',
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
        transition: 'max-width 0.2s',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', marginBottom: '16px',
          }}>
            <Sparkles size={28} />
          </div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '8px', fontWeight: 600 }}>Lumina</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
            {isLogin
              ? 'Bem-vindo de volta ao seu CRM estético.'
              : isEquipe
              ? 'Crie sua conta de acesso como membro da equipe.'
              : passo === 'dados'
              ? 'Inicie a jornada de alta performance da sua clínica.'
              : 'Escolha o plano ideal para a sua clínica.'}
          </p>
          {/* Indicador de passo para donos */}
          {isCadastroDono && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              {(['dados', 'plano'] as const).map((p, i) => (
                <React.Fragment key={p}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: passo === p || (p === 'dados' && passo === 'plano') ? 'var(--color-primary)' : 'var(--color-border)',
                    color: passo === p || (p === 'dados' && passo === 'plano') ? '#fff' : 'var(--color-text-muted)',
                    transition: 'background 0.2s',
                  }}>
                    {p === 'dados' && passo === 'plano' ? <Check size={13} /> : i + 1}
                  </div>
                  {i === 0 && (
                    <div style={{ width: 32, height: 2, background: passo === 'plano' ? 'var(--color-primary)' : 'var(--color-border)', borderRadius: 2, transition: 'background 0.2s' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
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

        {/* ── PASSO 2: SELEÇÃO DE PLANO (fora do form) ── */}
        {isCadastroDono && passo === 'plano' && (
          <div>
            {/* Banner 30 dias grátis */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '14px 16px', borderRadius: 10, marginBottom: 20,
              background: 'var(--color-primary-light)',
              border: '1px solid var(--color-primary)',
            }}>
              <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 3 }}>
                  30 dias grátis, independente do plano escolhido
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                  Todas as funcionalidades desbloqueadas durante o período de teste. Só é cobrado após os 30 dias — cancele antes e não paga nada.
                </div>
              </div>
            </div>

            {/* Toggle mensal / anual */}
            <div style={{ display: 'flex', gap: 8, background: '#f8f8f6', padding: 4, borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: 20 }}>
              {(['mensal', 'anual'] as const).map(p => (
                <button
                  key={p} type="button" onClick={() => setPeriodicidade(p)}
                  style={{
                    flex: 1, padding: '8px', fontSize: '13px', fontWeight: 600,
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    background: periodicidade === p ? 'var(--color-primary)' : 'transparent',
                    color: periodicidade === p ? '#fff' : 'var(--color-text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {p === 'mensal' ? 'Mensal' : 'Anual · economize ~25%'}
                </button>
              ))}
            </div>

            {/* Cards de plano */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {PLANOS.map(p => {
                const preco = periodicidade === 'mensal' ? p.mensal : p.anual;
                const selected = planoCadastro === p.id;
                return (
                  <button
                    key={p.id} type="button" onClick={() => setPlanoCadastro(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: selected ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                      background: selected ? 'var(--color-primary-light)' : 'transparent',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Radio visual */}
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        border: selected ? '5px solid var(--color-primary)' : '2px solid var(--color-border)',
                        background: selected ? 'var(--color-primary-light)' : 'transparent',
                        transition: 'all 0.15s',
                      }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-main)' }}>{p.nome}</span>
                          {p.destaque && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                              background: 'var(--color-primary)', color: '#fff', letterSpacing: '0.04em',
                            }}>
                              POPULAR
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{p.tagline}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: selected ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                        {fmtBRL(preco)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>/mês</span>
                      </div>
                      {periodicidade === 'anual' && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {fmtBRL(preco * 12)}/ano
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 6 }}>
              Checkout seguro via AbacatePay · Sem fidelidade · Cancele quando quiser
            </p>
            <p style={{ fontSize: 11, textAlign: 'center', marginBottom: 20 }}>
              <a
                href="https://luminaclin.com/planos"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
              >
                Ver todas as funcionalidades de cada plano
              </a>
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => { setPasso('dados'); setError(null); }}
                className="btn btn-outline"
                style={{ padding: '12px 16px' }}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', padding: '14px', fontSize: '15px' }}
                disabled={loading}
                onClick={handleAuth as unknown as React.MouseEventHandler}
              >
                {loading ? 'Criando conta...' : 'Iniciar 30 dias grátis'}
                {!loading && <ArrowRight size={18} style={{ marginLeft: 8 }} />}
              </button>
            </div>
          </div>
        )}

        {/* ── FORM: login / equipe / passo 1 do dono ── */}
        {(!isCadastroDono || passo === 'dados') && (
          <form onSubmit={isCadastroDono ? (e) => { e.preventDefault(); handleContinuarParaPlano(); } : handleAuth}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Toggle dono / equipe */}
            {!isLogin && (
              <div style={{ display: 'flex', gap: '8px', background: '#f8f8f6', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                {[
                  { v: false, label: 'Sou dono de clínica' },
                  { v: true,  label: 'Sou membro de equipe' },
                ].map(({ v, label }) => (
                  <button
                    key={String(v)} type="button" onClick={() => setIsEquipe(v)}
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

            {/* Campos dono */}
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

            {/* Banner equipe */}
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

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px', padding: '14px', fontSize: '15px' }}
              disabled={loading}
            >
              {loading
                ? 'Aguarde...'
                : isLogin
                ? 'Entrar no Lumina'
                : isEquipe
                ? 'Criar acesso de equipe'
                : 'Continuar para escolha do plano'}
              {!loading && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
            </button>
          </form>
        )}

        {/* Link login / cadastro */}
        {passo === 'dados' && (
          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '14px', color: 'var(--color-text-muted)' }}>
            {isLogin ? 'Ainda não possui uma conta? ' : 'Já faz parte do Lumina? '}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(null); setInfo(null); resetForm(); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              {isLogin ? 'Cadastre-se aqui' : 'Faça login'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
