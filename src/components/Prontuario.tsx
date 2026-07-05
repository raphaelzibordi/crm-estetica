import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Agendamento, Cliente, EvolucaoClinica, GaleriaItem, GravacaoConsulta, Procedimento, Profissional, PrescricaoTemplate, Unidade, Room } from '../types';
import { FileText, Camera, Plus, Trash2, Edit2, User, CalendarPlus, UserPlus, AlertTriangle, Calendar, ChevronLeft, ChevronRight, LayoutTemplate, Search, ShieldCheck, ShieldAlert, Mic, Square, Sparkles, Trash } from 'lucide-react';
import { api } from '../lib/api';
import { type SalaStatus } from '../lib/agendaConflict';
import { buildProcedimentosAgendados, sumDuracao, sumValor, joinNomes } from '../lib/procedimentoUtils';
import ProcedimentoMultiSelect from './ProcedimentoMultiSelect';
import { criarMotorTranscricao } from '../lib/ia';
import { escapeHtml } from '../lib/escapeHtml';
import { HistoricoPresenca } from './HistoricoPresenca';
import { AnamneseDigital } from './AnamneseDigital';
import { AssinaturaDigital } from './AssinaturaDigital';
import { PlanoTratamento } from './PlanoTratamento';
import { TemplatesPrescricoes } from './TemplatesPrescricoes';
import { ConsentimentoLGPD } from './ConsentimentoLGPD';

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
  unidadeId?: string | null;
  unidades?: Unidade[];
  pacienteCompartilhado?: boolean;
  permissoes?: import('../types').Permissoes | null;
  plano?: string | null;
}

const PRONTUARIO_PLAN_LEVELS: Record<string, number> = { basico: 0, pro: 1, enterprise: 2, vip: 2 };

