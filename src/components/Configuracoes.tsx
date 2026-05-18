import React, { useState, useEffect } from 'react';
import { User, Building2, Users, Plus, X, Check, Edit2, Trash2, Shield } from 'lucide-react';
import { api } from '../lib/api';

interface ConfiguracoesProps {
  userId: string;
  userName?: string;
}

type ActiveTab = 'perfil' | 'equipe';

interface MembroEquipe {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  fotoUrl?: string;
}

const CARGOS_SUGERIDOS = [
  'Diretora da Clínica',
  'Harmonizadora Facial',
  'Biomédica',
  'Esteticista',
  'Gerente',
  'Recepcionista',
  'Enfermeira',
  'Dermatologista',
];

const EQUIPE_KEY = 'lumina_equipe';
function loadEquipe(): MembroEquipe[] {
  try { return JSON.parse(localStorage.getItem(EQUIPE_KEY) || '[]'); } catch { return []; }
}
function saveEquipe(e: MembroEquipe[]) { localStorage.setItem(EQUIPE_KEY, JSON.stringify(e)); }

export const Configuracoes: React.FC<ConfiguracoesProps> = ({ userId, userName }) => {
  const [tab, setTab] = useState<ActiveTab>('perfil');

  // ── Perfil state ──
  const [nomePerfil, setNomePerfil] = useState(userName || '');
  const [nomeClinica, setNomeClinica] = useState('');
  const [telefoneClinica, setTelefoneClinica] = useState('');
  const [enderecoClinica, setEnderecoClinica] = useState('');
  const [emailClinica, setEmailClinica] = useState('');
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilOk, setPerfilOk] = useState(false);

  // ── Equipe state ──
  const [equipe, setEquipe] = useState<MembroEquipe[]>(loadEquipe);
  const [showMembroModal, setShowMembroModal] = useState(false);
  const [editingMembroId, setEditingMembroId] = useState<string | null>(null);
  const [mNome, setMNome] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mSenha, setMSenha] = useState('');
  const [mCargo, setMCargo] = useState('');
  const [mCargoCustom, setMCargoCustom] = useState(false);

  useEffect(() => { loadPerfil(); }, [userId]);

  const loadPerfil = async () => {
    try {
      const data = await api.getPerfil(userId);
      if (data) {
        setNomeClinica(data.nome_clinica || '');
        setTelefoneClinica(data.telefone || '');
        setEnderecoClinica(data.endereco || '');
        setEmailClinica(data.email || '');
      }
    } catch (e) { console.error(e); }
  };

  const handleSavePerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPerfil(true);
    try {
      await api.upsertPerfil({
        nome_clinica: nomeClinica,
        telefone: telefoneClinica,
        endereco: enderecoClinica,
        email: emailClinica,
      }, userId);
      setPerfilOk(true);
      setTimeout(() => setPerfilOk(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar: ${err?.message || err}`);
    } finally { setSavingPerfil(false); }
  };

  // ── Membro handlers ──
  const openMembroModal = (m?: MembroEquipe) => {
    if (m) {
      setEditingMembroId(m.id); setMNome(m.nome); setMEmail(m.email);
      setMCargo(m.cargo); setMSenha('');
      setMCargoCustom(!CARGOS_SUGERIDOS.includes(m.cargo));
    } else {
      setEditingMembroId(null); setMNome(''); setMEmail('');
      setMSenha(''); setMCargo(CARGOS_SUGERIDOS[0]); setMCargoCustom(false);
    }
    setShowMembroModal(true);
  };

  const handleSaveMembro = (e: React.FormEvent) => {
    e.preventDefault();
    const cargo = mCargoCustom ? mCargo : mCargo;
    const membro: MembroEquipe = {
      id: editingMembroId || 'm_' + Date.now(),
      nome: mNome, email: mEmail, cargo,
    };
    setEquipe(prev => {
      const next = editingMembroId
        ? prev.map(m => m.id === editingMembroId ? membro : m)
        : [...prev, membro];
      saveEquipe(next); return next;
    });
    setShowMembroModal(false);
  };

  const handleDeleteMembro = (id: string) => {
    if (!window.confirm('Remover este membro da equipe?')) return;
    setEquipe(prev => { const next = prev.filter(m => m.id !== id); saveEquipe(next); return next; });
  };

  const tabBtn = (t: ActiveTab, label: string, Icon: any) => (
    <button
      onClick={() => setTab(t)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 18px', fontSize: '13px', fontWeight: 600,
        border: 'none', borderRadius: '8px', cursor: 'pointer',
        background: tab === t ? 'var(--color-primary)' : 'transparent',
        color: tab === t ? '#fff' : 'var(--color-text-muted)',
        transition: 'all 0.2s',
      }}
    >
      <Icon size={14} />{label}
    </button>
  );

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out', maxWidth: '800px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>Configurações</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Gerencie seus dados pessoais, informações da clínica e equipe.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', background: '#f8f8f6', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '4px', marginBottom: '28px', width: 'fit-content' }}>
        {tabBtn('perfil', 'Perfil & Clínica', Building2)}
        {tabBtn('equipe', 'Gestão de Equipe', Users)}
      </div>

      {/* ── TAB: PERFIL ── */}
      {tab === 'perfil' && (
        <form onSubmit={handleSavePerfil} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Dados da Clínica */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Dados da Clínica</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nome da Clínica</label>
                <input className="form-input" value={nomeClinica} onChange={e => setNomeClinica(e.target.value)} placeholder="Ex: Lumina Estética Avançada" />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp</label>
                <input className="form-input" value={telefoneClinica} onChange={e => setTelefoneClinica(e.target.value)} placeholder="(11) 9XXXX-XXXX" />
              </div>
              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input className="form-input" value={enderecoClinica} onChange={e => setEnderecoClinica(e.target.value)} placeholder="Rua, número, bairro, cidade" />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail Institucional</label>
                <input className="form-input" type="email" value={emailClinica} onChange={e => setEmailClinica(e.target.value)} placeholder="contato@clinica.com.br" />
              </div>
            </div>
          </div>

          {/* Dados do Usuário */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <User size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Meu Perfil</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Seu Nome / Nome na Plataforma</label>
                <input className="form-input" value={nomePerfil} onChange={e => setNomePerfil(e.target.value)} placeholder="Dra. Helena Martins" />
              </div>
            </div>
            <div style={{ marginTop: '12px', padding: '12px', background: '#f8f8f6', borderRadius: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              <Shield size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Para alterar sua senha ou e-mail de acesso, utilize a opção de recuperação de senha na tela de login.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', justifyContent: 'center' }} disabled={savingPerfil}>
              {perfilOk ? <><Check size={16} />Salvo!</> : savingPerfil ? 'Salvando...' : <><Check size={16} />Salvar Alterações</>}
            </button>
          </div>
        </form>
      )}

      {/* ── TAB: EQUIPE ── */}
      {tab === 'equipe' && (
        <div>
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Equipe da Clínica</h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>({equipe.length} membros)</span>
              </div>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => openMembroModal()}>
                <Plus size={14} />Adicionar Membro
              </button>
            </div>

            {equipe.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-muted)' }}>
                <Users size={28} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p style={{ fontWeight: 600 }}>Nenhum membro cadastrado</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Adicione os membros da sua equipe para controle de acesso e atribuição de cargos.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {equipe.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', background: '#fafafa' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
                      {m.nome.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.nome}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{m.email}</div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                      {m.cargo}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openMembroModal(m)} className="btn btn-outline" style={{ padding: '4px 8px' }}><Edit2 size={12} /></button>
                      <button onClick={() => handleDeleteMembro(m.id)} className="btn btn-outline" style={{ padding: '4px 8px', borderColor: '#fca5a5', color: '#ef4444' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: MEMBRO ── */}
      {showMembroModal && (
        <div onClick={() => setShowMembroModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '460px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{editingMembroId ? 'Editar Membro' : 'Novo Membro da Equipe'}</h3>
              <button onClick={() => setShowMembroModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveMembro} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nome Completo</label>
                <input className="form-input" value={mNome} onChange={e => setMNome(e.target.value)} placeholder="Ex: Dra. Ana Paula" required />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail de Acesso</label>
                <input className="form-input" type="email" value={mEmail} onChange={e => setMEmail(e.target.value)} placeholder="ana@clinica.com.br" required />
              </div>
              {!editingMembroId && (
                <div className="form-group">
                  <label className="form-label">Senha Provisória</label>
                  <input className="form-input" type="password" value={mSenha} onChange={e => setMSenha(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Cargo / Função</label>
                {!mCargoCustom ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select className="form-select" style={{ flex: 1 }} value={mCargo} onChange={e => setMCargo(e.target.value)}>
                      {CARGOS_SUGERIDOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => { setMCargoCustom(true); setMCargo(''); }} className="btn btn-outline" style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>Personalizar</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="form-input" style={{ flex: 1 }} value={mCargo} onChange={e => setMCargo(e.target.value)} placeholder="Digite o cargo personalizado..." required />
                    <button type="button" onClick={() => { setMCargoCustom(false); setMCargo(CARGOS_SUGERIDOS[0]); }} className="btn btn-outline" style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>Usar lista</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowMembroModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} />Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
