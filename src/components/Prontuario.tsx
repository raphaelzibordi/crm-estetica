import React, { useState, useEffect, useMemo } from 'react';
import type { Agendamento, Cliente, EvolucaoClinica, GaleriaItem, Procedimento, Profissional } from '../types';
import { FileText, Camera, Plus, Trash2, Edit2, User, CalendarPlus, UserPlus, AlertTriangle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { HistoricoPresenca } from './HistoricoPresenca';
import { AnamneseDigital } from './AnamneseDigital';
import { AssinaturaDigital } from './AssinaturaDigital';

const OWNER_ID = '__owner__';

function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

interface ProntuarioProps {
  selectedClienteId: string | null;
  userId: string;
  onClose?: () => void;
  onAddAgendamento?: (agendamento: Omit<Agendamento, 'id'>, extra?: { telefone?: string }) => Promise<void>;
  userName?: string;
}

export const Prontuario: React.FC<ProntuarioProps> = ({ selectedClienteId, userId, onAddAgendamento, userName }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [activeClienteId, setActiveClienteId] = useState<string>(selectedClienteId || '');
  const [evolucoes, setEvolucoes] = useState<EvolucaoClinica[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  
  // States for adding a new clinical evolution
  const [newEvolucaoText, setNewEvolucaoText] = useState('');
  const [newEvolucaoProc, setNewEvolucaoProc] = useState('');
  const [newEvolucaoObs, setNewEvolucaoObs] = useState('');
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);

  // States for patient details editing
  const [isEditing, setIsEditing] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editNasc, setEditNasc] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editFotoFile, setEditFotoFile] = useState<string>('');
  const profileFileInputRef = React.useRef<HTMLInputElement>(null);

  // States for quick-schedule modal
  const [showAgendarModal, setShowAgendarModal] = useState(false);
  const [showAgendarConfirm, setShowAgendarConfirm] = useState(false);
  const [agendarData, setAgendarData] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [agendarHora, setAgendarHora] = useState('14:30');
  const [agendarProcedimento, setAgendarProcedimento] = useState('');
  const [agendarProfissionalId, setAgendarProfissionalId] = useState<string>(OWNER_ID);
  const [equipe, setEquipe] = useState<Array<{ id: string; nome: string; cargo: string }>>([]);

  // States for global Acolher modal (fresh patient, no pre-fill)
  const [showAcolherModal, setShowAcolherModal] = useState(false);
  const [acolherNome, setAcolherNome] = useState('');
  const [acolherTelefone, setAcolherTelefone] = useState('');
  const [acolherProcedimento, setAcolherProcedimento] = useState('');
  const [acolherData, setAcolherData] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [acolherHora, setAcolherHora] = useState('14:30');
  const [acolherProfissionalId, setAcolherProfissionalId] = useState<string>(OWNER_ID);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  // Ref for consultation carousel scroll navigation
  const carouselRef = React.useRef<HTMLDivElement>(null);
  // Appointments linked to the active client (fetched on client change)
  const [agendamentosCliente, setAgendamentosCliente] = useState<Agendamento[]>([]);

  // States for image gallery uploader (US-024: antes/depois)
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRefDepois = React.useRef<HTMLInputElement>(null);
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [photoFileDepois, setPhotoFileDepois] = useState<string>('');
  const [fileNameDepois, setFileNameDepois] = useState('');
  const [photoDesc, setPhotoDesc] = useState('');
  const [galeriaItems, setGaleriaItems] = useState<GaleriaItem[]>([]);
  const [lightboxPair, setLightboxPair] = useState<{ antes: string; depois?: string; descricao: string } | null>(null);

  useEffect(() => {
    loadClientes();
    loadProcedimentos();
    api.getEquipe(userId, { somenteAtivos: true })
      .then(members => setEquipe(members.map(m => ({ id: m.id, nome: m.nome, cargo: m.cargo }))))
      .catch(() => {});
  }, [userId]);

  const loadProcedimentos = async () => {
    try {
      await api.ensureSeedData(userId).catch(() => {});
      const data = await api.getProcedimentos(userId);
      setProcedimentos(data);
      if (data.length > 0) {
        setNewEvolucaoProc((curr) => curr || data[0].nome);
      }
    } catch (err) {
      console.error('Erro ao carregar procedimentos:', err);
    }
  };

  const profissionais = useMemo<Profissional[]>(() => {
    const responsavel: Profissional = {
      id: OWNER_ID,
      nome: userName || 'Responsável da Clínica',
      cargo: 'Responsável',
      isResponsavel: true,
    };
    return [responsavel, ...equipe.map(m => ({ id: m.id, nome: m.nome, cargo: m.cargo || 'Profissional', isResponsavel: false }))];
  }, [equipe, userName]);

  // Past: clinical evolutions + finalized appointments (deduped),
  // sorted newest-first. Finalized agendamentos must appear here so the
  // patient's history reflects what was actually completed and billed.
  const pastConsultas = useMemo(() => {
    const evolucaoKeys = new Set(
      evolucoes.map((e) => `${e.data}|${e.procedimento.trim().toLocaleLowerCase('pt-BR')}`),
    );
    const fromEvolucoes = evolucoes.map((e) => ({
      id: e.id,
      data: e.data,
      profissional: e.profissional,
      procedimento: e.procedimento,
    }));
    const fromFinalizadas = agendamentosCliente
      .filter(
        (a) =>
          a.status === 'finalizada' &&
          !evolucaoKeys.has(`${a.data}|${a.procedimento.trim().toLocaleLowerCase('pt-BR')}`),
      )
      .map((a) => ({
        id: a.id,
        data: a.data,
        profissional: a.profissional,
        procedimento: a.procedimento,
      }));
    return [...fromEvolucoes, ...fromFinalizadas].sort((a, b) => b.data.localeCompare(a.data));
  }, [evolucoes, agendamentosCliente]);

  // Future: linked appointments ≥ today, sorted chronologically
  const futureConsultas = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return agendamentosCliente
      .filter((a) => a.data >= today && a.status !== 'finalizada')
      .sort((a, b) => {
        const d = a.data.localeCompare(b.data);
        return d !== 0 ? d : a.horaInicio.localeCompare(b.horaInicio);
      });
  }, [agendamentosCliente]);

  useEffect(() => {
    if (procedimentos.length > 0) {
      if (!agendarProcedimento) setAgendarProcedimento(procedimentos[0].nome);
      if (!acolherProcedimento) setAcolherProcedimento(procedimentos[0].nome);
    }
  }, [procedimentos, agendarProcedimento, acolherProcedimento]);

  useEffect(() => {
    if (profissionais.length > 0) {
      const stillExists = profissionais.some(p => p.id === agendarProfissionalId);
      if (!stillExists) setAgendarProfissionalId(profissionais[0].id);
    }
  }, [profissionais, agendarProfissionalId]);

  const currentCliente = clientes.find(c => c.id === activeClienteId);

  useEffect(() => {
    if (currentCliente) {
      let formattedNasc = '';
      if (currentCliente.dataNascimento) {
        const parts = currentCliente.dataNascimento.split('-');
        if (parts.length === 3) {
          formattedNasc = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      setEditNome(currentCliente.nome || '');
      setEditNasc(formattedNasc);
      setEditTelefone(currentCliente.telefone || '');
      setEditEmail(currentCliente.email || '');
      setEditFotoFile('');
      setIsEditing(false);
    }
  }, [currentCliente]);

  const handleProfileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setEditFotoFile(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeClienteId) {
        setGaleriaItems([]);
        return;
      }
      try {
        const data = await api.getGaleria(userId, activeClienteId);
        if (!cancelled) setGaleriaItems(data);
      } catch (err) {
        console.error('Erro ao carregar galeria:', err);
        if (!cancelled) setGaleriaItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeClienteId, userId]);

  // Fetch future appointments for the active client (used by the consultation carousel)
  useEffect(() => {
    let cancelled = false;
    const cliente = clientes.find((c) => c.id === activeClienteId);
    if (!activeClienteId || !cliente) {
      setAgendamentosCliente([]);
      return;
    }
    // Span ±1 year so the carousel can show finalized past consultations too.
    const pastLimit = new Date();
    pastLimit.setFullYear(pastLimit.getFullYear() - 1);
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 1);
    api
      .getAgendamentosRange(
        userId,
        pastLimit.toISOString().split('T')[0],
        futureLimit.toISOString().split('T')[0],
      )
      .then((data) => {
        if (cancelled) return;
        const nomeLower = cliente.nome.trim().toLocaleLowerCase('pt-BR');
        setAgendamentosCliente(
          data.filter(
            (a) =>
              a.clienteId === activeClienteId ||
              (a.clienteNome || '').trim().toLocaleLowerCase('pt-BR') === nomeLower,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setAgendamentosCliente([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClienteId, userId, clientes]);

  const formatDataNascimento = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    const truncated = numbersOnly.slice(0, 8);
    if (truncated.length <= 2) {
      return truncated;
    } else if (truncated.length <= 4) {
      return `${truncated.slice(0, 2)}/${truncated.slice(2)}`;
    } else {
      return `${truncated.slice(0, 2)}/${truncated.slice(2, 4)}/${truncated.slice(4)}`;
    }
  };

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

  const scrollCarousel = (dir: 'left' | 'right') => {
    carouselRef.current?.scrollBy({ left: dir === 'right' ? 240 : -240, behavior: 'smooth' });
  };

  const handleAgendarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCliente || !onAddAgendamento) return;
    setShowAgendarModal(false);
    setShowAgendarConfirm(true);
  };

  const handleAgendarConfirm = async () => {
    if (!currentCliente || !onAddAgendamento) return;
    const proc = procedimentos.find(p => p.nome === agendarProcedimento);
    const duracao = proc?.duracaoMinutos ?? 60;
    const profSelecionado = profissionais.find(p => p.id === agendarProfissionalId);
    try {
      await onAddAgendamento(
        {
          clienteId: currentCliente.id,
          clienteNome: currentCliente.nome,
          data: agendarData,
          horaInicio: agendarHora,
          horaFim: addMinutesToTime(agendarHora, duracao),
          profissional: profSelecionado?.nome ?? userName ?? 'Responsável da Clínica',
          sala: proc?.salaRequerida || 'Cabine 01 - Clínica',
          procedimento: agendarProcedimento,
          status: 'agendada',
          valor: proc?.preco ?? 0,
        },
        { telefone: currentCliente.telefone || undefined }
      );
      setShowAgendarConfirm(false);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'AGENDAMENTO_CONFLITO') {
        setShowAgendarConfirm(false);
        setConflictMessage(e.message ?? 'Conflito de horário detectado.');
      }
    }
  };

  const handleAcolherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddAgendamento || !acolherNome.trim()) return;

    const rawTelefone = acolherTelefone.replace(/\D/g, '');
    if (rawTelefone && rawTelefone.length < 10) {
      alert('Por favor, informe um telefone de contato válido com DDD (mínimo 10 dígitos).');
      return;
    }

    const proc = procedimentos.find((p) => p.nome === acolherProcedimento);
    const duracao = proc?.duracaoMinutos ?? 60;
    const profSelecionado = profissionais.find((p) => p.id === acolherProfissionalId);

    try {
      await onAddAgendamento(
        {
          clienteId: 'c_' + Math.random().toString(36).slice(2, 10),
          clienteNome: acolherNome.trim(),
          data: acolherData,
          horaInicio: acolherHora,
          horaFim: addMinutesToTime(acolherHora, duracao),
          profissional: profSelecionado?.nome ?? userName ?? 'Responsável da Clínica',
          sala: proc?.salaRequerida || 'Cabine 01 - Clínica',
          procedimento: acolherProcedimento,
          status: 'agendada',
          valor: proc?.preco ?? 0,
        },
        { telefone: acolherTelefone.trim() || undefined }
      );
      setAcolherNome('');
      setAcolherTelefone('');
      setShowAcolherModal(false);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'AGENDAMENTO_CONFLITO') {
        setConflictMessage(e.message ?? 'Conflito de horário detectado.');
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!activeClienteId || !currentCliente) return;

    let dbDataNascimento = '';
    if (editNasc) {
      const parts = editNasc.split('/');
      if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
        alert('Por favor, informe a data de nascimento no formato DD/MM/AAAA.');
        return;
      }
      dbDataNascimento = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const rawTelefone = editTelefone.replace(/\D/g, '');
    if (rawTelefone && rawTelefone.length < 10) {
      alert('Por favor, informe um telefone de contato válido com DDD (mínimo 10 dígitos).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (editEmail && !emailRegex.test(editEmail)) {
      alert('Por favor, insira um e-mail válido.');
      return;
    }

    try {
      const payload: Partial<Cliente> = {
        nome: editNome,
        dataNascimento: dbDataNascimento || '',
        telefone: editTelefone,
        email: editEmail
      };
      if (editFotoFile) {
        payload.fotoUrl = editFotoFile;
      }

      const updated = await api.updateCliente(activeClienteId, payload, userId);

      // Update local state
      setClientes(prev => prev.map(c => c.id === activeClienteId ? updated : c));
      setIsEditing(false);
      alert('Cadastro da cliente atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar cadastro da cliente.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') setPhotoFile(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChangeDepois = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileNameDepois(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') setPhotoFileDepois(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhotos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile || !activeClienteId) {
      alert('Por favor, selecione ao menos a foto "Antes".');
      return;
    }

    try {
      const created = await api.createGaleriaItem(
        activeClienteId,
        {
          imagem: photoFile,
          imagemDepois: photoFileDepois || undefined,
          data: new Date().toISOString().split('T')[0],
          descricao: photoDesc.trim() || 'Sem descrição.',
        },
        userId
      );

      setGaleriaItems((prev) => [created, ...prev]);
      setPhotoFile('');
      setFileName('');
      setPhotoFileDepois('');
      setFileNameDepois('');
      setPhotoDesc('');
      setShowAddPhoto(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar imagem de evolução.');
    }
  };

  const handleDeletePhoto = async (itemId: string) => {
    if (!confirm('Deseja realmente remover esta foto de evolução?')) return;

    try {
      await api.deleteGaleriaItem(itemId, userId);
      setGaleriaItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error(err);
      alert('Erro ao remover foto de evolução.');
    }
  };

  const handleDeleteCliente = async () => {
    if (!activeClienteId || !currentCliente) return;
    if (!confirm(`Deseja realmente excluir a paciente ${currentCliente.nome}? Esta ação não pode ser desfeita.`)) return;

    try {
      await api.deleteCliente(activeClienteId, userId);
      setClientes(prev => prev.filter(c => c.id !== activeClienteId));
      setActiveClienteId('');
      alert('Paciente excluída com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir paciente.');
    }
  };

  useEffect(() => {
    if (activeClienteId) {
      loadEvolucoes(activeClienteId);
    }
  }, [activeClienteId, userId]);

  const loadClientes = async () => {
    try {
      const data = await api.getClientes(userId);
      setClientes(data);
      if (data.length > 0 && !activeClienteId) {
        setActiveClienteId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClientes(false);
    }
  };

  const loadEvolucoes = async (clienteId: string) => {
    try {
      const data = await api.getEvolucoes(userId, clienteId);
      setEvolucoes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const currentProntuario: { clienteId: string | null; evolucoes: EvolucaoClinica[]; galeria: GaleriaItem[] } = { clienteId: activeClienteId, evolucoes, galeria: [] };

  const handleAddEvolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvolucaoText.trim() || !activeClienteId) return;

    try {
      await api.createEvolucao(activeClienteId, {
        data: new Date().toISOString().split('T')[0],
        profissional: 'Profissional Logado', // could fetch from session
        procedimento: newEvolucaoProc,
        relatoNatural: newEvolucaoText,
        observacoesTecnicas: newEvolucaoObs || 'Sem intercorrências técnicas.'
      }, userId);

      setNewEvolucaoText('');
      setNewEvolucaoObs('');
      alert('Evolução clínica registrada com sucesso no prontuário.');
      loadEvolucoes(activeClienteId);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar evolução.');
    }
  };

  if (loadingClientes) {
    return <div>Carregando prontuários...</div>;
  }

  if (clientes.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Nenhuma cliente cadastrada no seu perfil ainda. Crie novos agendamentos para registrar clientes.
      </div>
    );
  }

  /**
   * UX Design Decision: Natural Language & Visual Side-by-Side
   * Aesthetic clinical evolutions are often cold and hard to digest.
   * We present clinical timelines as "Histórico de Bem-estar" in rich natural texts, 
   * followed by technical specs (batch number, syringe count) in separate small pills.
   * Photos of before-after are shown side-by-side with discrete borders representing luxury.
   */
  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="prontuario-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
            Prontuário Estético Visual
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Consulte o histórico completo de bem-estar de suas clientes, evoluções clínicas e evoluções de fotos.
          </p>
        </div>
        {onAddAgendamento && (
          <button
            onClick={() => setShowAcolherModal(true)}
            className="btn btn-primary"
          >
            <UserPlus size={16} />
            <span>Acolher nova(o) paciente</span>
          </button>
        )}
      </div>

      <div className="prontuario-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Side: Client Selector */}
        <div className="card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '16px', textTransform: 'uppercase' }}>
            Selecione a Cliente
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clientes.map(cliente => (
              <button
                key={cliente.id}
                onClick={() => {
                  setActiveClienteId(cliente.id);
                  // Sync with active selections if needed
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid ' + (activeClienteId === cliente.id ? 'var(--color-primary)' : 'transparent'),
                  backgroundColor: activeClienteId === cliente.id ? 'var(--color-primary-light)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'var(--transition-smooth)'
                }}
              >
                {cliente.fotoUrl ? (
                  <img 
                    src={cliente.fotoUrl} 
                    alt={cliente.nome} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '32px', height: '32px', minWidth: '32px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                    <User size={16} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>{cliente.nome}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Última visita: {cliente.dataUltimaVisita ? new Date(cliente.dataUltimaVisita).toLocaleDateString('pt-BR') : 'N/A'}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Prontuário Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {currentCliente && (
            <div className="card" style={{ padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  {editFotoFile ? (
                    <img 
                      src={editFotoFile} 
                      alt="Nova foto" 
                      style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                    />
                  ) : currentCliente.fotoUrl ? (
                    <img 
                      src={currentCliente.fotoUrl} 
                      alt={currentCliente.nome} 
                      style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                    />
                  ) : (
                    <div style={{ width: '64px', height: '64px', minWidth: '64px', borderRadius: '50%', backgroundColor: '#f3f4f6', border: '2px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                      <User size={32} />
                    </div>
                  )}
                  {isEditing && (
                    <>
                      <button
                        onClick={() => profileFileInputRef.current?.click()}
                        className="btn btn-outline"
                        style={{ padding: '4px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      >
                        <Camera size={10} />
                        <span>Alterar Foto</span>
                      </button>
                      <input
                        type="file"
                        ref={profileFileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleProfileFileChange}
                      />
                    </>
                  )}
                </div>
                <div style={{ flex: 1, paddingRight: '20px' }}>
                  {!isEditing ? (
                    <div className="prontuario-patient-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '16px' }}>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentCliente.nome}
                        </h2>
                        <div className="prontuario-patient-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                          <span>Nasc: {currentCliente.dataNascimento ? currentCliente.dataNascimento.split('-').reverse().join('/') : 'N/A'}</span>
                          <span>Contato: {currentCliente.telefone || 'N/A'}</span>
                          <span>E-mail: {currentCliente.email || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="prontuario-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                        {onAddAgendamento && (
                          <button
                            onClick={() => setShowAgendarModal(true)}
                            className="btn btn-primary"
                            style={{ padding: '9px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}
                          >
                            <CalendarPlus size={14} />
                            <span>Agendar Consulta</span>
                          </button>
                        )}
                        <div className="prontuario-actions-secondary" style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flex: 1 }}
                          >
                            <Edit2 size={13} />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={handleDeleteCliente}
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flex: 1, borderColor: '#fca5a5', color: '#ef4444' }}
                          >
                            <Trash2 size={13} />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '20px', fontWeight: 600, padding: '4px 8px', margin: 0, width: '100%', maxWidth: '300px' }}
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          placeholder="Nome da paciente"
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>Nasc:</span>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '120px', padding: '6px 10px', fontSize: '12px', borderRadius: '4px' }} 
                              value={editNasc} 
                              onChange={(e) => setEditNasc(formatDataNascimento(e.target.value))} 
                              placeholder="DD/MM/AAAA" 
                            />
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>Contato:</span>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '140px', padding: '6px 10px', fontSize: '12px', borderRadius: '4px' }} 
                              value={editTelefone} 
                              onChange={(e) => setEditTelefone(formatTelefone(e.target.value))} 
                              placeholder="(XX) 9XXXX-XXXX" 
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>E-mail:</span>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '180px', padding: '6px 10px', fontSize: '12px', borderRadius: '4px' }} 
                              value={editEmail} 
                              onChange={(e) => setEditEmail(e.target.value)} 
                              placeholder="exemplo@email.com" 
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => {
                              setIsEditing(false);
                              setEditFotoFile('');
                            }} 
                            className="btn btn-outline" 
                            style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '4px' }}
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={handleSaveProfile} 
                            className="btn btn-primary" 
                            style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '4px' }}
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {(currentCliente.tags || []).map((tag: string) => (
                  <span key={tag} className="badge badge-sage">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Linha do Tempo de Consultas */}
          {currentCliente && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Linha do Tempo de Consultas</h3>
                </div>
                <div className="carousel-nav-arrows" style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => scrollCarousel('left')}
                    className="btn btn-outline"
                    style={{ padding: '6px 10px' }}
                    aria-label="Rolar para a esquerda"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => scrollCarousel('right')}
                    className="btn btn-outline"
                    style={{ padding: '6px 10px' }}
                    aria-label="Rolar para a direita"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div
                ref={carouselRef}
                className="consultas-carousel"
                style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  scrollSnapType: 'x mandatory',
                  paddingBottom: '6px',
                  scrollbarWidth: 'none',
                } as React.CSSProperties}
              >
                {pastConsultas.length === 0 && futureConsultas.length === 0 ? (
                  <div style={{
                    flex: 1, padding: '24px',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 'var(--border-radius-md)',
                    textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)',
                  }}>
                    Nenhuma consulta registrada para esta paciente.
                  </div>
                ) : (
                  <>
                    {/* Past consultation cards (evolucoes, newest first) */}
                    {pastConsultas.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          flexShrink: 0, width: '200px', scrollSnapAlign: 'start',
                          border: '1px solid #CBD5E1',
                          borderLeft: '3px solid #94A3B8',
                          borderRadius: 'var(--border-radius-md)',
                          padding: '14px 16px', backgroundColor: '#F1F5F9',
                          display: 'flex', flexDirection: 'column', gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>
                            {new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span style={{
                            fontSize: '9px', padding: '2px 6px', borderRadius: '20px', flexShrink: 0,
                            background: '#E2E8F0', color: '#475569',
                            fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            Realizada
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: '1.4', maxHeight: '2.8em', overflow: 'hidden' }}>
                          {ev.procedimento}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={10} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.profissional}</span>
                        </div>
                      </div>
                    ))}

                    {/* "Hoje" divider — only when there are past cards */}
                    {pastConsultas.length > 0 && (
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 4px', gap: '4px' }}>
                        <div style={{ width: '1px', height: '44px', background: 'var(--color-border)' }} />
                        <span style={{
                          fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)',
                          background: 'var(--bg-card)', padding: '3px 8px',
                          border: '1px solid var(--color-border)', borderRadius: '20px',
                          whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                          Hoje
                        </span>
                        <div style={{ width: '1px', height: '44px', background: 'var(--color-border)' }} />
                      </div>
                    )}

                    {/* Future appointment cards or empty-state card */}
                    {futureConsultas.length > 0 ? (
                      futureConsultas.map((ag) => (
                        <div
                          key={ag.id}
                          style={{
                            flexShrink: 0, width: '200px', scrollSnapAlign: 'start',
                            border: '1px solid var(--color-border)',
                            borderLeft: '3px solid var(--color-primary)',
                            borderRadius: 'var(--border-radius-md)',
                            padding: '14px 16px', backgroundColor: '#FFFFFF',
                            display: 'flex', flexDirection: 'column', gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                {new Date(ag.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                {ag.horaInicio.substring(0, 5)}
                              </div>
                            </div>
                            <span style={{
                              fontSize: '9px', padding: '2px 6px', borderRadius: '20px', flexShrink: 0,
                              background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                              fontWeight: 600, whiteSpace: 'nowrap',
                            }}>
                              Agendada
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: '1.4', maxHeight: '2.8em', overflow: 'hidden' }}>
                            {ag.procedimento}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={10} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.profissional}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          flexShrink: 0, width: '220px', scrollSnapAlign: 'start',
                          border: '1px dashed var(--color-border)',
                          borderRadius: 'var(--border-radius-md)',
                          padding: '24px 16px', backgroundColor: '#FAFBFB',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          gap: '10px', textAlign: 'center',
                        }}
                      >
                        <CalendarPlus size={22} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                          Nenhuma consulta futura agendada
                        </p>
                        {onAddAgendamento && (
                          <button
                            onClick={() => setShowAgendarModal(true)}
                            className="btn btn-outline"
                            style={{ padding: '6px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <CalendarPlus size={12} />
                            Agendar
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Anamnese Digital (US-023) */}
          {currentCliente && (
            <AnamneseDigital
              clienteId={activeClienteId}
              clienteNome={currentCliente.nome}
              userId={userId}
              procedimentos={procedimentos.map((p) => ({ id: p.id, nome: p.nome }))}
              userName={userName}
            />
          )}

          {/* Assinatura Digital de Documentos (US-025) */}
          {currentCliente && (
            <AssinaturaDigital
              clienteId={activeClienteId}
              clienteNome={currentCliente.nome}
              userId={userId}
              userName={userName}
            />
          )}

          {/* Galeria de Evolução por Imagem */}
          <div className="card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Galeria Antes / Depois</h3>
              </div>
              <button 
                onClick={() => setShowAddPhoto(!showAddPhoto)} 
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                <span>Adicionar Comparação</span>
              </button>
            </div>

            {showAddPhoto && (
              <form onSubmit={handleSavePhotos} className="card" style={{ padding: '20px', border: '1px solid var(--color-border)', backgroundColor: '#FAFBFB', marginBottom: '24px', animation: 'fadeIn 0.3s ease-out' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-main)' }}>Nova Comparação Antes / Depois</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                  {/* Foto Antes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>
                      Foto <strong>Antes</strong> <span style={{ color: 'var(--color-danger, #e53e3e)', fontSize: '11px' }}>*obrigatório</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-outline"
                      style={{ padding: '8px 16px', fontSize: '12px', width: 'fit-content' }}
                    >
                      Escolher Imagem
                    </button>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
                    {fileName && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{fileName}</span>}
                    {photoFile && (
                      <div style={{ position: 'relative', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', border: '2px solid var(--color-primary)', maxWidth: '160px' }}>
                        <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'var(--color-primary)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>ANTES</div>
                        <img src={photoFile} alt="Antes" style={{ width: '160px', height: '140px', objectFit: 'cover', display: 'block' }} />
                      </div>
                    )}
                  </div>

                  {/* Foto Depois */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>
                      Foto <strong>Depois</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>opcional</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRefDepois.current?.click()}
                      className="btn btn-outline"
                      style={{ padding: '8px 16px', fontSize: '12px', width: 'fit-content' }}
                    >
                      Escolher Imagem
                    </button>
                    <input type="file" ref={fileInputRefDepois} style={{ display: 'none' }} accept="image/*" onChange={handleFileChangeDepois} />
                    {fileNameDepois && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{fileNameDepois}</span>}
                    {photoFileDepois && (
                      <div style={{ position: 'relative', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden', border: '2px solid #38a169', maxWidth: '160px' }}>
                        <div style={{ position: 'absolute', top: '6px', left: '6px', background: '#38a169', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>DEPOIS</div>
                        <img src={photoFileDepois} alt="Depois" style={{ width: '160px', height: '140px', objectFit: 'cover', display: 'block' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>Descrição / Procedimento</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Pós-procedimento imediato de Botox"
                    value={photoDesc}
                    onChange={(e) => setPhotoDesc(e.target.value)}
                    style={{ fontSize: '12px', padding: '8px 12px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPhoto(false);
                      setPhotoFile(''); setFileName('');
                      setPhotoFileDepois(''); setFileNameDepois('');
                      setPhotoDesc('');
                    }}
                    className="btn btn-outline"
                    style={{ padding: '6px 14px', fontSize: '11px' }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '11px' }}>
                    Salvar Comparação
                  </button>
                </div>
              </form>
            )}

            {galeriaItems.length === 0 ? (
              <div style={{
                padding: '40px',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'center',
                color: 'var(--color-text-muted)'
              }}>
                Nenhuma foto registrada para esta cliente ainda. Adicione a primeira comparação antes/depois.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {galeriaItems.map((gal) => (
                  <div key={gal.id} className="card" style={{ padding: '12px', border: '1px solid var(--color-border)', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Imagens lado a lado */}
                    <div
                      style={{ display: 'grid', gridTemplateColumns: gal.imagemDepois ? '1fr 1fr' : '1fr', gap: '6px', cursor: 'pointer' }}
                      onClick={() => setLightboxPair({ antes: gal.imagem, depois: gal.imagemDepois, descricao: gal.descricao })}
                    >
                      {/* ANTES */}
                      <div style={{ position: 'relative', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'var(--color-primary)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>ANTES</div>
                        <img src={gal.imagem} alt="Antes" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                      </div>
                      {/* DEPOIS */}
                      {gal.imagemDepois && (
                        <div style={{ position: 'relative', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: '6px', left: '6px', background: '#38a169', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>DEPOIS</div>
                          <img src={gal.imagemDepois} alt="Depois" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                        </div>
                      )}
                    </div>

                    {/* Rodapé do card */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {gal.descricao}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {gal.data ? gal.data.split('-').reverse().join('/') : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeletePhoto(gal.id)}
                        style={{
                          background: 'transparent',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Remover"
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#e53e3e'; e.currentTarget.style.borderColor = '#e53e3e'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico de Presença e Comparecimentos */}
          {currentCliente && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Histórico de Presença</h3>
              </div>
              <HistoricoPresenca clienteId={currentCliente.id} userId={userId} />
            </div>
          )}

          {/* Histórico e Nova Evolução */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>

            {/* Timeline of Evolutions */}
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Histórico de Bem-Estar</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                {currentProntuario.evolucoes.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Sem evoluções registradas.</p>
                ) : (
                  currentProntuario.evolucoes.map((ev, idx) => (
                    <div key={ev.id} style={{ 
                      position: 'relative', 
                      paddingLeft: '24px', 
                      borderLeft: '2px solid var(--color-primary-light)',
                      paddingBottom: idx === currentProntuario.evolucoes.length - 1 ? '0' : '16px'
                    }}>
                      {/* Timeline circle indicator */}
                      <div style={{
                        position: 'absolute',
                        left: '-6px',
                        top: '4px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary)',
                        border: '2px solid #FFFFFF'
                      }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                          {new Date(ev.data).toLocaleDateString('pt-BR')}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {ev.profissional}
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                        {ev.procedimento}
                      </div>

                      <p style={{ fontSize: '13px', color: 'var(--color-text-main)', lineHeight: '1.5', marginBottom: '8px' }}>
                        {ev.relatoNatural}
                      </p>

                      <div style={{ 
                        fontSize: '11px', 
                        backgroundColor: '#F8F9F8', 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        color: 'var(--color-text-muted)', 
                        border: '1px solid #ECECEC' 
                      }}>
                        <strong>Anotação Técnica:</strong> {ev.observacoesTecnicas}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Form for New Evolution */}
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <Plus size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Nova Evolução Clínica</h3>
              </div>

              <form onSubmit={handleAddEvolucao}>
                <div className="form-group">
                  <label className="form-label">Procedimento Realizado</label>
                  <select
                    className="form-select"
                    value={newEvolucaoProc}
                    onChange={(e) => setNewEvolucaoProc(e.target.value)}
                  >
                    {procedimentos.length === 0 ? (
                      <option value="">Cadastre procedimentos primeiro</option>
                    ) : (
                      procedimentos.map((p) => (
                        <option key={p.id} value={p.nome}>{p.nome}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Relato da Paciente (Texto Natural e Acolhedor)</label>
                  <textarea 
                    rows={4}
                    className="form-textarea"
                    placeholder="Ex: Cliente adorou o resultado inicial. Apresentou leve rubor na bochecha, pele iluminada de imediato."
                    value={newEvolucaoText}
                    onChange={(e) => setNewEvolucaoText(e.target.value)}
                    style={{ resize: 'none' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parâmetros e Lotes (Dados Técnicos)</label>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="Ex: Restylane Refyne 0.5ml. Lote H9031."
                    value={newEvolucaoObs}
                    onChange={(e) => setNewEvolucaoObs(e.target.value)}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  Registrar no Prontuário
                </button>
              </form>
            </div>

          </div>

        </div>

      </div>

      {/* Global Acolher modal — fresh patient, no pre-fill */}
      {showAcolherModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => setShowAcolherModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '440px', width: '92%', padding: '32px' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '20px' }}>Acolher Paciente</h3>
            <form onSubmit={handleAcolherSubmit}>
              <div className="form-group">
                <label className="form-label">Nome da Paciente</label>
                <input
                  type="text"
                  className="form-input"
                  value={acolherNome}
                  onChange={e => setAcolherNome(e.target.value)}
                  placeholder="Ex: Amanda Santos"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  type="text"
                  className="form-input"
                  value={acolherTelefone}
                  onChange={e => setAcolherTelefone(formatTelefone(e.target.value))}
                  placeholder="(XX) 9XXXX-XXXX"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Procedimento</label>
                <select
                  className="form-select"
                  value={acolherProcedimento}
                  onChange={e => setAcolherProcedimento(e.target.value)}
                >
                  {procedimentos.length === 0 ? (
                    <option value="">Cadastre procedimentos primeiro</option>
                  ) : (
                    procedimentos.map(p => (
                      <option key={p.id} value={p.nome}>{p.nome} — R$ {p.preco.toLocaleString('pt-BR')}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Profissional Responsável</label>
                {profissionais.length === 1 ? (
                  <input type="text" className="form-input" value={`${profissionais[0].nome} (${profissionais[0].cargo})`} readOnly />
                ) : (
                  <select
                    className="form-select"
                    value={acolherProfissionalId}
                    onChange={e => setAcolherProfissionalId(e.target.value)}
                  >
                    {profissionais.map(p => (
                      <option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Data</label>
                  <input type="date" className="form-input" value={acolherData} onChange={e => setAcolherData(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Horário de Início</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={acolherHora.split(':')[0]}
                      onChange={e => setAcolherHora(`${e.target.value}:${acolherHora.split(':')[1] || '00'}`)}
                    >
                      {Array.from({ length: 15 }, (_, i) => i + 8).map(h => {
                        const hr = String(h).padStart(2, '0');
                        return <option key={hr} value={hr}>{hr}h</option>;
                      })}
                    </select>
                    <span style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--color-text-main)' }}>:</span>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={acolherHora.split(':')[1] || '00'}
                      onChange={e => setAcolherHora(`${acolherHora.split(':')[0] || '08'}:${e.target.value}`)}
                    >
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                        <option key={m} value={m}>{m}m</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAcolherModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!acolherProcedimento}>
                  <UserPlus size={15} />
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conflict error modal */}
      {conflictMessage && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}
        >
          <div className="card" style={{ maxWidth: '420px', width: '92%', padding: '32px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertTriangle size={40} style={{ color: '#f59e0b' }} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-main)' }}>
              Conflito de Horário
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              {conflictMessage}
            </p>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setConflictMessage(null)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Quick-schedule modal */}
      {showAgendarModal && currentCliente && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => setShowAgendarModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '440px', width: '92%', padding: '32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <CalendarPlus size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Agendar Consulta</h3>
            </div>

            {/* Patient badge — locked, pre-filled */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-primary-light)', border: '1px solid var(--color-border-hover)', borderRadius: 'var(--border-radius-md)', padding: '10px 14px', marginBottom: '20px' }}>
              {currentCliente.fotoUrl ? (
                <img src={currentCliente.fotoUrl} alt={currentCliente.nome} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8e6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                  <User size={16} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentCliente.nome}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Paciente selecionada</div>
              </div>
            </div>

            <form onSubmit={handleAgendarSubmit}>
              <div className="form-group">
                <label className="form-label">Procedimento</label>
                <select className="form-select" value={agendarProcedimento} onChange={e => setAgendarProcedimento(e.target.value)}>
                  {procedimentos.length === 0 ? (
                    <option value="">Cadastre procedimentos primeiro</option>
                  ) : (
                    procedimentos.map(p => (
                      <option key={p.id} value={p.nome}>{p.nome} — R$ {p.preco.toLocaleString('pt-BR')}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Profissional Responsável</label>
                {profissionais.length === 1 ? (
                  <input type="text" className="form-input" value={`${profissionais[0].nome} (${profissionais[0].cargo})`} readOnly />
                ) : (
                  <select className="form-select" value={agendarProfissionalId} onChange={e => setAgendarProfissionalId(e.target.value)}>
                    {profissionais.map(p => (
                      <option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Data</label>
                  <input type="date" className="form-input" value={agendarData} onChange={e => setAgendarData(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Horário de Início</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={agendarHora.split(':')[0]}
                      onChange={e => setAgendarHora(`${e.target.value}:${agendarHora.split(':')[1] || '00'}`)}
                    >
                      {Array.from({ length: 15 }, (_, i) => i + 8).map(h => {
                        const hr = String(h).padStart(2, '0');
                        return <option key={hr} value={hr}>{hr}h</option>;
                      })}
                    </select>
                    <span style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--color-text-main)' }}>:</span>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={agendarHora.split(':')[1] || '00'}
                      onChange={e => setAgendarHora(`${agendarHora.split(':')[0] || '08'}:${e.target.value}`)}
                    >
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                        <option key={m} value={m}>{m}m</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAgendarModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!agendarProcedimento}>
                  <CalendarPlus size={15} />
                  Revisar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment confirmation modal */}
      {showAgendarConfirm && currentCliente && (() => {
        const proc = procedimentos.find(p => p.nome === agendarProcedimento);
        const duracao = proc?.duracaoMinutos ?? 60;
        const profSelecionado = profissionais.find(p => p.id === agendarProfissionalId);
        const profNome = profSelecionado?.nome ?? userName ?? 'Responsável da Clínica';
        const horaFim = addMinutesToTime(agendarHora, duracao);
        const dataFormatada = agendarData
          ? new Date(agendarData + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : '';
        const row = (label: string, value: string) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', textAlign: 'right' }}>{value}</span>
          </div>
        );
        return (
          <div
            className="modal-overlay"
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s ease-out' }}
          >
            <div className="card" style={{ maxWidth: '440px', width: '92%', padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <CalendarPlus size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Confirmar Agendamento</h3>
              </div>

              {/* Patient badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-primary-light)', border: '1px solid var(--color-border-hover)', borderRadius: 'var(--border-radius-md)', padding: '10px 14px', marginBottom: '20px' }}>
                {currentCliente.fotoUrl ? (
                  <img src={currentCliente.fotoUrl} alt={currentCliente.nome} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8e6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                    <User size={16} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>{currentCliente.nome}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Paciente selecionada</div>
                </div>
              </div>

              {/* Summary rows */}
              <div style={{ marginBottom: '24px' }}>
                {row('Procedimento', agendarProcedimento)}
                {row('Profissional', profNome)}
                {row('Data', dataFormatada)}
                {row('Horário', `${agendarHora} – ${horaFim} (${duracao} min)`)}
                {proc && row('Valor', `R$ ${proc.preco.toLocaleString('pt-BR')}`)}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setShowAgendarConfirm(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => { setShowAgendarConfirm(false); setShowAgendarModal(true); }}
                >
                  Editar
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  onClick={handleAgendarConfirm}
                >
                  <CalendarPlus size={15} />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox Modal — Comparação Antes/Depois */}
      {lightboxPair && (
        <div
          onClick={() => setLightboxPair(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.90)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {lightboxPair.descricao && (
            <div style={{ color: '#fff', fontSize: '13px', marginBottom: '16px', opacity: 0.8, textAlign: 'center' }}>
              {lightboxPair.descricao}
            </div>
          )}
          <div
            style={{ display: 'grid', gridTemplateColumns: lightboxPair.depois ? '1fr 1fr' : '1fr', gap: '16px', maxWidth: '90vw', maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ANTES */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'var(--color-primary)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '4px' }}>ANTES</span>
              <img
                src={lightboxPair.antes}
                alt="Antes"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
              />
            </div>
            {/* DEPOIS */}
            {lightboxPair.depois && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#38a169', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '4px' }}>DEPOIS</span>
                <img
                  src={lightboxPair.depois}
                  alt="Depois"
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                />
              </div>
            )}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '16px' }}>clique em qualquer lugar para fechar</div>
        </div>
      )}
    </div>
  );
};