export const Prontuario: React.FC<ProntuarioProps> = ({ selectedClienteId, userId, onAddAgendamento, userName, unidadeId, unidades, pacienteCompartilhado, permissoes, plano }) => {
  // Unidade a atribuir a novos cadastros: a selecionada no topo, ou — quando
  // "Todas as unidades" está ativo — a única unidade ativa, se houver apenas uma.
  const unidadesAtivas = (unidades ?? []).filter(u => u.ativo);
  const unidadeParaNovoCadastro = unidadeId ?? (unidadesAtivas.length === 1 ? unidadesAtivas[0].id : null);
  const pode = (acao: 'ver' | 'criar' | 'editar' | 'deletar') =>
    !permissoes || !!(permissoes['prontuario']?.[acao]);
  const planLevel = PRONTUARIO_PLAN_LEVELS[plano ?? 'basico'] ?? 0;
  const isPro = planLevel >= 1;
  const isEnterprise = planLevel >= 2;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [activeClienteId, setActiveClienteId] = useState<string>(selectedClienteId || '');
  const [evolucoes, setEvolucoes] = useState<EvolucaoClinica[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  
  // States for adding a new clinical evolution
  const [newEvolucaoText, setNewEvolucaoText] = useState('');
  const [newEvolucaoProc, setNewEvolucaoProc] = useState('');
  const [newEvolucaoObs, setNewEvolucaoObs] = useState('');
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [aditandoEvolucaoId, setAditandoEvolucaoId] = useState<string | null>(null);

  // US-021: Assinatura digital de evoluções clínicas (CFM 1.638/2002)
  const [assinandoEvolucao, setAssinandoEvolucao] = useState<EvolucaoClinica | null>(null);
  const [assinaturaSenha, setAssinaturaSenha] = useState('');
  const [assinaturaErro, setAssinaturaErro] = useState<string | null>(null);
  const [assinaturaSalvando, setAssinaturaSalvando] = useState(false);

  // US-028: IA no prontuário — gravação, transcrição e resumo clínico
  const [showConsentimentoGravacao, setShowConsentimentoGravacao] = useState(false);
  const [gravacaoAtual, setGravacaoAtual] = useState<GravacaoConsulta | null>(null);
  const [gravando, setGravando] = useState(false);
  const [transcricaoTexto, setTranscricaoTexto] = useState('');
  const [transcricaoInterim, setTranscricaoInterim] = useState('');
  const [transcricaoErro, setTranscricaoErro] = useState<string | null>(null);
  const [transcricaoIndisponivel, setTranscricaoIndisponivel] = useState(false);
  const [processandoTranscricao, setProcessandoTranscricao] = useState(false);
  const [revisaoEstrutura, setRevisaoEstrutura] = useState<{
    procedimento: string; queixa: string; historico: string; exame: string; conduta: string; prescricao: string; cid10: string[];
  } | null>(null);
  const [aprovandoGravacao, setAprovandoGravacao] = useState(false);
  const [gerandoResumoIA, setGerandoResumoIA] = useState(false);
  const motorTranscricaoRef = React.useRef<ReturnType<typeof criarMotorTranscricao> | null>(null);

  // States for patient details editing
  const [isEditing, setIsEditing] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editNasc, setEditNasc] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editCep, setEditCep] = useState('');
  const [editEndereco, setEditEndereco] = useState('');
  const [editFotoFile, setEditFotoFile] = useState<string>('');
  const profileFileInputRef = React.useRef<HTMLInputElement>(null);

  // States for quick-schedule modal
  const [showAgendarModal, setShowAgendarModal] = useState(false);
  const [showAgendarConfirm, setShowAgendarConfirm] = useState(false);
  const [agendarData, setAgendarData] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [agendarHora, setAgendarHora] = useState('14:30');
  const [agendarProcedimentoIds, setAgendarProcedimentoIds] = useState<string[]>([]);
  const [agendarPlanoTratamentoId, setAgendarPlanoTratamentoId] = useState<string | null>(null);
  const [agendarPlanoProcedimentoNome, setAgendarPlanoProcedimentoNome] = useState<string | null>(null);
  const [agendarSala, setAgendarSala] = useState('');
  const [agendarSalaOptions, setAgendarSalaOptions] = useState<SalaStatus[]>([]);
  const [agendarProfissionalId, setAgendarProfissionalId] = useState<string>(OWNER_ID);
  const [equipe, setEquipe] = useState<Array<{ id: string; nome: string; cargo: string }>>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // States for global Acolher modal (fresh patient, no pre-fill)
  const [showAcolherModal, setShowAcolherModal] = useState(false);
  const [acolherNome, setAcolherNome] = useState('');
  const [acolherTelefone, setAcolherTelefone] = useState('');
  const [acolherProcedimentoIds, setAcolherProcedimentoIds] = useState<string[]>([]);
  const [acolherData, setAcolherData] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [acolherHora, setAcolherHora] = useState('14:30');
  const [acolherProfissionalId, setAcolherProfissionalId] = useState<string>(OWNER_ID);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  // States for new patient registration modal (without appointment)
  const [showNovoPacienteModal, setShowNovoPacienteModal] = useState(false);
  const [novoPacienteNome, setNovoPacienteNome] = useState('');
  const [novoPacienteTelefone, setNovoPacienteTelefone] = useState('');
  const [novoPacienteNasc, setNovoPacienteNasc] = useState('');
  const [novoPacienteEmail, setNovoPacienteEmail] = useState('');
  const [novoPacienteCpf, setNovoPacienteCpf] = useState('');
  const [novoPacienteCep, setNovoPacienteCep] = useState('');
  const [novoPacienteEndereco, setNovoPacienteEndereco] = useState('');
  const [salvandoNovoPaciente, setSalvandoNovoPaciente] = useState(false);

  // States for template picker (US-027)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerList, setTemplatePickerList] = useState<PrescricaoTemplate[]>([]);
  const [templatePickerSearch, setTemplatePickerSearch] = useState('');
  const [templatePickerCat, setTemplatePickerCat] = useState('');
  const [loadingTemplatePicker, setLoadingTemplatePicker] = useState(false);
  const [templatesForceExpand, setTemplatesForceExpand] = useState(0);
  const templatesSectionRef = useRef<HTMLDivElement>(null);

  // LGPD: estado de consentimento do paciente ativo
  const [lgpdConsentido, setLgpdConsentido] = useState<boolean | null>(null);
  const [showConsentimento, setShowConsentimento] = useState(false);
  const [ehMenorIdade, setEhMenorIdade] = useState(false);

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
  // CA-06: compartilhamento temporário
  const [shareLink, setShareLink] = useState<{ url: string; expiraEm: string } | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    loadClientes();
    loadProcedimentos();
    api.getEquipe(userId, { somenteAtivos: true }, unidadeId ?? undefined)
      .then(members => setEquipe(members.map(m => ({ id: m.id, nome: m.nome, cargo: m.cargo }))))
      .catch(() => {});
    api.getRooms(userId).then(setRooms).catch(() => {});
  }, [userId, unidadeId]);

  // Sync selectedClienteId prop → state (handles navigation while component is already mounted)
  useEffect(() => {
    setActiveClienteId(selectedClienteId || '');
  }, [selectedClienteId]);

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
      if (agendarProcedimentoIds.length === 0) setAgendarProcedimentoIds([procedimentos[0].id]);
      if (acolherProcedimentoIds.length === 0) setAcolherProcedimentoIds([procedimentos[0].id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedimentos]);

  const agendarItens = useMemo(
    () => buildProcedimentosAgendados(procedimentos, agendarProcedimentoIds),
    [procedimentos, agendarProcedimentoIds]
  );

  useEffect(() => {
    if (!showAgendarModal || !agendarData || !agendarHora || agendarItens.length === 0) {
      setAgendarSalaOptions([]);
      return;
    }
    const proc = procedimentos.find(p => p.id === agendarItens[0].procedimentoId);
    if (!proc) return;
    const duracao = sumDuracao(agendarItens);
    const hFim = addMinutesToTime(agendarHora, duracao);

    api.getSalasDisponiveis(userId, agendarData, agendarHora, hFim).then(statusList => {
      const allSalasNames = proc.salaIds && proc.salaIds.length > 0
        ? new Set(rooms.filter(r => proc.salaIds!.includes(r.id)).map(r => r.name))
        : new Set(rooms.map(r => r.name));

      const options = statusList.filter(s => allSalasNames.has(s.sala));
      setAgendarSalaOptions(options);

      setAgendarSala(curr => {
        if (curr && options.find(o => o.sala === curr)) return curr;
        const suggested =
          options.find(o => o.sala === proc.salaRequerida && o.disponivel) ||
          options.find(o => o.disponivel) ||
          options[0];
        return suggested?.sala ?? proc.salaRequerida ?? '';
      });
    }).catch(() => {});
  }, [showAgendarModal, agendarData, agendarHora, agendarItens, procedimentos, rooms, userId]);

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
      setEditCpf(currentCliente.cpf || '');
      setEditCep(currentCliente.cep || '');
      setEditEndereco(currentCliente.endereco || '');
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

  // LGPD: verifica consentimento e loga acesso ao abrir prontuário
  useEffect(() => {
    if (!activeClienteId) { setLgpdConsentido(null); return; }
    setLgpdConsentido(null);
    setShowConsentimento(false);
    api.getLGPDConsentimentos(activeClienteId, userId)
      .then(consentimentos => {
        const ativo = consentimentos.find(c => c.tipo === 'servico' && c.aceito && !c.revogadoEm);
        setLgpdConsentido(!!ativo);
        if (!ativo) {
          const cliente = clientes.find(c => c.id === activeClienteId);
          if (cliente?.dataNascimento) {
            const nascimento = new Date(cliente.dataNascimento);
            const idade = (Date.now() - nascimento.getTime()) / (365.25 * 24 * 3600 * 1000);
            setEhMenorIdade(idade < 18);
          }
          setShowConsentimento(true);
        } else {
          // Registra acesso para trilha de auditoria (fire-and-forget)
          api.registrarAcessoDados({ clienteId: activeClienteId, tipoDado: 'prontuario' }, userId).catch(() => {});
        }
      })
      .catch(() => setLgpdConsentido(null));
  }, [activeClienteId, userId, clientes]);

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

  const formatCpf = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    const truncated = numbersOnly.slice(0, 11);
    if (truncated.length <= 3) return truncated;
    if (truncated.length <= 6) return `${truncated.slice(0, 3)}.${truncated.slice(3)}`;
    if (truncated.length <= 9) return `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6)}`;
    return `${truncated.slice(0, 3)}.${truncated.slice(3, 6)}.${truncated.slice(6, 9)}-${truncated.slice(9)}`;
  };

  const formatCep = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    const truncated = numbersOnly.slice(0, 8);
    if (truncated.length <= 5) return truncated;
    return `${truncated.slice(0, 5)}-${truncated.slice(5)}`;
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
    const itens = agendarItens;
    const duracao = sumDuracao(itens);
    const proc = procedimentos.find(p => p.id === itens[0]?.procedimentoId);
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
          sala: agendarSala || proc?.salaRequerida || '',
          procedimento: joinNomes(itens),
          procedimentos: itens,
          status: 'agendada',
          valor: sumValor(itens),
          planoTratamentoId: agendarPlanoTratamentoId ?? undefined,
          planoProcedimentoNome: agendarPlanoProcedimentoNome ?? undefined,
        },
        { telefone: currentCliente.telefone || undefined }
      );
      setShowAgendarConfirm(false);
      setAgendarPlanoTratamentoId(null);
      setAgendarPlanoProcedimentoNome(null);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'AGENDAMENTO_CONFLITO') {
        setShowAgendarConfirm(false);
        setConflictMessage(e.message ?? 'Conflito de horário detectado.');
      }
    }
  };

  const handleAgendarComPlano = (plano: import('../types').PlanoTratamento, procedimentoNome?: string) => {
    const nomeProcedimento = (procedimentoNome ?? plano.procedimentos)?.trim() || '';
    setAgendarPlanoTratamentoId(plano.id);
    setAgendarPlanoProcedimentoNome(nomeProcedimento || null);
    if (!nomeProcedimento) {
      setShowAgendarModal(true);
      return;
    }

    // Procura o procedimento que corresponde ao nome informado
    const procEncontrado = procedimentos.find(
      p => p.nome.toLowerCase() === nomeProcedimento.toLowerCase() ||
           p.nome.toLowerCase().includes(nomeProcedimento.toLowerCase()) ||
           nomeProcedimento.toLowerCase().includes(p.nome.toLowerCase())
    );

    if (procEncontrado) {
      setAgendarProcedimentoIds([procEncontrado.id]);
      setAgendarData(new Date().toISOString().split('T')[0]);
      setAgendarHora('14:30');
    }
    setShowAgendarModal(true);
  };

  const handleAcolherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddAgendamento || !acolherNome.trim()) return;

    const rawTelefone = acolherTelefone.replace(/\D/g, '');
    if (rawTelefone && rawTelefone.length < 10) {
      alert('Por favor, informe um telefone de contato válido com DDD (mínimo 10 dígitos).');
      return;
    }

    const itens = buildProcedimentosAgendados(procedimentos, acolherProcedimentoIds);
    const duracao = sumDuracao(itens);
    const proc = procedimentos.find((p) => p.id === itens[0]?.procedimentoId);
    const profSelecionado = profissionais.find((p) => p.id === acolherProfissionalId);

    try {
      await onAddAgendamento(
        {
          clienteId: 'c_' + crypto.randomUUID().slice(0, 8),
          clienteNome: acolherNome.trim(),
          data: acolherData,
          horaInicio: acolherHora,
          horaFim: addMinutesToTime(acolherHora, duracao),
          profissional: profSelecionado?.nome ?? userName ?? 'Responsável da Clínica',
          sala: proc?.salaRequerida || '',
          procedimento: joinNomes(itens),
          procedimentos: itens,
          status: 'agendada',
          valor: sumValor(itens),
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

  const handleNovoPacienteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPacienteNome.trim()) return;

    const rawTelefone = novoPacienteTelefone.replace(/\D/g, '');
    if (rawTelefone && rawTelefone.length < 10) {
      alert('Por favor, informe um telefone de contato válido com DDD (mínimo 10 dígitos).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (novoPacienteEmail && !emailRegex.test(novoPacienteEmail)) {
      alert('Por favor, insira um e-mail válido.');
      return;
    }

    const rawCpf = novoPacienteCpf.replace(/\D/g, '');
    if (rawCpf && rawCpf.length !== 11) {
      alert('CPF inválido. Informe os 11 dígitos completos.');
      return;
    }

    let dbDataNascimento = '';
    if (novoPacienteNasc) {
      const parts = novoPacienteNasc.split('/');
      const dia = parseInt(parts[0], 10);
      const mes = parseInt(parts[1], 10);
      const ano = parseInt(parts[2], 10);
      const dataValida =
        parts.length === 3 &&
        parts[0].length === 2 &&
        parts[1].length === 2 &&
        parts[2].length === 4 &&
        dia >= 1 && dia <= 31 &&
        mes >= 1 && mes <= 12 &&
        ano >= 1900 && ano <= new Date().getFullYear();
      if (!dataValida) {
        alert('Data de nascimento inválida. Use o formato DD/MM/AAAA com valores reais (ex: 15/08/1990).');
        return;
      }
      dbDataNascimento = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    setSalvandoNovoPaciente(true);
    try {
      const novo = await api.createCliente({
        nome: novoPacienteNome.trim(),
        telefone: novoPacienteTelefone.trim() || undefined,
        email: novoPacienteEmail.trim() || undefined,
        dataNascimento: dbDataNascimento || undefined,
        cpf: novoPacienteCpf.trim() || undefined,
        cep: novoPacienteCep.trim() || undefined,
        endereco: novoPacienteEndereco.trim() || undefined,
        unidadeId: unidadeParaNovoCadastro,
      }, userId);
      setClientes(prev => [...prev, novo]);
      setNovoPacienteNome('');
      setNovoPacienteTelefone('');
      setNovoPacienteNasc('');
      setNovoPacienteEmail('');
      setNovoPacienteCpf('');
      setNovoPacienteCep('');
      setNovoPacienteEndereco('');
      setShowNovoPacienteModal(false);
      setActiveClienteId(novo.id);
    } catch (err) {
      console.error(err);
      alert('Erro ao cadastrar paciente.');
    } finally {
      setSalvandoNovoPaciente(false);
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

    const rawCpf = editCpf.replace(/\D/g, '');
    if (rawCpf && rawCpf.length !== 11) {
      alert('CPF inválido. Informe os 11 dígitos completos.');
      return;
    }

    try {
      const payload: Partial<Cliente> = {
        nome: editNome,
        dataNascimento: dbDataNascimento || '',
        telefone: editTelefone,
        email: editEmail,
        cpf: editCpf.trim() || undefined,
        cep: editCep.trim() || undefined,
        endereco: editEndereco.trim() || undefined,
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

  const handleShareGaleria = async () => {
    if (!activeClienteId) return;
    setGeneratingLink(true);
    try {
      const result = await api.createGaleriaShareLink(activeClienteId, userId);
      const url = `${window.location.origin}/galeria/${result.token}`;
      setShareLink({ url, expiraEm: result.expiraEm });
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar link de compartilhamento.');
    } finally {
      setGeneratingLink(false);
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
      const data = await api.getClientes(userId, pacienteCompartilhado ? undefined : unidadeId ?? undefined);
      setClientes(data);
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

  const SEED_TEMPLATES: Array<{ nome: string; categoria: import('../types').TemplateCategoria; conteudo: string }> = [
    {
      nome: 'Prescrição Padrão',
      categoria: 'prescricao',
      conteudo:
`Prescrição Estética

Paciente: {{nome_paciente}}
Data: {{data}}
Procedimento: {{procedimento}}

Prescrevo:
- [Produto/Medicamento]: [Dose/Quantidade]
- [Produto/Medicamento]: [Dose/Quantidade]

Instruções de uso: [Descreva aqui]

{{profissional}}`,
    },
    {
      nome: 'Cuidados Pós-Procedimento',
      categoria: 'orientacao_pos_procedimento',
      conteudo:
`Orientações Pós-Procedimento

Paciente: {{nome_paciente}}
Data: {{data}}
Procedimento realizado: {{procedimento}}

Cuidados importantes:
• Evite exposição solar por 7 dias após o procedimento
• Não massageie a área tratada nas primeiras 24h
• Mantenha boa hidratação
• Em caso de dúvidas ou reações inesperadas, entre em contato com a clínica

Retorno agendado: {{proxima_consulta}}

{{profissional}}`,
    },
    {
      nome: 'Recomendação Dermatológica',
      categoria: 'recomendacao_dermatologica',
      conteudo:
`Recomendação Dermatológica

Paciente: {{nome_paciente}}
Data: {{data}}

Com base na avaliação realizada, recomendo:

Limpeza: [Produto/Rotina indicada]
Hidratação: [Produto/Rotina indicada]
Proteção Solar: [FPS recomendado]
Tratamento: [Produto ou procedimento indicado]

Observações: [Observações adicionais]

{{profissional}}`,
    },
    {
      nome: 'Recomendação Estética',
      categoria: 'recomendacao_estetica',
      conteudo:
`Recomendação Estética

Paciente: {{nome_paciente}}
Data: {{data}}
Procedimento: {{procedimento}}

Após avaliação, recomendo os seguintes cuidados e tratamentos complementares:

• [Recomendação 1]
• [Recomendação 2]
• [Recomendação 3]

Próxima consulta: {{proxima_consulta}}

{{profissional}}`,
    },
  ];

  const handleOpenTemplatePicker = async () => {
    setTemplatePickerSearch('');
    setTemplatePickerCat('');
    setShowTemplatePicker(true);
    setLoadingTemplatePicker(true);
    try {
      let data = await api.getPrescricaoTemplates(userId);
      if (data.length === 0) {
        await Promise.all(
          SEED_TEMPLATES.map(t =>
            api.createPrescricaoTemplate(
              { ...t, variaveis: [], compartilhado: false, permissaoEdicao: 'somente_criador', criadoPorNome: userName || 'Profissional' },
              userId
            )
          )
        );
        data = await api.getPrescricaoTemplates(userId);
      }
      setTemplatePickerList(data);
    } catch {
      setTemplatePickerList([]);
    } finally {
      setLoadingTemplatePicker(false);
    }
  };

  const handleApplyTemplate = (template: PrescricaoTemplate) => {
    const proximaConsulta = futureConsultas[0]?.data
      ? new Date(futureConsultas[0].data + 'T12:00:00').toLocaleDateString('pt-BR')
      : '[Próxima Consulta]';
    const texto = template.conteudo
      .replace(/\{\{nome_paciente\}\}/g, currentCliente?.nome || '[Nome do Paciente]')
      .replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{\{procedimento\}\}/g, newEvolucaoProc || '[Procedimento]')
      .replace(/\{\{profissional\}\}/g, userName || '[Profissional]')
      .replace(/\{\{proxima_consulta\}\}/g, proximaConsulta);
    setNewEvolucaoText(texto);
    setShowTemplatePicker(false);
    api.registrarUsoPrescricaoTemplate(template.id, activeClienteId || null, newEvolucaoProc || null, userId).catch(() => {});
  };

  const handleGoToTemplates = () => {
    setShowTemplatePicker(false);
    setTemplatesForceExpand(prev => prev + 1);
    setTimeout(() => {
      templatesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const filteredTemplatesPicker = templatePickerList.filter(t => {
    const matchS = !templatePickerSearch || t.nome.toLowerCase().includes(templatePickerSearch.toLowerCase());
    const matchC = !templatePickerCat || t.categoria === templatePickerCat;
    return matchS && matchC;
  });

  const handleAddEvolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvolucaoText.trim() || !activeClienteId) return;

    try {
      await api.createEvolucao(activeClienteId, {
        data: new Date().toISOString().split('T')[0],
        profissional: userName || 'Profissional',
        procedimento: newEvolucaoProc,
        relatoNatural: newEvolucaoText,
        observacoesTecnicas: newEvolucaoObs || 'Sem intercorrências técnicas.',
        aditamentoDe: aditandoEvolucaoId,
        unidadeId: unidadeId ?? currentCliente?.unidadeId ?? null,
      }, userId);

      setNewEvolucaoText('');
      setNewEvolucaoObs('');
      setAditandoEvolucaoId(null);
      alert(aditandoEvolucaoId ? 'Aditamento registrado com sucesso no prontuário.' : 'Evolução clínica registrada com sucesso no prontuário.');
      loadEvolucoes(activeClienteId);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar evolução.');
    }
  };

  // US-021 — Aditamento: correção de registro assinado por meio de nova entrada
  // (registros assinados são imutáveis; correções referenciam o original)
  const handleAditarEvolucao = (ev: EvolucaoClinica) => {
    setAditandoEvolucaoId(ev.id);
    setNewEvolucaoProc(ev.procedimento);
    setNewEvolucaoObs('');
    setNewEvolucaoText(`Correção do registro de ${new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR')}: `);
    document.getElementById('form-nova-evolucao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelarAditamento = () => {
    setAditandoEvolucaoId(null);
    setNewEvolucaoText('');
    setNewEvolucaoObs('');
  };

  // US-021 — Assinatura digital: requer confirmação de senha; torna o registro imutável
  const handleAbrirAssinatura = (ev: EvolucaoClinica) => {
    setAssinandoEvolucao(ev);
    setAssinaturaSenha('');
    setAssinaturaErro(null);
  };

  const handleConfirmarAssinatura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assinandoEvolucao || !assinaturaSenha.trim()) return;
    setAssinaturaSalvando(true);
    setAssinaturaErro(null);
    try {
      await api.assinarEvolucao(assinandoEvolucao.id, assinaturaSenha, userId);
      setAssinandoEvolucao(null);
      setAssinaturaSenha('');
      if (activeClienteId) loadEvolucoes(activeClienteId);
    } catch (err: any) {
      setAssinaturaErro(err?.message || 'Não foi possível assinar o registro. Verifique sua senha.');
    } finally {
      setAssinaturaSalvando(false);
    }
  };

  // ── US-028: IA no prontuário — gravação, transcrição, estruturação, resumo ──

  // Abre o modal de consentimento explícito do paciente — passo obrigatório
  // antes de qualquer gravação (CA-04 / CFM-LGPD).
  const handleAbrirGravacao = () => {
    if (!activeClienteId) return;
    setShowConsentimentoGravacao(true);
  };

  // Paciente concorda em ser gravado: registra consentimento com timestamp
  // e inicia a captura de áudio/transcrição imediatamente (CA-01 + CA-04).
  const handleAceitarConsentimentoGravacao = async () => {
    if (!activeClienteId) return;
    try {
      const gravacao = await api.criarGravacao(activeClienteId, {
        profissional: userName || 'Profissional',
        consentimentoAceito: true,
      }, userId);
      setGravacaoAtual(gravacao);
      setShowConsentimentoGravacao(false);
      setTranscricaoTexto('');
      setTranscricaoInterim('');
      setTranscricaoErro(null);
      iniciarCapturaTranscricao();
    } catch (err: any) {
      alert(err?.message || 'Não foi possível iniciar a gravação.');
    }
  };

  // Paciente recusa: a gravação NÃO é ativada — fica documentado que o
  // profissional deverá registrar manualmente (CA-04).
  const handleRecusarConsentimentoGravacao = async () => {
    if (!activeClienteId) return;
    try {
      await api.criarGravacao(activeClienteId, {
        profissional: userName || 'Profissional',
        consentimentoAceito: false,
      }, userId);
    } catch (err) {
      console.error(err);
    }
    setShowConsentimentoGravacao(false);
    alert('Consentimento não concedido. A transcrição não foi ativada — registre a evolução manualmente no formulário ao lado.');
  };

  // Liga o motor de transcrição (Web Speech API). Quando indisponível no
  // navegador, permite digitação manual da transcrição como alternativa.
  const iniciarCapturaTranscricao = () => {
    const motor = criarMotorTranscricao('pt-BR');
    motorTranscricaoRef.current = motor;
    if (!motor.disponivel) {
      setTranscricaoIndisponivel(true);
      setGravando(true);
      return;
    }
    setTranscricaoIndisponivel(false);
    setGravando(true);
    motor.iniciar({
      onInterimResult: (texto) => setTranscricaoInterim(texto),
      onFinalResult: (trecho) => {
        setTranscricaoInterim('');
        setTranscricaoTexto((atual) => (atual ? `${atual} ${trecho}` : trecho));
      },
      onError: (mensagem) => setTranscricaoErro(mensagem),
      onEnd: () => setGravando(false),
    });
  };

  const handlePararGravacao = () => {
    motorTranscricaoRef.current?.parar();
    setGravando(false);
    setTranscricaoInterim('');
  };

  // Encerra a captura, envia a transcrição (revisada/editável) para
  // estruturação automática por IA e abre a tela de revisão (CA-01 + CA-02).
  const handleProcessarTranscricao = async () => {
    if (!gravacaoAtual || !transcricaoTexto.trim()) {
      alert('A transcrição está vazia. Grave novamente ou digite o relato manualmente.');
      return;
    }
    handlePararGravacao();
    setProcessandoTranscricao(true);
    try {
      const atualizada = await api.processarTranscricao(gravacaoAtual.id, transcricaoTexto.trim(), userId);
      setGravacaoAtual(atualizada);
      setRevisaoEstrutura({
        procedimento: '',
        queixa: atualizada.estruturaQueixa || '',
        historico: atualizada.estruturaHistorico || '',
        exame: atualizada.estruturaExame || '',
        conduta: atualizada.estruturaConduta || '',
        prescricao: atualizada.estruturaPrescricao || '',
        cid10: atualizada.cid10Sugestoes || [],
      });
    } catch (err: any) {
      alert(err?.message || 'Não foi possível processar a transcrição.');
    } finally {
      setProcessandoTranscricao(false);
    }
  };

  // Aprovação final: "a IA sugere — o profissional decide". Só a partir
  // deste clique explícito o conteúdo é gravado no prontuário (US-021),
  // já passando pelo ciclo normal de evolução (rascunho -> assinatura).
  const handleAprovarGravacao = async () => {
    if (!gravacaoAtual || !revisaoEstrutura) return;
    const relatoFinal = [
      revisaoEstrutura.queixa && `Queixa principal: ${revisaoEstrutura.queixa}`,
      revisaoEstrutura.historico && `Histórico: ${revisaoEstrutura.historico}`,
      revisaoEstrutura.exame && `Exame: ${revisaoEstrutura.exame}`,
    ].filter(Boolean).join('\n');
    const obsFinal = [
      revisaoEstrutura.conduta && `Conduta: ${revisaoEstrutura.conduta}`,
      revisaoEstrutura.prescricao && `Prescrição: ${revisaoEstrutura.prescricao}`,
      revisaoEstrutura.cid10.length > 0 && `CID-10 sugerido (revisar): ${revisaoEstrutura.cid10.join('; ')}`,
    ].filter(Boolean).join('\n');

    setAprovandoGravacao(true);
    try {
      await api.aprovarGravacao(gravacaoAtual.id, {
        procedimento: revisaoEstrutura.procedimento || 'Consulta / Avaliação',
        relatoNatural: relatoFinal || transcricaoTexto,
        observacoesTecnicas: obsFinal || 'Sem intercorrências técnicas.',
        data: new Date().toISOString().split('T')[0],
        profissional: userName || 'Profissional',
      }, userId);
      alert('Resumo aprovado e registrado no prontuário como nova evolução clínica (rascunho — assine digitalmente para validá-la).');
      setGravacaoAtual(null);
      setRevisaoEstrutura(null);
      setTranscricaoTexto('');
      setTranscricaoIndisponivel(false);
      loadEvolucoes(activeClienteId);
    } catch (err: any) {
      alert(err?.message || 'Não foi possível salvar a evolução no prontuário.');
    } finally {
      setAprovandoGravacao(false);
    }
  };

  const handleDescartarGravacao = async () => {
    if (!gravacaoAtual) return;
    if (!window.confirm('Descartar esta transcrição? O conteúdo não será salvo no prontuário.')) return;
    try {
      await api.descartarGravacao(gravacaoAtual.id, userId);
    } catch (err) {
      console.error(err);
    }
    setGravacaoAtual(null);
    setRevisaoEstrutura(null);
    setTranscricaoTexto('');
    setTranscricaoInterim('');
    setTranscricaoIndisponivel(false);
  };

  // Privacidade dos dados de IA (CA-05): permite excluir o áudio original
  // após a transcrição já ter sido aprovada — nada é retido além do
  // necessário para o prontuário.
  const handleExcluirAudioOriginal = async () => {
    if (!gravacaoAtual) return;
    if (!window.confirm('Excluir definitivamente o áudio original desta consulta? Esta ação não pode ser desfeita.')) return;
    try {
      const atualizada = await api.excluirAudioOriginal(gravacaoAtual.id, userId);
      setGravacaoAtual(atualizada);
      alert('Áudio original excluído. Nenhum dado de voz é retido após o processamento (CA-05).');
    } catch (err: any) {
      alert(err?.message || 'Não foi possível excluir o áudio.');
    }
  };

  // CA-03 — Gera (ou atualiza) o resumo de histórico clínico exibido no
  // topo do prontuário, a partir das evoluções já registradas.
  const handleGerarResumoClinicoIA = async () => {
    if (!activeClienteId) return;
    setGerandoResumoIA(true);
    try {
      const clienteAtualizado = await api.gerarResumoClinico(activeClienteId, userId);
      setClientes((atual) => atual.map((c) => (c.id === clienteAtualizado.id ? clienteAtualizado : c)));
    } catch (err: any) {
      alert(err?.message || 'Não foi possível gerar o resumo clínico.');
    } finally {
      setGerandoResumoIA(false);
    }
  };

  // US-021 (CA-06) — Exportação em PDF com layout CFM (cabeçalho da clínica + identificação do profissional)
  const handleExportarProntuarioPDF = () => {
    if (!currentCliente) return;
    const win = window.open('', '_blank');
    if (!win) {
      alert('Permita pop-ups para exportar o prontuário em PDF.');
      return;
    }
    const dataEmissao = new Date().toLocaleString('pt-BR');
    const linhas = currentProntuario.evolucoes.map((ev) => `
      <div class="registro ${ev.assinadoEm ? 'assinado' : 'rascunho'}">
        <div class="registro-cabecalho">
          <span class="registro-data">${escapeHtml(new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR'))}</span>
          <span class="registro-procedimento">${escapeHtml(ev.procedimento || '—')}</span>
          <span class="registro-profissional">${escapeHtml(ev.profissional || '—')}</span>
        </div>
        ${ev.aditamentoDe ? '<p class="aditamento-tag">Aditamento / correção de registro anterior</p>' : ''}
        <p class="registro-relato">${escapeHtml(ev.relatoNatural)}</p>
        <p class="registro-obs"><strong>Dados técnicos:</strong> ${escapeHtml(ev.observacoesTecnicas)}</p>
        <p class="registro-assinatura">
          ${ev.assinadoEm
            ? `✔ Assinado digitalmente por <strong>${escapeHtml(ev.assinadoPor)}</strong> em ${escapeHtml(new Date(ev.assinadoEm).toLocaleString('pt-BR'))} — registro imutável (CFM 1.638/2002). Hash: ${escapeHtml(ev.assinaturaHash?.slice(0, 16) ?? '')}…`
            : '⚠ Rascunho — registro ainda não assinado digitalmente, sem validade legal (CFM 1.638/2002).'}
        </p>
      </div>
    `).join('');

    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Prontuário — ${escapeHtml(currentCliente.nome)}</title>
      <style>
        body { font-family: Georgia, 'Times New Roman', serif; color: #1f2933; padding: 32px; max-width: 820px; margin: 0 auto; }
        header { border-bottom: 2px solid #5F7D75; padding-bottom: 12px; margin-bottom: 20px; }
        header h1 { font-size: 20px; margin: 0 0 4px; color: #5F7D75; }
        header p { margin: 2px 0; font-size: 12px; color: #555; }
        .paciente { background: #F8F9F8; border: 1px solid #ECECEC; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; }
        .paciente strong { color: #5F7D75; }
        h2 { font-size: 15px; color: #5F7D75; border-bottom: 1px solid #ECECEC; padding-bottom: 6px; }
        .registro { border-left: 3px solid #5F7D75; padding: 10px 16px; margin-bottom: 16px; page-break-inside: avoid; }
        .registro.rascunho { border-left-color: #c2410c; }
        .registro-cabecalho { display: flex; gap: 16px; font-size: 12px; font-weight: bold; margin-bottom: 6px; }
        .registro-procedimento { color: #5F7D75; }
        .registro-relato, .registro-obs { font-size: 13px; line-height: 1.5; margin: 4px 0; }
        .aditamento-tag { font-size: 11px; font-style: italic; color: #b45309; margin: 0 0 4px; }
        .registro-assinatura { font-size: 11px; margin-top: 6px; color: #1f6f4a; }
        .registro.rascunho .registro-assinatura { color: #c2410c; }
        footer { margin-top: 32px; font-size: 10px; color: #888; border-top: 1px solid #ECECEC; padding-top: 8px; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>
        <header>
          <h1>Prontuário Eletrônico — Conformidade CFM (Resolução 1.638/2002 e 2.299/2021)</h1>
          <p>Documento gerado em ${escapeHtml(dataEmissao)} · Profissional responsável: ${escapeHtml(userName || '—')}</p>
        </header>
        <div class="paciente">
          <strong>Paciente:</strong> ${escapeHtml(currentCliente.nome)} &nbsp;|&nbsp;
          <strong>Telefone:</strong> ${escapeHtml(currentCliente.telefone || '—')} &nbsp;|&nbsp;
          <strong>E-mail:</strong> ${escapeHtml(currentCliente.email || '—')}
        </div>
        <h2>Linha do tempo de evoluções clínicas</h2>
        ${linhas || '<p>Sem evoluções registradas.</p>'}
        <footer>
          Este documento é uma cópia para fins de continuidade de cuidado e arquivamento.
          Registros assinados digitalmente são imutáveis e mantidos pelo prazo mínimo legal de 20 anos (CFM).
        </footer>
        <script>window.onload = () => window.print();</script>
      </body></html>`);
    win.document.close();
  };

  if (loadingClientes) {
    return <div>Carregando prontuários...</div>;
  }

  if (clientes.length === 0) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
        <div className="prontuario-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
              Prontuário Visual
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              Consulte o histórico completo de bem-estar de suas clientes, evoluções clínicas e evoluções de fotos.
            </p>
          </div>
          <button
            onClick={() => setShowNovoPacienteModal(true)}
            className="btn btn-primary"
          >
            <UserPlus size={16} />
            <span>Nova(o) paciente</span>
          </button>
        </div>
        <div className="card" style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <User size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.2 }} />
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>Nenhuma paciente cadastrada</p>
          <p style={{ fontSize: '13px' }}>Clique em "Nova(o) paciente" para começar a cadastrar.</p>
        </div>
        {showNovoPacienteModal && (
          <div
            className="modal-overlay"
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s ease-out' }}
            onClick={() => setShowNovoPacienteModal(false)}
          >
            <div
              className="card"
              style={{ maxWidth: '480px', width: '92%', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: '20px' }}>Cadastrar Paciente</h3>
              <form onSubmit={handleNovoPacienteSubmit}>
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={novoPacienteNome}
                    onChange={e => setNovoPacienteNome(e.target.value)}
                    placeholder="Ex: Amanda Santos"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={novoPacienteTelefone}
                    onChange={e => setNovoPacienteTelefone(formatTelefone(e.target.value))}
                    placeholder="(XX) 9XXXX-XXXX"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data de Nascimento</label>
                  <input
                    type="text"
                    className="form-input"
                    value={novoPacienteNasc}
                    onChange={e => setNovoPacienteNasc(formatDataNascimento(e.target.value))}
                    placeholder="DD/MM/AAAA"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail</label>
                  <input
                    type="text"
                    className="form-input"
                    value={novoPacienteEmail}
                    onChange={e => setNovoPacienteEmail(e.target.value)}
                    placeholder="exemplo@email.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF</label>
                  <input
                    type="text"
                    className="form-input"
                    value={novoPacienteCpf}
                    onChange={e => setNovoPacienteCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">CEP</label>
                  <input
                    type="text"
                    className="form-input"
                    value={novoPacienteCep}
                    onChange={e => setNovoPacienteCep(formatCep(e.target.value))}
                    placeholder="00000-000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Endereço</label>
                  <input
                    type="text"
                    className="form-input"
                    value={novoPacienteEndereco}
                    onChange={e => setNovoPacienteEndereco(e.target.value)}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button type="button" onClick={() => setShowNovoPacienteModal(false)} className="btn btn-outline">Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={salvandoNovoPaciente || !novoPacienteNome.trim()}>
                    <UserPlus size={15} />
                    {salvandoNovoPaciente ? 'Salvando...' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
            Prontuário Visual
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Consulte o histórico completo de bem-estar de suas clientes, evoluções clínicas e evoluções de fotos.
          </p>
        </div>
        <button
          onClick={() => setShowNovoPacienteModal(true)}
          className="btn btn-primary"
        >
          <UserPlus size={16} />
          <span>Nova(o) paciente</span>
        </button>
      </div>

      <div className={`prontuario-grid${activeClienteId ? ' prontuario-grid--selected' : ''}`}>

        {/* Left Side: Client Selector */}
        <div className="card prontuario-left-panel" style={{ padding: '20px' }}>
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
        <div className="prontuario-right-panel" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <button
            className="prontuario-back-btn btn btn-outline"
            onClick={() => setActiveClienteId('')}
          >
            <ChevronLeft size={16} />
            <span>Lista de Pacientes</span>
          </button>

          {!currentCliente && (
            <div className="card" style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <FileText size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.2 }} />
              <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>Nenhuma paciente selecionada</p>
              <p style={{ fontSize: '13px' }}>Selecione uma paciente na lista para ver o prontuário.</p>
            </div>
          )}

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
                <div className="prontuario-patient-info" style={{ flex: 1, paddingRight: '20px' }}>
                  {!isEditing ? (
                    <div className="prontuario-patient-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '16px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <h2 style={{ fontSize: '22px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                            {currentCliente.nome}
                          </h2>
                          {isPro && lgpdConsentido === true && (
                            <span title="Consentimento LGPD ativo" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-success)', background: '#e8f5e9', padding: '2px 8px', borderRadius: '100px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              <ShieldCheck size={12} /> LGPD
                            </span>
                          )}
                          {isPro && lgpdConsentido === false && (
                            <button
                              onClick={() => setShowConsentimento(true)}
                              title="Sem consentimento LGPD — clique para coletar"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-warning)', background: '#fff8e1', padding: '2px 8px', borderRadius: '100px', border: '1px solid var(--color-warning)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                              <ShieldAlert size={12} /> Sem consentimento
                            </button>
                          )}
                        </div>
                        <div className="prontuario-patient-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                          <span>Nasc: {currentCliente.dataNascimento ? currentCliente.dataNascimento.split('-').reverse().join('/') : 'N/A'}</span>
                          <span>Contato: {currentCliente.telefone || 'N/A'}</span>
                          <span>E-mail: {currentCliente.email || 'N/A'}</span>
                          <span>CPF: {currentCliente.cpf || 'N/A'}</span>
                          <span>CEP: {currentCliente.cep || 'N/A'}</span>
                          <span>Endereço: {currentCliente.endereco || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="prontuario-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                        {onAddAgendamento && (
                          <button
                            onClick={() => { setAgendarPlanoTratamentoId(null); setAgendarPlanoProcedimentoNome(null); setShowAgendarModal(true); }}
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
                          style={{ fontSize: '20px', fontWeight: 600, padding: '4px 8px', margin: 0, flex: 1, minWidth: 0 }}
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          placeholder="Nome da paciente"
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                        <div className="prontuario-edit-fields" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div className="prontuario-edit-field" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>Nasc:</span>
                            <input
                              type="text"
                              className="form-input"
                              style={{ width: '120px', padding: '6px 10px', fontSize: '12px', borderRadius: '4px' }}
                              value={editNasc}
                              onChange={(e) => setEditNasc(formatDataNascimento(e.target.value))}
                              placeholder="DD/MM/AAAA"
                            />
                          </div>

                          <div className="prontuario-edit-field" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>Contato:</span>
                            <input
                              type="text"
                              className="form-input"
                              style={{ width: '140px', padding: '6px 10px', fontSize: '12px', borderRadius: '4px' }}
                              value={editTelefone}
                              onChange={(e) => setEditTelefone(formatTelefone(e.target.value))}
                              placeholder="(XX) 9XXXX-XXXX"
                            />
                          </div>

                          <div className="prontuario-edit-field" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>E-mail:</span>
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

                        <div className="prontuario-edit-fields" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div className="prontuario-edit-field" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>CPF:</span>
                            <input
                              type="text"
                              className="form-input"
                              style={{ width: '140px', padding: '6px 10px', fontSize: '12px', borderRadius: '4px' }}
                              value={editCpf}
                              onChange={(e) => setEditCpf(formatCpf(e.target.value))}
                              placeholder="000.000.000-00"
                            />
                          </div>

                          <div className="prontuario-edit-field" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>CEP:</span>
                            <input
                              type="text"
                              className="form-input"
                              style={{ width: '100px', padding: '6px 10px', fontSize: '12px', borderRadius: '4px' }}
                              value={editCep}
                              onChange={(e) => setEditCep(formatCep(e.target.value))}
                              placeholder="00000-000"
                            />
                          </div>

                          <div className="prontuario-edit-field" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>Endereço:</span>
                            <input
                              type="text"
                              className="form-input"
                              style={{ width: '220px', padding: '6px 10px', fontSize: '12px', borderRadius: '4px' }}
                              value={editEndereco}
                              onChange={(e) => setEditEndereco(e.target.value)}
                              placeholder="Rua, número, bairro, cidade"
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

          {/* US-028 (CA-03): Resumo do histórico clínico gerado por IA — exibido no topo do prontuário */}
          {currentCliente && isEnterprise && (
            <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)', border: '1px solid #ddd6fe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <Sparkles size={18} style={{ color: '#7c3aed', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: '#5b21b6' }}>Resumo do histórico clínico (IA)</h3>
                    {currentCliente.resumoClinicoIA ? (
                      <>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-main)', lineHeight: '1.6', margin: 0 }}>
                          {currentCliente.resumoClinicoIA}
                        </p>
                        {currentCliente.resumoClinicoIAGeradoEm && (
                          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                            Gerado por IA em {new Date(currentCliente.resumoClinicoIAGeradoEm).toLocaleString('pt-BR')} — sugestão automática; não substitui a avaliação clínica do profissional.
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
                        Nenhum resumo gerado ainda. Clique em "Gerar resumo" para que a IA monte uma síntese do histórico clínico a partir das evoluções registradas.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGerarResumoClinicoIA}
                  disabled={gerandoResumoIA}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#7c3aed', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: gerandoResumoIA ? 'default' : 'pointer', color: '#fff', fontWeight: 500, opacity: gerandoResumoIA ? 0.7 : 1, flexShrink: 0 }}
                >
                  <Sparkles size={13} />
                  {gerandoResumoIA ? 'Gerando…' : currentCliente.resumoClinicoIA ? 'Atualizar resumo' : 'Gerar resumo'}
                </button>
              </div>
            </div>
          )}

          {/* US-028 (CA-01/CA-02/CA-04/CA-05): Gravação de consulta com transcrição e estruturação por IA */}
          {currentCliente && isEnterprise && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Mic size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>IA na consulta: gravação e transcrição automática</h3>
              </div>

              {/* Estado inicial: nenhuma gravação em andamento */}
              {!gravacaoAtual && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, maxWidth: '480px' }}>
                    Grave a consulta para que a IA transcreva o áudio e estruture automaticamente o relato em
                    Queixa principal, Histórico, Exame, Conduta e Prescrição — você revisa e aprova tudo antes de salvar no prontuário.
                  </p>
                  <button
                    type="button"
                    onClick={handleAbrirGravacao}
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', color: '#1f6f4a', fontWeight: 600, flexShrink: 0 }}
                  >
                    <Mic size={14} /> Gravar consulta
                  </button>
                </div>
              )}

              {/* Gravando / transcrevendo ao vivo (CA-01) */}
              {gravacaoAtual && gravacaoAtual.status !== 'aprovada' && !revisaoEstrutura && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    {gravando && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block', animation: 'pulse 1.4s infinite' }} />
                        Gravando e transcrevendo em tempo real…
                      </span>
                    )}
                    {!gravando && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Gravação pausada — revise o texto abaixo</span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Consentimento registrado em {gravacaoAtual.consentimentoEm ? new Date(gravacaoAtual.consentimentoEm).toLocaleString('pt-BR') : '—'}
                    </span>
                  </div>

                  {transcricaoIndisponivel && (
                    <div style={{ fontSize: '12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', color: '#9a3412' }}>
                      <AlertTriangle size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      Transcrição automática indisponível neste navegador. Digite o relato da consulta manualmente abaixo — ele ainda será estruturado pela IA.
                    </div>
                  )}
                  {transcricaoErro && (
                    <div style={{ fontSize: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', color: '#b91c1c' }}>
                      {transcricaoErro}
                    </div>
                  )}

                  <textarea
                    className="form-input"
                    value={transcricaoTexto + (transcricaoInterim ? ` ${transcricaoInterim}` : '')}
                    onChange={(e) => setTranscricaoTexto(e.target.value)}
                    placeholder="A transcrição aparecerá aqui em tempo real. Você pode editar livremente antes de continuar."
                    rows={6}
                    style={{ width: '100%', padding: '12px', fontSize: '13px', borderRadius: '6px', resize: 'vertical', marginBottom: '12px' }}
                  />

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {gravando ? (
                      <button type="button" onClick={handlePararGravacao} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', color: '#b91c1c', fontWeight: 600 }}>
                        <Square size={13} /> Parar gravação
                      </button>
                    ) : (
                      <button type="button" onClick={iniciarCapturaTranscricao} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', color: '#1f6f4a', fontWeight: 600 }}>
                        <Mic size={13} /> Retomar gravação
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleProcessarTranscricao}
                      disabled={processandoTranscricao || !transcricaoTexto.trim()}
                      style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#7c3aed', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: processandoTranscricao ? 'default' : 'pointer', color: '#fff', fontWeight: 600, opacity: processandoTranscricao || !transcricaoTexto.trim() ? 0.6 : 1 }}
                    >
                      <Sparkles size={13} /> {processandoTranscricao ? 'Estruturando com IA…' : 'Concluir e estruturar com IA'}
                    </button>
                    <button type="button" onClick={handleDescartarGravacao} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      <Trash size={13} /> Descartar
                    </button>
                  </div>
                </div>
              )}

              {/* Revisão e estruturação (CA-02): "a IA sugere — o profissional decide" */}
              {gravacaoAtual && revisaoEstrutura && (
                <div>
                  <div style={{ fontSize: '12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', color: '#5b21b6' }}>
                    <Sparkles size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    A IA estruturou o relato abaixo a partir da transcrição. Revise, edite o que precisar e aprove — nada é salvo no prontuário sem sua confirmação explícita.
                  </div>

                  <div style={{ display: 'grid', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Procedimento realizado</label>
                      <select
                        className="form-input"
                        value={revisaoEstrutura.procedimento}
                        onChange={(e) => setRevisaoEstrutura((r) => r && { ...r, procedimento: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px' }}
                      >
                        <option value="">Selecione um procedimento…</option>
                        {procedimentos.map((p) => (
                          <option key={p.id} value={p.nome}>{p.nome}</option>
                        ))}
                      </select>
                    </div>

                    {([
                      ['queixa', 'Queixa principal'],
                      ['historico', 'Histórico'],
                      ['exame', 'Exame'],
                      ['conduta', 'Conduta'],
                      ['prescricao', 'Prescrição'],
                    ] as const).map(([campo, rotulo]) => (
                      <div key={campo}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>{rotulo}</label>
                        <textarea
                          className="form-input"
                          value={revisaoEstrutura[campo]}
                          onChange={(e) => setRevisaoEstrutura((r) => r && { ...r, [campo]: e.target.value })}
                          rows={2}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', resize: 'vertical' }}
                        />
                      </div>
                    ))}

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                        Sugestões de CID-10 (apenas sugestão — confirme antes de utilizar)
                      </label>
                      {revisaoEstrutura.cid10.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {revisaoEstrutura.cid10.map((c) => (
                            <span key={c} style={{ fontSize: '11px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '100px', padding: '3px 10px', color: '#1d4ed8', fontWeight: 500 }}>{c}</span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Nenhuma sugestão identificada automaticamente.</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleAprovarGravacao}
                      disabled={aprovandoGravacao}
                      style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#1f6f4a', border: 'none', borderRadius: '6px', padding: '9px 16px', cursor: aprovandoGravacao ? 'default' : 'pointer', color: '#fff', fontWeight: 600, opacity: aprovandoGravacao ? 0.7 : 1 }}
                    >
                      <ShieldCheck size={14} /> {aprovandoGravacao ? 'Salvando…' : 'Aprovar e registrar no prontuário'}
                    </button>
                    {!gravacaoAtual.audioExcluidoEm && (
                      <button type="button" onClick={handleExcluirAudioOriginal} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #fecaca', borderRadius: '6px', padding: '9px 16px', cursor: 'pointer', color: '#b91c1c', fontWeight: 500 }}>
                        <Trash2 size={13} /> Excluir áudio original
                      </button>
                    )}
                    {gravacaoAtual.audioExcluidoEm && (
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', color: '#1f6f4a', fontWeight: 500 }}>
                        <ShieldCheck size={12} /> Áudio original excluído em {new Date(gravacaoAtual.audioExcluidoEm).toLocaleString('pt-BR')}
                      </span>
                    )}
                    <button type="button" onClick={handleDescartarGravacao} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '9px 16px', cursor: 'pointer', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      <Trash size={13} /> Descartar
                    </button>
                  </div>
                </div>
              )}
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
                            onClick={() => { setAgendarPlanoTratamentoId(null); setAgendarPlanoProcedimentoNome(null); setShowAgendarModal(true); }}
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
          {currentCliente && isPro && (
            <AnamneseDigital
              clienteId={activeClienteId}
              clienteNome={currentCliente.nome}
              userId={userId}
              procedimentos={procedimentos.map((p) => ({ id: p.id, nome: p.nome }))}
              userName={userName}
            />
          )}

          {/* Assinatura Digital de Documentos (US-025) */}
          {currentCliente && isPro && (
            <AssinaturaDigital
              clienteId={activeClienteId}
              clienteNome={currentCliente.nome}
              userId={userId}
              userName={userName}
            />
          )}

          {/* Plano de Tratamento Multi-Etapas (US-026) */}
          {currentCliente && isPro && (
            <PlanoTratamento
              clienteId={activeClienteId}
              clienteNome={currentCliente.nome}
              userId={userId}
              userName={userName}
              onAgendar={handleAgendarComPlano}
              agendamentosCliente={agendamentosCliente}
            />
          )}

          {/* Templates de Prescrições (US-027) */}
          {currentCliente && isPro && (
            <TemplatesPrescricoes
              clienteId={activeClienteId}
              clienteNome={currentCliente.nome}
              userId={userId}
              userName={userName}
              forceExpand={templatesForceExpand}
              sectionRef={templatesSectionRef}
            />
          )}

          {/* Galeria de Evolução por Imagem */}
          <div className="card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Galeria Antes / Depois</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={handleShareGaleria}
                  disabled={generatingLink || galeriaItems.length === 0}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', opacity: (generatingLink || galeriaItems.length === 0) ? 0.5 : 1, minHeight: '36px' }}
                  title={galeriaItems.length === 0 ? 'Adicione fotos para compartilhar' : 'Gerar link temporário (24h)'}
                >
                  <span>{generatingLink ? 'Gerando...' : 'Compartilhar'}</span>
                </button>
                <button
                  onClick={() => setShowAddPhoto(!showAddPhoto)}
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '36px' }}
                >
                  <Plus size={14} />
                  <span>Adicionar Comparação</span>
                </button>
              </div>
            </div>

            {/* Banner do link gerado (CA-06) */}
            {shareLink && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--border-radius-md)', marginBottom: '16px', animation: 'fadeIn 0.3s ease-out' }}>
                <span style={{ fontSize: '11px', color: '#166534', fontWeight: 500, whiteSpace: 'nowrap' }}>Link gerado · válido 24h</span>
                <input
                  readOnly
                  value={shareLink.url}
                  style={{ flex: 1, minWidth: '200px', fontSize: '11px', padding: '4px 8px', border: '1px solid #86efac', borderRadius: '4px', background: '#fff', color: '#166534', outline: 'none' }}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(shareLink.url)}
                  className="btn btn-outline"
                  style={{ padding: '4px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                >
                  Copiar Link
                </button>
                <button
                  type="button"
                  onClick={() => setShareLink(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: '18px', lineHeight: 1, padding: '0 2px' }}
                  title="Fechar"
                >
                  ×
                </button>
              </div>
            )}

            {showAddPhoto && (
              <form onSubmit={handleSavePhotos} className="card" style={{ padding: '20px', border: '1px solid var(--color-border)', backgroundColor: '#FAFBFB', marginBottom: '24px', animation: 'fadeIn 0.3s ease-out' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-main)' }}>Nova Comparação Antes / Depois</h4>

                <div className="prontuario-foto-grid" style={{ marginBottom: '16px' }}>
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
          {/* Âncora tablet: visível apenas em tablet (CSS display:none no desktop/mobile).
              Permite chegar ao formulário sem scrollar pela timeline de evoluções. */}
          <div className="prontuario-evolucao-anchor">
            <button
              type="button"
              className="prontuario-evolucao-anchor-btn"
              onClick={() => document.getElementById('form-nova-evolucao')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <Edit2 size={13} />
              Registrar nova evolução ↓
            </button>
          </div>
          <div className="prontuario-hist-grid">

            {/* Timeline of Evolutions */}
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Histórico de Bem-Estar</h3>
                </div>
                {currentProntuario.evolucoes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportarProntuarioPDF}
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#0284c7', fontWeight: 500 }}
                    title="Exportar prontuário em PDF (layout CFM)"
                  >
                    <FileText size={13} /> Exportar PDF
                  </button>
                )}
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
                          {unidadesAtivas.length > 1 && ev.unidadeId && (
                            <> · {unidadesAtivas.find(u => u.id === ev.unidadeId)?.nome ?? 'Unidade removida'}</>
                          )}
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
                        border: '1px solid #ECECEC',
                        marginBottom: '8px'
                      }}>
                        <strong>Anotação Técnica:</strong> {ev.observacoesTecnicas}
                      </div>

                      {/* US-021: status de assinatura digital + ações (assinar/aditar) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        {ev.assinadoEm ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#1f6f4a', fontWeight: 500 }} title={`Hash: ${ev.assinaturaHash || ''}`}>
                            <ShieldCheck size={13} />
                            Assinado por {ev.assinadoPor} em {new Date(ev.assinadoEm).toLocaleString('pt-BR')} — registro imutável
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#c2410c', fontWeight: 500 }}>
                            <ShieldAlert size={13} />
                            Rascunho — sem validade legal até a assinatura digital
                          </span>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!ev.assinadoEm && (
                            <button
                              type="button"
                              onClick={() => handleAbrirAssinatura(ev)}
                              style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '4px 9px', cursor: 'pointer', color: '#1f6f4a', fontWeight: 500 }}
                            >
                              <ShieldCheck size={12} /> Assinar
                            </button>
                          )}
                          {ev.assinadoEm && pode('editar') && (
                            <button
                              type="button"
                              onClick={() => handleAditarEvolucao(ev)}
                              style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '4px 9px', cursor: 'pointer', color: '#c2410c', fontWeight: 500 }}
                            >
                              <Edit2 size={12} /> Aditar (corrigir)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Form for New Evolution */}
            {pode('criar') && (
            <div className="card" id="form-nova-evolucao" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <Plus size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{aditandoEvolucaoId ? 'Aditamento de Registro Assinado' : 'Nova Evolução Clínica'}</h3>
              </div>

              {aditandoEvolucaoId && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', color: '#c2410c' }}>
                  <span>Registros assinados são imutáveis (CFM 1.638/2002). Esta entrada será salva como correção referenciando o registro original.</span>
                  <button type="button" onClick={handleCancelarAditamento} style={{ border: 'none', background: 'transparent', color: '#c2410c', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    Cancelar
                  </button>
                </div>
              )}

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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Relato da Paciente (Texto Natural e Acolhedor)</label>
                    {isPro && (
                      <button
                        type="button"
                        onClick={handleOpenTemplatePicker}
                        style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#0284c7', fontWeight: 500 }}
                      >
                        <LayoutTemplate size={13} /> Usar Template
                      </button>
                    )}
                  </div>
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
                  {aditandoEvolucaoId ? 'Registrar Aditamento' : 'Registrar no Prontuário'}
                </button>
              </form>
            </div>
            )}

          </div>

        </div>

      </div>

      {/* US-028 (CA-04): Modal de consentimento explícito do paciente para gravação de consulta */}
      {showConsentimentoGravacao && currentCliente && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowConsentimentoGravacao(false)}
        >
          <div className="card" style={{ width: '460px', maxWidth: '90vw', padding: '28px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Mic size={20} style={{ color: '#1f6f4a' }} />
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Consentimento para gravação da consulta</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-main)', marginBottom: '12px', lineHeight: 1.6 }}>
              Antes de iniciar a gravação, é obrigatório obter o consentimento explícito de{' '}
              <strong>{currentCliente.nome}</strong>. Leia em voz alta para a paciente:
            </p>
            <div style={{ fontSize: '12px', background: '#f8f9f8', border: '1px solid #ececec', borderRadius: '6px', padding: '12px 14px', marginBottom: '14px', color: 'var(--color-text-main)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "Para agilizar seu atendimento, podemos gravar o áudio desta consulta para gerar automaticamente o
              registro do seu prontuário com auxílio de inteligência artificial. O áudio é processado de forma
              isolada, não é usado para treinar nenhum modelo de IA e pode ser excluído a qualquer momento após
              a transcrição. Você concorda com a gravação?"
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '18px' }}>
              Caso a paciente recuse, a gravação não será ativada e você deverá registrar a evolução manualmente —
              a recusa também fica documentada, com data e hora (CFM/LGPD).
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                style={{ flex: 1 }}
                onClick={handleRecusarConsentimentoGravacao}
              >
                A paciente não concordou
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={handleAceitarConsentimentoGravacao}
              >
                <ShieldCheck size={15} /> Concordou — iniciar gravação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* US-021: Modal de Assinatura Digital (confirmação de senha — CFM 1.638/2002) */}
      {assinandoEvolucao && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !assinaturaSalvando && setAssinandoEvolucao(null)}
        >
          <div className="card" style={{ width: '420px', maxWidth: '90vw', padding: '28px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <ShieldCheck size={20} style={{ color: '#1f6f4a' }} />
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Assinatura Digital do Prontuário</h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Ao assinar, este registro de <strong>{new Date(assinandoEvolucao.data + 'T12:00:00').toLocaleDateString('pt-BR')}</strong> ({assinandoEvolucao.procedimento || 'evolução clínica'}) torna-se <strong>imutável</strong> — não poderá mais ser editado ou excluído, apenas corrigido por aditamento (CFM 1.638/2002 e 2.299/2021). Confirme sua senha para validar a assinatura.
            </p>
            <form onSubmit={handleConfirmarAssinatura}>
              <div className="form-group">
                <label className="form-label">Senha de acesso</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Digite sua senha para confirmar a assinatura"
                  value={assinaturaSenha}
                  onChange={(e) => setAssinaturaSenha(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {assinaturaErro && (
                <p style={{ fontSize: '12px', color: '#c2410c', marginBottom: '8px' }}>{assinaturaErro}</p>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => setAssinandoEvolucao(null)}
                  disabled={assinaturaSalvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  disabled={assinaturaSalvando || !assinaturaSenha.trim()}
                >
                  <ShieldCheck size={15} /> {assinaturaSalvando ? 'Assinando…' : 'Confirmar Assinatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Picker Modal (US-027) */}
      {showTemplatePicker && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => setShowTemplatePicker(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '520px', width: '94%', padding: '28px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LayoutTemplate size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Selecionar Template</h3>
              </div>
              <button onClick={() => setShowTemplatePicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                ✕
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '140px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: '30px', fontSize: '13px' }}
                  placeholder="Buscar..."
                  value={templatePickerSearch}
                  onChange={e => setTemplatePickerSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <select
                className="form-input"
                style={{ fontSize: '13px', minWidth: '160px' }}
                value={templatePickerCat}
                onChange={e => setTemplatePickerCat(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="prescricao">Prescrição</option>
                <option value="orientacao_pos_procedimento">Orientação Pós-Procedimento</option>
                <option value="recomendacao_dermatologica">Recomendação Dermatológica</option>
                <option value="recomendacao_estetica">Recomendação Estética</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            {/* Template list */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {loadingTemplatePicker && (
                <p style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                  Carregando templates...
                </p>
              )}
              {!loadingTemplatePicker && filteredTemplatesPicker.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <LayoutTemplate size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                    {templatePickerSearch || templatePickerCat ? 'Nenhum template encontrado' : 'Nenhum template criado ainda'}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                    {templatePickerSearch
                      ? 'Tente ajustar o termo de busca.'
                      : templatePickerCat
                        ? 'Não há templates nessa categoria ainda.'
                        : 'Crie templates reutilizáveis de prescrições e orientações para agilizar o preenchimento.'}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                    onClick={handleGoToTemplates}
                  >
                    <Plus size={14} /> {templatePickerSearch || templatePickerCat ? 'Criar Novo Template' : 'Criar Primeiro Template'}
                  </button>
                </div>
              )}
              {!loadingTemplatePicker && filteredTemplatesPicker.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleApplyTemplate(t)}
                  style={{ width: '100%', textAlign: 'left', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', background: '#f3f4f6', padding: '2px 7px', borderRadius: '20px' }}>
                      {{
                        prescricao: 'Prescrição',
                        orientacao_pos_procedimento: 'Orientação Pós-Proc.',
                        recomendacao_dermatologica: 'Rec. Dermatológica',
                        recomendacao_estetica: 'Rec. Estética',
                        outro: 'Outro',
                      }[t.categoria]}
                    </span>
                    {t.compartilhado && (
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>Compartilhado</span>
                    )}
                    <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>
                      {t.usoCount}× usado
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)', marginBottom: '3px' }}>
                    {t.nome}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {t.conteudo}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
            <h3 style={{ marginBottom: '20px' }}>Agendar Paciente</h3>
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
                <label className="form-label">Procedimento(s)</label>
                <ProcedimentoMultiSelect
                  procedimentos={procedimentos}
                  selectedIds={acolherProcedimentoIds}
                  onChange={setAcolherProcedimentoIds}
                />
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
                <button type="submit" className="btn btn-primary" disabled={acolherProcedimentoIds.length === 0}>
                  <UserPlus size={15} />
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New patient registration modal (no appointment required) */}
      {showNovoPacienteModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => setShowNovoPacienteModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: '480px', width: '92%', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '20px' }}>Cadastrar Paciente</h3>
            <form onSubmit={handleNovoPacienteSubmit}>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input
                  type="text"
                  className="form-input"
                  value={novoPacienteNome}
                  onChange={e => setNovoPacienteNome(e.target.value)}
                  placeholder="Ex: Amanda Santos"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  type="text"
                  className="form-input"
                  value={novoPacienteTelefone}
                  onChange={e => setNovoPacienteTelefone(formatTelefone(e.target.value))}
                  placeholder="(XX) 9XXXX-XXXX"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Data de Nascimento</label>
                <input
                  type="text"
                  className="form-input"
                  value={novoPacienteNasc}
                  onChange={e => setNovoPacienteNasc(formatDataNascimento(e.target.value))}
                  placeholder="DD/MM/AAAA"
                />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  type="text"
                  className="form-input"
                  value={novoPacienteEmail}
                  onChange={e => setNovoPacienteEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">CPF</label>
                <input
                  type="text"
                  className="form-input"
                  value={novoPacienteCpf}
                  onChange={e => setNovoPacienteCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="form-group">
                <label className="form-label">CEP</label>
                <input
                  type="text"
                  className="form-input"
                  value={novoPacienteCep}
                  onChange={e => setNovoPacienteCep(formatCep(e.target.value))}
                  placeholder="00000-000"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input
                  type="text"
                  className="form-input"
                  value={novoPacienteEndereco}
                  onChange={e => setNovoPacienteEndereco(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowNovoPacienteModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvandoNovoPaciente || !novoPacienteNome.trim()}>
                  <UserPlus size={15} />
                  {salvandoNovoPaciente ? 'Salvando...' : 'Cadastrar'}
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
                <label className="form-label">Procedimento(s)</label>
                <ProcedimentoMultiSelect
                  procedimentos={procedimentos}
                  selectedIds={agendarProcedimentoIds}
                  onChange={setAgendarProcedimentoIds}
                />
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

              {agendarSalaOptions.length > 0 && plano && plano !== 'basico' && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Sala de Atendimento
                    {agendarSala && (() => {
                      const s = agendarSalaOptions.find((o) => o.sala === agendarSala);
                      return s ? (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: s.disponivel ? '#d1fae5' : '#fee2e2',
                          color: s.disponivel ? '#065f46' : '#991b1b',
                        }}>
                          {s.disponivel ? 'Disponível' : 'Ocupada'}
                        </span>
                      ) : null;
                    })()}
                  </label>
                  <select
                    className="form-select"
                    value={agendarSala}
                    onChange={(e) => setAgendarSala(e.target.value)}
                  >
                    {agendarSalaOptions.map((o) => (
                      <option key={o.sala} value={o.sala}>
                        {o.disponivel ? `${o.sala} (Disponível)` : `${o.sala} (Ocupada — ${o.ocupadaPor})`}
                      </option>
                    ))}
                  </select>
                  {agendarSala && agendarSalaOptions.find((o) => o.sala === agendarSala && !o.disponivel) && (
                    <p style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>
                      Esta sala está ocupada no horário selecionado. Escolha outra sala ou altere o horário.
                    </p>
                  )}
                </div>
              )}

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
                <button type="submit" className="btn btn-primary" disabled={agendarProcedimentoIds.length === 0}>
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
        const itens = agendarItens;
        const duracao = sumDuracao(itens);
        const profSelecionado = profissionais.find(p => p.id === agendarProfissionalId);
        const profNome = profSelecionado?.nome ?? userName ?? 'Responsável da Clínica';
        const horaFim = addMinutesToTime(agendarHora, duracao);
        const dataFormatada = agendarData
          ? new Date(agendarData + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          : '';
        const row = (label: string, value: string, key?: string) => (
          <div key={key ?? label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
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
                {itens.map((item) => row('Procedimento', `${item.nome} — R$ ${item.preco.toLocaleString('pt-BR')}`, item.procedimentoId))}
                {row('Profissional', profNome)}
                {row('Data', dataFormatada)}
                {row('Horário', `${agendarHora} – ${horaFim} (${duracao} min)`)}
                {row('Valor Total', `R$ ${sumValor(itens).toLocaleString('pt-BR')}`)}
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

      {/* Modal de consentimento LGPD */}
      {showConsentimento && currentCliente && isPro && (
        <ConsentimentoLGPD
          clienteId={currentCliente.id}
          clienteNome={currentCliente.nome}
          userId={userId}
          ehMenor={ehMenorIdade}
          onConcluido={() => {
            setShowConsentimento(false);
            setLgpdConsentido(true);
            api.registrarAcessoDados({ clienteId: currentCliente.id, tipoDado: 'prontuario' }, userId).catch(() => {});
          }}
          onPular={() => {
            setShowConsentimento(false);
          }}
        />
      )}
    </div>
  );
};
