import React, { useState, useEffect, useCallback } from 'react';
import { User, Building2, Users, Plus, X, Check, Edit2, Trash2, Shield, Link, ToggleLeft, ToggleRight, Copy, Eye, EyeOff, Bell, FileText, Network, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { BookingSettings, ConfirmacaoSettings, DocumentoModelo, DocumentoTipo, MembroEquipe, Procedimento, Rede, Unidade } from '../types';
import { RedeClinicas } from './RedeClinicas';
import { MODELOS_PADRAO } from './AssinaturaDigital';

interface ConfiguracoesProps {
  userId: string;
  userName?: string;
  onProfileUpdate?: (update: { nome?: string; fotoUrl?: string }) => void;
  redes?: Rede[];
  redeUnidades?: Unidade[];
  onRedeUpdated?: () => void;
}

type ActiveTab = 'perfil' | 'equipe' | 'agendamento' | 'confirmacoes' | 'documentos' | 'rede';

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

export const Configuracoes: React.FC<ConfiguracoesProps> = ({ userId, userName, onProfileUpdate, redes = [], redeUnidades = [], onRedeUpdated }) => {
  const [tab, setTab] = useState<ActiveTab>('perfil');

  // ── Perfil pessoal ──
  const [nomePerfil, setNomePerfil] = useState(userName || '');
  const [telefonePessoal, setTelefonePessoal] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [savingFoto, setSavingFoto] = useState(false);
  const fotoInputRef = React.useRef<HTMLInputElement>(null);

  // ── Dados da clínica ──
  const [nomeClinica, setNomeClinica] = useState('');
  const [telefoneClinica, setTelefoneClinica] = useState('');
  const [enderecoClinica, setEnderecoClinica] = useState('');
  const [emailClinica, setEmailClinica] = useState('');
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilOk, setPerfilOk] = useState(false);

  // ── Agendamento online state ──
  const [booking, setBooking] = useState<BookingSettings>({
    bookingSlug: null,
    bookingEnabled: false,
    bookingMinAdvanceHoras: 1,
    bookingMaxAdvanceDias: 30,
  });
  const [bookingSlugInput, setBookingSlugInput] = useState('');
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingOk, setBookingOk]       = useState(false);
  const [bookingCopied, setBookingCopied] = useState(false);
  const [bookingProcedimentos, setBookingProcedimentos] = useState<Procedimento[]>([]);

  // ── Confirmações automáticas state ──
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoSettings>({
    confirmacaoHabilitada: true,
    confirmacaoMetodoPadrao: 'whatsapp',
    confirmacaoHorasAntes: 48,
    confirmacaoHorasAntes2: 2,
  });
  const [savingConfirmacao, setSavingConfirmacao] = useState(false);
  const [confirmacaoOk, setConfirmacaoOk] = useState(false);

  // ── Equipe state ──
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [showMembroModal, setShowMembroModal] = useState(false);
  const [editingMembroId, setEditingMembroId] = useState<string | null>(null);
  const [mNome, setMNome] = useState('');
  const [mEmail, setMEmail] = useState('');

  const [mCargo, setMCargo] = useState('');
  const [mCargoCustom, setMCargoCustom] = useState(false);
  const [savingMembro, setSavingMembro] = useState(false);

  // ── Documentos state (US-025) ──
  const [docTemplates, setDocTemplates] = useState<DocumentoModelo[]>([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docNome, setDocNome] = useState('');
  const [docTipo, setDocTipo] = useState<DocumentoTipo>('outro');
  const [docConteudo, setDocConteudo] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  useEffect(() => { loadPerfil(); loadEquipeRemota(); loadBookingSettings(); loadConfirmacaoSettings(); loadDocTemplates(); }, [userId]);

  const loadDocTemplates = async () => {
    try { setDocTemplates(await api.getDocumentTemplates(userId)); }
    catch { /* silently fail — table may not exist yet */ }
  };

  const loadBookingSettings = useCallback(async () => {
    try {
      const [s, procs] = await Promise.all([
        api.getBookingSettings(userId),
        api.getProcedimentos(userId),
      ]);
      setBooking(s);
      setBookingSlugInput(s.bookingSlug ?? '');
      setBookingProcedimentos(procs);
    } catch (e) { console.error('Erro ao carregar configurações de booking', e); }
  }, [userId]);

  const loadConfirmacaoSettings = useCallback(async () => {
    try {
      const settings = await api.getConfirmacaoSettings(userId);
      setConfirmacao(settings);
    } catch (e) { console.error('Erro ao carregar configurações de confirmação', e); }
  }, [userId]);

  const loadEquipeRemota = async () => {
    try { setEquipe(await api.getEquipe(userId)); }
    catch (e) { console.error('Erro ao carregar equipe', e); }
  };

  // ── Upload de foto de perfil ──
  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2 MB.');
      return;
    }
    setSavingFoto(true);
    try {
      const url = await api.uploadFotoPerfil(file, userId);
      await api.upsertPerfil({ foto_url: url }, userId);
      setFotoUrl(url);
      onProfileUpdate?.({ fotoUrl: url });
    } catch (err: any) {
      alert(`Erro ao enviar foto: ${err?.message || err}`);
    } finally {
      setSavingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  const formatTelefone = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    if (n.length <= 2)  return n.length ? `(${n}` : '';
    if (n.length <= 6)  return `(${n.slice(0,2)}) ${n.slice(2)}`;
    if (n.length <= 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  };

  const loadPerfil = async () => {
    try {
      const data = await api.getPerfil(userId);
      if (data) {
        setNomeClinica(data.nome_clinica || '');
        setTelefoneClinica(data.telefone || '');
        setEnderecoClinica(data.endereco || '');
        setEmailClinica(data.email || '');
        setNomePerfil(data.nome || userName || '');
        setTelefonePessoal(data.telefone_pessoal || '');
        setDataNascimento(data.data_nascimento || '');
        setFotoUrl(data.foto_url || '');
      }
    } catch (e) { console.error(e); }
  };

  const handleSavePerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPerfil(true);
    try {
      await api.upsertPerfil({
        nome: nomePerfil,
        nome_clinica: nomeClinica,
        telefone: telefoneClinica,
        telefone_pessoal: telefonePessoal.replace(/\D/g, '') ? telefonePessoal : undefined,
        endereco: enderecoClinica,
        email: emailClinica,
        data_nascimento: dataNascimento || undefined,
      }, userId);
      onProfileUpdate?.({ nome: nomePerfil });
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
      setMCargo(m.cargo);
      setMCargoCustom(!CARGOS_SUGERIDOS.includes(m.cargo));
    } else {
      setEditingMembroId(null); setMNome(''); setMEmail('');
      setMCargo(CARGOS_SUGERIDOS[0]); setMCargoCustom(false);
    }
    setShowMembroModal(true);
  };

  const handleSaveMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMembro(true);
    try {
      if (editingMembroId) {
        const atualizado = await api.updateMembroEquipe(
          editingMembroId,
          { nome: mNome, email: mEmail, cargo: mCargo },
          userId
        );
        setEquipe(prev => prev.map(m => (m.id === editingMembroId ? atualizado : m)));
      } else {
        // Cria apenas o registro na tabela equipe.
        // O membro criará a própria conta de acesso na tela de login do Lumina.
        // O sistema detectará automaticamente o e-mail e configurará o perfil correto.
        const novo = await api.createMembroEquipe(
          { nome: mNome, email: mEmail, cargo: mCargo, ativo: true },
          userId
        );
        setEquipe(prev => [...prev, novo]);
      }
      setShowMembroModal(false);
    } catch (err: any) {
      alert(`Erro ao salvar membro: ${err?.message || err}`);
    } finally {
      setSavingMembro(false);
    }
  };

  // ── Booking handlers ──
  const slugFromName = (name: string) =>
    name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleSaveBooking = async () => {
    setSavingBooking(true);
    try {
      const slug = bookingSlugInput.trim() || slugFromName(nomeClinica || 'clinica');
      await api.updateBookingSettings({
        bookingSlug: slug,
        bookingEnabled:         booking.bookingEnabled,
        bookingMinAdvanceHoras: booking.bookingMinAdvanceHoras,
        bookingMaxAdvanceDias:  booking.bookingMaxAdvanceDias,
      }, userId);
      setBooking(prev => ({ ...prev, bookingSlug: slug }));
      setBookingSlugInput(slug);
      setBookingOk(true);
      setTimeout(() => setBookingOk(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar: ${err?.message || err}`);
    } finally { setSavingBooking(false); }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/agenda/${booking.bookingSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setBookingCopied(true);
      setTimeout(() => setBookingCopied(false), 2500);
    });
  };

  const handleToggleProcedimentoVisivel = async (id: string, visivel: boolean) => {
    setBookingProcedimentos(prev => prev.map(p => p.id === id ? { ...p, bookingVisivel: visivel } : p));
    try { await api.updateProcedimentoBookingVisivel(id, visivel, userId); }
    catch (err: any) {
      alert(`Erro: ${err?.message || err}`);
      setBookingProcedimentos(prev => prev.map(p => p.id === id ? { ...p, bookingVisivel: !visivel } : p));
    }
  };

  const handleToggleEquipeVisivel = async (id: string, visivel: boolean) => {
    setEquipe(prev => prev.map(m => m.id === id ? { ...m, bookingVisivel: visivel } : m));
    try { await api.updateEquipeBookingVisivel(id, visivel, userId); }
    catch (err: any) {
      alert(`Erro: ${err?.message || err}`);
      setEquipe(prev => prev.map(m => m.id === id ? { ...m, bookingVisivel: !visivel } : m));
    }
  };

  const handleSaveConfirmacao = async () => {
    setSavingConfirmacao(true);
    try {
      await api.updateConfirmacaoSettings(confirmacao, userId);
      setConfirmacaoOk(true);
      setTimeout(() => setConfirmacaoOk(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar: ${err?.message || err}`);
    } finally { setSavingConfirmacao(false); }
  };

  const handleDeleteMembro = async (id: string) => {
    if (!window.confirm('Remover este membro da equipe?')) return;
    try {
      await api.deleteMembroEquipe(id, userId);
      setEquipe(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      alert(`Erro ao remover membro: ${err?.message || err}`);
    }
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
      <div style={{ display: 'flex', gap: '4px', background: '#f8f8f6', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '4px', marginBottom: '28px', width: 'fit-content', flexWrap: 'wrap' }}>
        {tabBtn('perfil', 'Perfil & Clínica', Building2)}
        {tabBtn('equipe', 'Gestão de Equipe', Users)}
        {tabBtn('agendamento', 'Agendamento Online', Link)}
        {tabBtn('confirmacoes', 'Confirmações Automáticas', Bell)}
        {tabBtn('documentos', 'Modelos de Documentos', FileText)}
        {tabBtn('rede', 'Rede de Clínicas', Network)}
      </div>

      {/* ── TAB: PERFIL ── */}
      {tab === 'perfil' && (
        <form onSubmit={handleSavePerfil} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Dados da Clínica / Rede */}
          {redes.length > 0 ? (
            /* ── Modo rede: mostra resumo das unidades ── */
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Network size={16} style={{ color: 'var(--color-primary)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Rede de Clínicas</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('rede')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '6px 12px', background: 'var(--color-primary-light)',
                    border: 'none', borderRadius: 'var(--border-radius-sm)',
                    color: 'var(--color-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Gerenciar <ChevronRight size={13} />
                </button>
              </div>

              {redes.map(rede => {
                const unidadesDaRede = redeUnidades.filter(u => u.redeId === rede.id);
                return (
                  <div key={rede.id} style={{ marginBottom: redes.length > 1 ? '20px' : 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {rede.nome}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {unidadesDaRede.length === 0 ? (
                        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
                          Nenhuma unidade cadastrada ainda.
                        </p>
                      ) : unidadesDaRede.map((u, idx) => (
                        <div
                          key={u.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 14px',
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--border-radius-sm)',
                            opacity: u.ativo ? 1 : 0.5,
                          }}
                        >
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: u.ativo ? 'var(--color-primary-light)' : 'var(--color-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontSize: '12px', fontWeight: 700,
                            color: u.ativo ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {u.nome}
                              {!u.ativo && (
                                <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '100px', background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                                  Inativa
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {u.telefone && <span>{u.telefone}</span>}
                              {u.endereco && <span>{u.endereco}</span>}
                              {u.cnpj     && <span>CNPJ: {u.cnpj}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Modo clínica única: formulário padrão ── */
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Dados da Clínica</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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
          )}

          {/* Dados pessoais do usuário */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <User size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Meu Perfil</h3>
            </div>

            {/* Avatar upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {fotoUrl ? (
                  <img
                    src={fotoUrl}
                    alt="Foto de perfil"
                    style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)' }}
                  />
                ) : (
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'var(--color-primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-primary)', fontWeight: 700, fontSize: '24px',
                    border: '2px solid var(--color-border)',
                  }}>
                    {(nomePerfil || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFotoUpload}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={savingFoto}
                >
                  {savingFoto ? 'Enviando...' : 'Alterar Foto'}
                </button>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  JPEG, PNG ou WebP · Máx. 2 MB
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Seu Nome</label>
                <input className="form-input" value={nomePerfil} onChange={e => setNomePerfil(e.target.value)} placeholder="Dra. Helena Martins" />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone Pessoal</label>
                <input
                  className="form-input"
                  value={telefonePessoal}
                  onChange={e => setTelefonePessoal(formatTelefone(e.target.value))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Data de Nascimento</label>
                <input
                  type="date"
                  className="form-input"
                  value={dataNascimento}
                  onChange={e => setDataNascimento(e.target.value)}
                />
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

            <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#f8f8f6', borderRadius: '8px', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <Shield size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Membros cadastrados aqui devem criar a própria conta no Lumina usando o e-mail registrado. O acesso será automaticamente restrito às abas <strong>Jornada, Agenda e Prontuário</strong>.
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

      {/* ── TAB: AGENDAMENTO ONLINE ── */}
      {tab === 'agendamento' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Ativar / Desativar */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Link size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Link Público de Agendamento</h3>
            </div>

            {/* Enable toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: booking.bookingEnabled ? 'var(--color-primary-light)' : '#f8f8f6', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-main)' }}>Agendamento online ativo</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{booking.bookingEnabled ? 'Pacientes podem agendar pelo link público' : 'Link desativado — pacientes não conseguem agendar'}</div>
              </div>
              <button
                onClick={() => setBooking(prev => ({ ...prev, bookingEnabled: !prev.bookingEnabled }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: booking.bookingEnabled ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
              >
                {booking.bookingEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
              </button>
            </div>

            {/* Slug input */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Endereço do link (slug)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ padding: '0 12px', fontSize: '12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', borderRight: '1px solid var(--color-border)', background: '#f8f8f6', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                    /agenda/
                  </span>
                  <input
                    className="form-input"
                    style={{ border: 'none', borderRadius: 0, flex: 1 }}
                    value={bookingSlugInput}
                    onChange={e => setBookingSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-'))}
                    placeholder={slugFromName(nomeClinica || 'minha-clinica')}
                  />
                </div>
                {booking.bookingSlug && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="btn btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '12px' }}
                  >
                    <Copy size={12} />{bookingCopied ? 'Copiado!' : 'Copiar link'}
                  </button>
                )}
              </div>
              {booking.bookingSlug && (
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                  Link atual: <strong>{window.location.origin}/agenda/{booking.bookingSlug}</strong>
                </p>
              )}
            </div>

            {/* Min advance + max window */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Antecedência mínima</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    className="form-input"
                    min={0} max={48}
                    value={booking.bookingMinAdvanceHoras}
                    onChange={e => setBooking(prev => ({ ...prev, bookingMinAdvanceHoras: Number(e.target.value) }))}
                    style={{ width: '80px' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>horas</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Janela máxima</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    className="form-input"
                    min={1} max={180}
                    value={booking.bookingMaxAdvanceDias}
                    onChange={e => setBooking(prev => ({ ...prev, bookingMaxAdvanceDias: Number(e.target.value) }))}
                    style={{ width: '80px' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>dias</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveBooking}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', justifyContent: 'center' }}
                disabled={savingBooking}
              >
                {bookingOk ? <><Check size={16} />Salvo!</> : savingBooking ? 'Salvando...' : <><Check size={16} />Salvar Configurações</>}
              </button>
            </div>
          </div>

          {/* Procedimentos visíveis */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Eye size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Procedimentos no Link Público</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              Defina quais procedimentos os pacientes podem selecionar ao agendar online.
            </p>
            {bookingProcedimentos.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Nenhum procedimento cadastrado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bookingProcedimentos.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: p.bookingVisivel !== false ? 'var(--color-primary-light)' : '#f8f8f6' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>{p.nome}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{p.duracaoMinutos} min · {p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    </div>
                    <button
                      onClick={() => handleToggleProcedimentoVisivel(p.id, !(p.bookingVisivel !== false))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.bookingVisivel !== false ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                      title={p.bookingVisivel !== false ? 'Ocultar do link público' : 'Mostrar no link público'}
                    >
                      {p.bookingVisivel !== false ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profissionais visíveis */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Users size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Profissionais no Link Público</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              Defina quais profissionais aparecem para o paciente escolher ao agendar online.
            </p>
            {equipe.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Nenhum membro da equipe cadastrado. Adicione membros na aba "Gestão de Equipe".</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {equipe.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: m.bookingVisivel !== false ? 'var(--color-primary-light)' : '#f8f8f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>{m.nome}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{m.cargo}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleEquipeVisivel(m.id, !(m.bookingVisivel !== false))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: m.bookingVisivel !== false ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                      title={m.bookingVisivel !== false ? 'Ocultar do link público' : 'Mostrar no link público'}
                    >
                      {m.bookingVisivel !== false ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: CONFIRMAÇÕES AUTOMÁTICAS ── */}
      {tab === 'confirmacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Configurações Gerais */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Bell size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Confirmações de Consultas</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Automatize envios de WhatsApp/SMS para reduzir o trabalho manual de confirmação de consultas. A recepção receberá lembretes automáticos no horário configurado.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Toggle Habilitada */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--color-primary-light)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>Confirmações Automáticas</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Enviar lembretes automáticos de consultas agendadas</div>
                </div>
                <button
                  onClick={() => setConfirmacao(prev => ({ ...prev, confirmacaoHabilitada: !prev.confirmacaoHabilitada }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: confirmacao.confirmacaoHabilitada ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                >
                  {confirmacao.confirmacaoHabilitada ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>

              {confirmacao.confirmacaoHabilitada && (
                <>
                  {/* Método Padrão */}
                  <div className="form-group">
                    <label className="form-label">Método de Envio Padrão</label>
                    <select
                      className="form-input"
                      value={confirmacao.confirmacaoMetodoPadrao}
                      onChange={e => setConfirmacao(prev => ({ ...prev, confirmacaoMetodoPadrao: e.target.value as any }))}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="whatsapp">WhatsApp (preferencial)</option>
                      <option value="sms">SMS</option>
                      <option value="ambos">Ambos (WhatsApp + SMS)</option>
                    </select>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                      {confirmacao.confirmacaoMetodoPadrao === 'whatsapp' && 'Envia via WhatsApp com maior taxa de leitura.'}
                      {confirmacao.confirmacaoMetodoPadrao === 'sms' && 'Envia via SMS, com maior garantia de recebimento.'}
                      {confirmacao.confirmacaoMetodoPadrao === 'ambos' && 'Envia primeiramente via WhatsApp e depois SMS como reforço.'}
                    </p>
                  </div>

                  {/* Primeiro Lembrete */}
                  <div className="form-group">
                    <label className="form-label">Primeiro Lembrete (horas antes da consulta)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={confirmacao.confirmacaoHorasAntes}
                        onChange={e => setConfirmacao(prev => ({ ...prev, confirmacaoHorasAntes: Math.max(1, parseInt(e.target.value)) }))}
                        className="form-input"
                        style={{ flex: 1, maxWidth: '120px' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>horas</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                      Valor recomendado: 48 horas (2 dias antes). Máximo: 168 horas (7 dias).
                    </p>
                  </div>

                  {/* Segundo Lembrete */}
                  <div className="form-group">
                    <label className="form-label">Segundo Lembrete (horas antes da consulta)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={confirmacao.confirmacaoHorasAntes2}
                        onChange={e => setConfirmacao(prev => ({ ...prev, confirmacaoHorasAntes2: Math.max(0, parseInt(e.target.value)) }))}
                        className="form-input"
                        style={{ flex: 1, maxWidth: '120px' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>horas</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                      Valor recomendado: 2 horas. Use 0 para desativar segundo lembrete.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Botão Salvar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={handleSaveConfirmacao}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', justifyContent: 'center' }}
                disabled={savingConfirmacao}
              >
                {confirmacaoOk ? <><Check size={16} />Salvo!</> : savingConfirmacao ? 'Salvando...' : <><Check size={16} />Salvar Configurações</>}
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="card" style={{ padding: '20px', background: '#f0f7f4', border: '1px solid var(--color-primary-light)' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ fontSize: '28px', lineHeight: 1 }}>ℹ️</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '8px' }}>Como funciona</div>
                <ul style={{ fontSize: '13px', color: 'var(--color-text-main)', lineHeight: 1.8, paddingLeft: '20px' }}>
                  <li>Confirmações são enviadas automaticamente nos horários configurados</li>
                  <li>Cada paciente recebe mensagens personalizadas com data, hora e profissional</li>
                  <li>Histórico de envios é registrado para auditoria e resgate</li>
                  <li>Reduz tempo de recepção em até 85% (de 30-40% para ~5%)</li>
                  <li>Aumento de no-shows é reduzido em até 25%</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MEMBRO ── */}
      {/* ── TAB: DOCUMENTOS ── */}
      {tab === 'documentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Modelos de Documentos</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Gerencie os modelos usados para contratos, consentimentos e prescrições (CA-05).</p>
              </div>
              <button
                onClick={() => { setEditingDocId(null); setDocNome(''); setDocTipo('outro'); setDocConteudo(''); setShowDocModal(true); }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              >
                <Plus size={14} /> Novo Modelo
              </button>
            </div>

            {/* Modelos padrão (read-only) */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Modelos Padrão
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {MODELOS_PADRAO.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', background: '#fafbfb' }}>
                    <FileText size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>{m.nome}</div>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-border)', padding: '2px 8px', borderRadius: '20px' }}>
                      Padrão
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modelos personalizados */}
            {docTemplates.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Modelos Personalizados
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {docTemplates.map((tmpl) => (
                    <div key={tmpl.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}>
                      <FileText size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.nome}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{tmpl.tipo}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => { setEditingDocId(tmpl.id); setDocNome(tmpl.nome); setDocTipo(tmpl.tipo); setDocConteudo(tmpl.conteudo); setShowDocModal(true); }}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit2 size={11} /> Editar
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm('Excluir este modelo de documento?')) return;
                            await api.deleteDocumentTemplate(tmpl.id, userId);
                            setDocTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
                          }}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#fca5a5', color: '#ef4444' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Criar/Editar Modelo */}
      {showDocModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}
          onClick={() => setShowDocModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '660px', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{editingDocId ? 'Editar Modelo' : 'Novo Modelo de Documento'}</h3>
              <button onClick={() => setShowDocModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nome do Modelo</label>
                <input className="form-input" value={docNome} onChange={(e) => setDocNome(e.target.value)} placeholder="Ex: Contrato de Harmonização Facial" />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={docTipo} onChange={(e) => setDocTipo(e.target.value as DocumentoTipo)}>
                  <option value="contrato">Contrato</option>
                  <option value="tcle">TCLE — Consentimento Livre e Esclarecido</option>
                  <option value="termo_anestesia">Termo de Anestesia</option>
                  <option value="termo_fotografias">Autorização de Fotografias</option>
                  <option value="prescricao">Prescrição Médica</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Conteúdo do Documento</label>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  Use {'{{nome_paciente}}'}, {'{{data}}'}, {'{{procedimento}}'}, {'{{profissional}}'}, {'{{crmProfissional}}'} como variáveis dinâmicas.
                </p>
                <textarea
                  rows={14}
                  className="form-textarea"
                  value={docConteudo}
                  onChange={(e) => setDocConteudo(e.target.value)}
                  placeholder="Digite o conteúdo do documento com variáveis {{nome_paciente}}, {{data}}, etc..."
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.6' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowDocModal(false)} className="btn btn-outline">Cancelar</button>
                <button
                  disabled={savingDoc || !docNome.trim() || !docConteudo.trim()}
                  onClick={async () => {
                    setSavingDoc(true);
                    try {
                      const vars = [...docConteudo.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
                      const uniq = [...new Set(vars)];
                      if (editingDocId) {
                        const updated = await api.updateDocumentTemplate(editingDocId, { nome: docNome, tipo: docTipo, conteudo: docConteudo, variaveis: uniq }, userId);
                        setDocTemplates((prev) => prev.map((t) => t.id === editingDocId ? updated : t));
                      } else {
                        const created = await api.createDocumentTemplate({ nome: docNome, tipo: docTipo, conteudo: docConteudo, variaveis: uniq }, userId);
                        setDocTemplates((prev) => [...prev, created]);
                      }
                      setShowDocModal(false);
                    } catch (err: any) {
                      alert(`Erro ao salvar modelo: ${err?.message || err}`);
                    } finally { setSavingDoc(false); }
                  }}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={14} /> {savingDoc ? 'Salvando...' : 'Salvar Modelo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMembroModal && (
        <div onClick={() => setShowMembroModal(false)} className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: '460px', width: '92%', padding: '32px' }}>
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
                <div style={{ padding: '12px 14px', background: 'var(--color-primary-light)', borderRadius: '8px', fontSize: '12px', color: 'var(--color-primary)', lineHeight: 1.6 }}>
                  <strong>Como o membro acessa o sistema?</strong><br />
                  Após salvar, compartilhe o link do Lumina com <strong>{mEmail || 'o membro'}</strong> e peça que crie uma conta com este e-mail. O sistema reconhecerá automaticamente o perfil de equipe.
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
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} disabled={savingMembro}><Check size={14} />{savingMembro ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === 'rede' && (
        <RedeClinicas userId={userId} onRedeUpdated={onRedeUpdated} />
      )}
    </div>
  );
};
