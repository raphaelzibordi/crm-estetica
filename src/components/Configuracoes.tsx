import React, { useState, useEffect, useCallback } from 'react';
import { User, Building2, Users, Plus, X, Check, Edit2, Trash2, Shield, Link, ToggleLeft, ToggleRight, Copy, Eye, EyeOff, Bell, FileText, Network, ChevronRight, Sparkles, Clock } from 'lucide-react';
import { api } from '../lib/api';
import type { BookingSettings, ConfirmacaoSettings, DocumentoModelo, DocumentoTipo, HorarioAtendimento, MembroEquipe, PerfilAcesso, Permissoes, Procedimento, Rede, Unidade } from '../types';
import { RedeClinicas } from './RedeClinicas';
import { PerfilAcessoModal } from './PerfilAcessoModal';
import { MODELOS_PADRAO } from './AssinaturaDigital';

interface ConfiguracoesProps {
  userId: string;
  userName?: string;
  onProfileUpdate?: (update: { nome?: string; fotoUrl?: string }) => void;
  redes?: Rede[];
  redeUnidades?: Unidade[];
  onRedeUpdated?: () => void;
  plano?: string | null;
}

type ActiveTab = 'perfil' | 'equipe' | 'agendamento' | 'horarios' | 'confirmacoes' | 'documentos' | 'rede';

const DIAS_HORARIO: { key: string; label: string }[] = [
  { key: '1', label: 'Segunda-feira' },
  { key: '2', label: 'Terça-feira' },
  { key: '3', label: 'Quarta-feira' },
  { key: '4', label: 'Quinta-feira' },
  { key: '5', label: 'Sexta-feira' },
  { key: '6', label: 'Sábado' },
  { key: '0', label: 'Domingo' },
];

const HORARIO_PADRAO: HorarioAtendimento = DIAS_HORARIO.reduce((acc, d) => {
  acc[d.key] = { abre: '08:00', fecha: '20:00', fechado: d.key === '0' };
  return acc;
}, {} as HorarioAtendimento);

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

export const Configuracoes: React.FC<ConfiguracoesProps> = ({ userId, userName, onProfileUpdate, redes = [], redeUnidades = [], onRedeUpdated, plano }) => {
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
    horarioAtendimento: null,
  });
  const [bookingSlugInput, setBookingSlugInput] = useState('');
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingOk, setBookingOk]       = useState(false);
  const [bookingCopied, setBookingCopied] = useState(false);
  const [bookingProcedimentos, setBookingProcedimentos] = useState<Procedimento[]>([]);

  // ── Horário de atendimento state ──
  const [horario, setHorario] = useState<HorarioAtendimento | null>(null);
  const [savingHorario, setSavingHorario] = useState(false);
  const [horarioOk, setHorarioOk] = useState(false);

  // ── Confirmações automáticas state ──
  const [, setConfirmacao] = useState<ConfirmacaoSettings>({
    confirmacaoHabilitada: true,
    confirmacaoMetodoPadrao: 'whatsapp',
    confirmacaoHorasAntes: 48,
    confirmacaoHorasAntes2: 2,
  });

  // ── Equipe state ──
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [showMembroModal, setShowMembroModal] = useState(false);
  const [editingMembroId, setEditingMembroId] = useState<string | null>(null);
  const [mNome, setMNome] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mCargo, setMCargo] = useState('');
  const [mCargoCustom, setMCargoCustom] = useState(false);
  const [mPerfilId, setMPerfilId] = useState<string | null>(null);
  const [savingMembro, setSavingMembro] = useState(false);

  // ── Perfis de Acesso state ──
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<PerfilAcesso | null>(null);

  // ── Documentos state (US-025) ──
  const [docTemplates, setDocTemplates] = useState<DocumentoModelo[]>([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docNome, setDocNome] = useState('');
  const [docTipo, setDocTipo] = useState<DocumentoTipo>('outro');
  const [docConteudo, setDocConteudo] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  useEffect(() => { loadPerfil(); loadEquipeRemota(); loadBookingSettings(); loadConfirmacaoSettings(); loadDocTemplates(); loadPerfisAcesso(); }, [userId]);

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
      setHorario(s.horarioAtendimento);
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

  const loadPerfisAcesso = async () => {
    try { setPerfis(await api.getPerfisAcesso(userId)); }
    catch { /* silently fail — table may not exist yet */ }
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
        setNomePerfil(data.nome || '');
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
      setMPerfilId(m.perfilId ?? null);
    } else {
      setEditingMembroId(null); setMNome(''); setMEmail('');
      setMCargo(CARGOS_SUGERIDOS[0]); setMCargoCustom(false);
      setMPerfilId(null);
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
          { nome: mNome, email: mEmail, cargo: mCargo, perfilId: mPerfilId },
          userId
        );
        setEquipe(prev => prev.map(m => (m.id === editingMembroId ? atualizado : m)));
      } else {
        const novo = await api.createMembroEquipe(
          { nome: mNome, email: mEmail, cargo: mCargo, ativo: true, perfilId: mPerfilId },
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

  const handleSavePerfilAcesso = async (nome: string, permissoes: Permissoes) => {
    if (editingPerfil) {
      const updated = await api.updatePerfilAcesso(editingPerfil.id, { nome, permissoes }, userId);
      setPerfis(prev => prev.map(p => p.id === editingPerfil.id ? updated : p));
    } else {
      const novo = await api.createPerfilAcesso({ nome, permissoes }, userId);
      setPerfis(prev => [...prev, novo]);
    }
    setShowPerfilModal(false);
    setEditingPerfil(null);
  };

  const handleDeletePerfil = async (id: string) => {
    const membrosVinculados = equipe.filter(m => m.perfilId === id).length;
    if (membrosVinculados > 0) {
      alert(`Este perfil está em uso por ${membrosVinculados} membro(s). Remova o vínculo antes de deletar.`);
      return;
    }
    if (!window.confirm('Deletar este perfil de acesso?')) return;
    try {
      await api.deletePerfilAcesso(id, userId);
      setPerfis(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert(`Erro ao deletar perfil: ${err?.message || err}`);
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

  // ── Horário de atendimento handlers ──
  const handleToggleHorarioPersonalizado = () => {
    setHorario(prev => prev === null ? HORARIO_PADRAO : null);
  };

  const handleChangeDia = (key: string, patch: Partial<{ abre: string; fecha: string; fechado: boolean }>) => {
    setHorario(prev => {
      const base = prev ?? HORARIO_PADRAO;
      return { ...base, [key]: { ...base[key], ...patch } };
    });
  };

  const handleCopiarParaTodos = (key: string) => {
    setHorario(prev => {
      if (!prev) return prev;
      const origem = prev[key];
      const next: HorarioAtendimento = { ...prev };
      DIAS_HORARIO.forEach(d => { next[d.key] = { ...origem }; });
      return next;
    });
  };

  const handleSaveHorario = async () => {
    if (horario) {
      const invalido = DIAS_HORARIO.some(d => {
        const dia = horario[d.key];
        return !dia.fechado && dia.abre >= dia.fecha;
      });
      if (invalido) {
        alert('O horário de abertura precisa ser antes do horário de fechamento.');
        return;
      }
    }
    setSavingHorario(true);
    try {
      await api.updateBookingSettings({ horarioAtendimento: horario }, userId);
      setBooking(prev => ({ ...prev, horarioAtendimento: horario }));
      setHorarioOk(true);
      setTimeout(() => setHorarioOk(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar: ${err?.message || err}`);
    } finally { setSavingHorario(false); }
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
        {tabBtn('horarios', 'Horário de Atendimento', Clock)}
        {tabBtn('confirmacoes', 'Confirmações Automáticas', Bell)}
        {tabBtn('documentos', 'Modelos de Documentos', FileText)}
        {(plano === 'enterprise' || plano === 'vip' || plano == null) && tabBtn('rede', 'Rede de Clínicas', Network)}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Seção: Perfis de Acesso */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Perfis de Acesso</h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>({perfis.length} perfis)</span>
              </div>
              <button
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                onClick={() => { setEditingPerfil(null); setShowPerfilModal(true); }}
              >
                <Plus size={13} />Novo Perfil
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
              Perfis definem quais módulos e ações cada membro pode acessar. Atribua um perfil a cada membro abaixo.
            </p>

            {perfis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 20px', border: '1px dashed var(--color-border)', borderRadius: '10px', color: 'var(--color-text-muted)' }}>
                <Shield size={24} style={{ marginBottom: '8px', opacity: 0.35 }} />
                <p style={{ fontWeight: 600, fontSize: '13px' }}>Nenhum perfil cadastrado</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Crie perfis como "Recepcionista" ou "Profissional" e defina o que cada um pode acessar.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {perfis.map(p => {
                  const membrosNoPerfil = equipe.filter(m => m.perfilId === p.id).length;
                  const tabsVisiveis = Object.values(p.permissoes).filter(t => t.ver).length;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: '#fafafa' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Shield size={15} style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{p.nome}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {tabsVisiveis} módulo{tabsVisiveis !== 1 ? 's' : ''} visível{tabsVisiveis !== 1 ? 'is' : ''}
                          {membrosNoPerfil > 0 && ` · ${membrosNoPerfil} membro${membrosNoPerfil !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => { setEditingPerfil(p); setShowPerfilModal(true); }}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px' }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeletePerfil(p.id)}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', borderColor: '#fca5a5', color: '#ef4444' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção: Membros da Equipe */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Membros da Equipe</h3>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>({equipe.length} membros)</span>
              </div>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => openMembroModal()}>
                <Plus size={14} />Adicionar Membro
              </button>
            </div>

            <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#f8f8f6', borderRadius: '8px', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <Shield size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Membros cadastrados aqui devem criar a própria conta no Lumina usando o e-mail registrado. Atribua um Perfil de Acesso para controlar o que cada um pode ver e fazer.
            </div>

            {equipe.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-muted)' }}>
                <Users size={28} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p style={{ fontWeight: 600 }}>Nenhum membro cadastrado</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Adicione os membros da sua equipe para controle de acesso e atribuição de cargos.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {equipe.map(m => {
                  const perfilDoMembro = perfis.find(p => p.id === m.perfilId);
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', background: '#fafafa' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.nome}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', flexShrink: 0 }}>
                        {m.cargo}
                      </span>
                      {perfilDoMembro ? (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: '#e8f5e9', color: '#2e7d32', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Shield size={10} />{perfilDoMembro.nome}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: '#fff3e0', color: '#e65100', flexShrink: 0 }}>
                          Sem perfil
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => openMembroModal(m)} className="btn btn-outline" style={{ padding: '4px 8px' }}><Edit2 size={12} /></button>
                        <button onClick={() => handleDeleteMembro(m.id)} className="btn btn-outline" style={{ padding: '4px 8px', borderColor: '#fca5a5', color: '#ef4444' }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  );
                })}
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

      {/* ── TAB: HORÁRIO DE ATENDIMENTO ── */}
      {tab === 'horarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Clock size={16} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Horário de Atendimento</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: horario ? 'var(--color-primary-light)' : '#f8f8f6', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-main)' }}>Horário personalizado por dia</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {horario ? 'A agenda e o link público respeitam o período definido abaixo' : 'Desativado — a clínica atende 24 horas, todos os dias'}
                </div>
              </div>
              <button
                onClick={handleToggleHorarioPersonalizado}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: horario ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
              >
                {horario ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
              </button>
            </div>

            {horario && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {DIAS_HORARIO.map(d => {
                  const dia = horario[d.key];
                  return (
                    <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: '8px', background: dia.fechado ? '#f8f8f6' : 'transparent' }}>
                      <div style={{ width: 120, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>{d.label}</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)', cursor: 'pointer', width: 80 }}>
                        <input
                          type="checkbox"
                          checked={!dia.fechado}
                          onChange={e => handleChangeDia(d.key, { fechado: !e.target.checked })}
                        />
                        Aberto
                      </label>
                      {!dia.fechado && (
                        <>
                          <input
                            type="time"
                            className="form-input"
                            value={dia.abre}
                            onChange={e => handleChangeDia(d.key, { abre: e.target.value })}
                            style={{ width: '110px' }}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>até</span>
                          <input
                            type="time"
                            className="form-input"
                            value={dia.fecha}
                            onChange={e => handleChangeDia(d.key, { fecha: e.target.value })}
                            style={{ width: '110px' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleCopiarParaTodos(d.key)}
                            className="btn btn-outline"
                            style={{ fontSize: '11px', padding: '4px 10px', marginLeft: 'auto' }}
                            title="Aplicar este horário a todos os dias"
                          >
                            Copiar p/ todos
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveHorario}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', justifyContent: 'center' }}
                disabled={savingHorario}
              >
                {horarioOk ? <><Check size={16} />Salvo!</> : savingHorario ? 'Salvando...' : <><Check size={16} />Salvar Horário</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CONFIRMAÇÕES AUTOMÁTICAS ── */}
      {tab === 'confirmacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Em breve */}
          <div className="card" style={{ padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={28} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '4px 10px', borderRadius: '999px', marginBottom: '12px' }}>
                Em breve
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Confirmações Automáticas</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '480px', margin: '0 auto' }}>
                Estamos preparando esta nova funcionalidade para automatizar o envio de lembretes via WhatsApp/SMS e reduzir o trabalho manual de confirmação de consultas. Fique de olho nas próximas atualizações!
              </p>
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
              <div className="form-group">
                <label className="form-label">Perfil de Acesso</label>
                <select
                  className="form-select"
                  value={mPerfilId ?? ''}
                  onChange={e => setMPerfilId(e.target.value || null)}
                >
                  <option value="">Sem perfil (acesso padrão)</option>
                  {perfis.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                {perfis.length === 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Crie perfis de acesso na seção acima para poder atribuí-los.
                  </p>
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

      {showPerfilModal && (
        <PerfilAcessoModal
          perfil={editingPerfil}
          onSave={handleSavePerfilAcesso}
          onClose={() => { setShowPerfilModal(false); setEditingPerfil(null); }}
        />
      )}

      {/* ── TAB: REDE DE CLÍNICAS (temporariamente desabilitada) ── */}
      {tab === 'rede' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Em breve */}
          <div className="card" style={{ padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Network size={28} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '4px 10px', borderRadius: '999px', marginBottom: '12px' }}>
                Em breve
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Rede de Clínicas</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '480px', margin: '0 auto' }}>
                Estamos aprimorando esta funcionalidade para tornar a gestão de múltiplas unidades ainda mais completa. Fique de olho nas próximas atualizações!
              </p>
            </div>
          </div>
        </div>
      )}
      {false && (
        <RedeClinicas userId={userId} onRedeUpdated={onRedeUpdated} />
      )}
    </div>
  );
};
