import { supabase } from './supabase';
import { ApiError, humanizeError } from './errors';
import { findAgendamentoConflict } from './agendaConflict';
import type {
  Agendamento,
  AnamneseCampo,
  ContaReceber,
  ContaReceberStatus,
  CrcAcao,
  CrcAcaoContexto,
  CrcAcaoTipo,
  CrcFalta,
  CrcSemReagendamento,
  WhatsAppBatchResult,
  WhatsAppConfig,
  WhatsAppMensagem,
  WhatsAppOptOut,
  WhatsAppProvider,
  WhatsAppStatus,
  AnamneseFormulario,
  AnamneseResposta,
  AnamneseStatus,
  BookingSettings,
  ClinicaPublica,
  Cliente,
  ClienteRetorno,
  Comissao,
  ComissaoRegra,
  ComissaoTipo,
  ConfirmacaoLog,
  ConfirmacaoSettings,
  DocumentoAssinado,
  DocumentoModelo,
  DocumentoSignatureLink,
  EvolucaoClinica,
  FechamentoComissao,
  FechamentoFinanceiro,
  FechamentoRepasse,
  FunilEtapa,
  FunilMetricas,
  GaleriaItem,
  HistoricoPresenca,
  ItemEstoque,
  EstoqueMovimentoTipo,
  EstoqueVinculo,
  EstoqueMovimento,
  Lead,
  LeadAutomacao,
  LeadHistorico,
  LeadOrigem,
  MembroEquipe,
  Orcamento,
  OrcamentoCanalFollowup,
  OrcamentoFollowupConfig,
  OrcamentoFollowupLog,
  OrcamentoItem,
  OrcamentoMotivoPerdaKey,
  OrcamentoRelatorio,
  OrcamentoStatus,
  PreviewRepasse,
  Procedimento,
  ProcedimentoPublico,
  ProfissionalPublico,
  RelatorioComissaoProfissional,
  RelatorioFaltas,
  PlanoAlertaContinuidade,
  PlanoStatus,
  PlanoTratamento,
  PrescricaoTemplate,
  PrescricaoTemplateVersao,
  PrescricaoTemplateUso,
  TemplateCategoria,
  TemplatePermissaoEdicao,
  RepasseItemSnapshot,
  RepasseModelo,
  RepasseRegra,
  RiscoFalta,
  SessaoTratamento,
  SlotOcupado,
  StatusJornada,
  TemplateMensagem,
  UserProfile,
  UserRole,
} from '../types';

async function requireUserId(passedUserId?: string): Promise<string> {
  if (passedUserId) return passedUserId;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new ApiError('Sessão inválida. Faça login novamente.', 401, 'NO_SESSION');
  }
  return data.user.id;
}

function mapCliente(row: any): Cliente {
  return {
    id: row.id,
    nome: row.nome ?? '',
    telefone: row.telefone ?? '',
    email: row.email ?? '',
    dataNascimento: row.data_nascimento ?? '',
    fotoUrl: row.foto_url ?? '',
    dataUltimaVisita: row.data_ultima_visita ?? '',
    statusRetencao: (row.status_retencao as Cliente['statusRetencao']) ?? 'em_dia',
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

function mapAgendamento(row: any): Agendamento {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNome: row.clientes?.nome ?? row.cliente_nome ?? 'Desconhecido',
    clienteFoto: row.clientes?.foto_url ?? row.cliente_foto ?? undefined,
    data: row.data,
    horaInicio: row.hora_inicio,
    horaFim: row.hora_fim,
    profissional: row.profissional ?? '',
    sala: row.sala ?? '',
    procedimento: row.procedimento ?? '',
    status: (row.status as StatusJornada) ?? 'agendada',
    tempoEsperaMinutos: row.tempo_espera_minutos ?? undefined,
    horarioChegada: row.horario_chegada ?? undefined,
    valor: row.valor !== null && row.valor !== undefined ? Number(row.valor) : 0,
    metodoPagamento: (row.metodo_pagamento as Agendamento['metodoPagamento']) ?? undefined,
    // US-007b: Confirmação
    confirmacaoMetodo: (row.confirmacao_metodo as Agendamento['confirmacaoMetodo']) ?? undefined,
    confirmacaoEnviadaEm: row.confirmacao_enviada_em ?? undefined,
    confirmacaoStatus: (row.confirmacao_status as Agendamento['confirmacaoStatus']) ?? undefined,
    confirmacaoTelefone: row.confirmacao_telefone ?? undefined,
    // US-007c: Presença/Faltas
    presencaStatus: (row.presenca_status as Agendamento['presencaStatus']) ?? undefined,
    faltaMotivo: row.falta_motivo ?? undefined,
    faltaRegistradaEm: row.falta_registrada_em ?? undefined,
  };
}

function mapEvolucao(row: any): EvolucaoClinica {
  return {
    id: row.id,
    data: row.data,
    profissional: row.profissional ?? '',
    procedimento: row.procedimento ?? '',
    relatoNatural: row.relato_natural ?? '',
    observacoesTecnicas: row.observacoes_tecnicas ?? '',
  };
}

function mapProcedimento(row: any): Procedimento {
  return {
    id: row.id,
    nome: row.nome ?? '',
    descricao: row.descricao ?? '',
    duracaoMinutos: Number(row.duracao_minutos ?? 60),
    validadeDias: Number(row.validade_dias ?? 120),
    preco: row.preco !== null && row.preco !== undefined ? Number(row.preco) : 0,
    salaRequerida: row.sala_requerida ?? '',
    profissionalResponsavel: row.profissional_responsavel ?? '',
    bookingVisivel: row.booking_visivel ?? true,
  };
}

function mapTemplate(row: any): TemplateMensagem {
  return {
    id: row.id,
    titulo: row.titulo ?? '',
    gatilho: row.gatilho ?? '',
    texto: row.texto ?? '',
  };
}

function mapGaleria(row: any): GaleriaItem {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    imagem: row.imagem ?? '',
    imagemDepois: row.imagem_depois ?? undefined,
    data: row.data ?? '',
    descricao: row.descricao ?? '',
  };
}

function mapMembroEquipe(row: any): MembroEquipe {
  return {
    id: row.id,
    nome: row.nome ?? '',
    email: row.email ?? '',
    cargo: row.cargo ?? '',
    fotoUrl: row.foto_url ?? undefined,
    ativo: row.ativo ?? true,
    bookingVisivel: row.booking_visivel ?? true,
  };
}

function mapEstoque(row: any): ItemEstoque {
  const qtd = Number(row.quantidade ?? 0);
  const qtdMin = Number(row.quantidade_minima ?? 0);
  return {
    id: row.id,
    produto: row.produto,
    quantidade: qtd,
    quantidadeMinima: qtdMin,
    unidade: row.unidade ?? 'un',
    status: qtd <= qtdMin ? 'critico' : 'normal',
    ultimaReposicao: row.ultima_reposicao ?? '',
    custoUnitario: Number(row.custo_unitario ?? 0),
    custoMedio: Number(row.custo_medio ?? 0),
    fornecedor: row.fornecedor ?? '',
    validade: row.validade ?? null,
    observacoes: row.observacoes ?? '',
  };
}

function mapFunilEtapa(row: any): FunilEtapa {
  return {
    id:     row.id,
    nome:   row.nome ?? '',
    ordem:  Number(row.ordem ?? 0),
    cor:    row.cor ?? '#6B7280',
    tipo:   (row.tipo as FunilEtapa['tipo']) ?? 'ativo',
  };
}

function mapLead(row: any): Lead {
  return {
    id:                     row.id,
    nome:                   row.nome ?? '',
    telefone:               row.telefone ?? '',
    email:                  row.email ?? '',
    procedimentoInteresse:  row.procedimento_interesse ?? '',
    origem:                 (row.origem as LeadOrigem) ?? 'outro',
    observacoes:            row.observacoes ?? '',
    etapaId:                row.etapa_id,
    etapaEntradaEm:         row.etapa_entrada_em ?? row.created_at,
    responsavelId:          row.responsavel_id ?? null,
    responsavelNome:        row.responsavel_nome ?? null,
    clienteId:              row.cliente_id ?? null,
    createdAt:              row.created_at,
    updatedAt:              row.updated_at ?? row.created_at,
  };
}

function mapLeadHistorico(row: any): LeadHistorico {
  return {
    id:               row.id,
    leadId:           row.lead_id,
    etapaAnteriorId:  row.etapa_anterior_id ?? null,
    etapaNovaId:      row.etapa_nova_id,
    usuarioNome:      row.usuario_nome ?? '',
    observacao:       row.observacao ?? null,
    tipo:             (row.tipo as LeadHistorico['tipo']) ?? 'movimentacao',
    createdAt:        row.created_at,
  };
}

function mapLeadAutomacao(row: any): LeadAutomacao {
  return {
    id:           row.id,
    etapaId:      row.etapa_id,
    tipo:         (row.tipo as LeadAutomacao['tipo']) ?? 'tarefa',
    gatilho:      (row.gatilho as LeadAutomacao['gatilho']) ?? 'ao_entrar',
    diasEspera:   row.dias_espera ?? null,
    mensagem:     row.mensagem ?? null,
    tarefaTitulo: row.tarefa_titulo ?? null,
    ativo:        Boolean(row.ativo),
  };
}

function mapComissaoRegra(row: any, equipeMap: Map<string, string>, procMap: Map<string, string>): ComissaoRegra {
  const hasProf = row.profissional_id !== null && row.profissional_id !== undefined;
  const hasProc = row.procedimento_id !== null && row.procedimento_id !== undefined;
  return {
    id: row.id,
    profissionalId: row.profissional_id ?? null,
    profissionalNome: hasProf ? (equipeMap.get(row.profissional_id) ?? 'Desconhecido') : undefined,
    procedimentoId: row.procedimento_id ?? null,
    procedimentoNome: hasProc ? (procMap.get(row.procedimento_id) ?? 'Desconhecido') : undefined,
    tipo: row.tipo as ComissaoTipo,
    valor: Number(row.valor),
    ativo: Boolean(row.ativo),
    prioridade: hasProf && hasProc ? 'especifica' : hasProf ? 'por_profissional' : 'por_procedimento',
  };
}

function mapComissao(row: any): Comissao {
  return {
    id: row.id,
    agendamentoId: row.agendamento_id,
    profissionalId: row.profissional_id ?? null,
    profissionalNome: row.profissional_nome ?? '',
    procedimentoNome: row.procedimento_nome ?? '',
    regraId: row.regra_id ?? null,
    tipo: (row.tipo as ComissaoTipo) ?? null,
    percentualAplicado: row.percentual_aplicado !== null ? Number(row.percentual_aplicado) : null,
    valorBase: Number(row.valor_base ?? 0),
    valorComissao: Number(row.valor_comissao ?? 0),
    dataAtendimento: row.data_atendimento,
    fechamentoId: row.fechamento_id ?? null,
    semRegra: Boolean(row.sem_regra),
    estornada: Boolean(row.estornada),
  };
}

function mapFechamentoComissao(row: any): FechamentoComissao {
  return {
    id: row.id,
    profissionalId: row.profissional_id ?? null,
    profissionalNome: row.profissional_nome ?? null,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    totalComissao: Number(row.total_comissao ?? 0),
    quantidadeAtendimentos: Number(row.quantidade_atendimentos ?? 0),
    fechadoEm: row.fechado_em,
    fechadoPor: row.fechado_por ?? '',
    observacoes: row.observacoes ?? undefined,
  };
}

function mapRepasseRegra(row: any): RepasseRegra {
  return {
    id: row.id,
    profissionalId: row.profissional_id,
    profissionalNome: row.profissional_nome ?? '',
    modelo: row.modelo as RepasseModelo,
    valor: Number(row.valor),
    dataInicio: row.data_inicio,
    dataFim: row.data_fim ?? null,
    ativo: Boolean(row.ativo),
  };
}

function mapFechamentoRepasse(row: any): FechamentoRepasse {
  return {
    id: row.id,
    profissionalId: row.profissional_id,
    profissionalNome: row.profissional_nome ?? '',
    modelo: row.modelo as RepasseModelo,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    totalAtendimentos: Number(row.total_atendimentos ?? 0),
    faturamentoBruto: Number(row.faturamento_bruto ?? 0),
    valorRepasseProfissional: Number(row.valor_repasse_profissional ?? 0),
    valorRetencaoClinica: Number(row.valor_retencao_clinica ?? 0),
    itensSnapshot: Array.isArray(row.itens_snapshot) ? row.itens_snapshot : [],
    fechadoEm: row.fechado_em,
    fechadoPor: row.fechado_por ?? '',
    observacoes: row.observacoes ?? undefined,
    notificacaoEnviada: Boolean(row.notificacao_enviada),
  };
}

function mapAnamneseFormulario(row: any): AnamneseFormulario {
  return {
    id: row.id,
    nome: row.nome ?? '',
    procedimentoId: row.procedimento_id ?? null,
    procedimentoNome: row.procedimento_nome ?? undefined,
    campos: (row.campos ?? []) as AnamneseCampo[],
    ativo: Boolean(row.ativo ?? true),
    createdAt: row.created_at ?? '',
  };
}

function mapDocumentoModelo(row: any): DocumentoModelo {
  return {
    id:         row.id,
    nome:       row.nome ?? '',
    tipo:       row.tipo ?? 'outro',
    conteudo:   row.conteudo ?? '',
    variaveis:  Array.isArray(row.variaveis) ? row.variaveis : [],
    ativo:      Boolean(row.ativo ?? true),
    createdAt:  row.created_at ?? '',
  };
}

function mapDocumentoAssinado(row: any): DocumentoAssinado {
  return {
    id:                 row.id,
    clienteId:          row.cliente_id,
    modeloId:           row.modelo_id ?? null,
    titulo:             row.titulo ?? '',
    conteudoFinal:      row.conteudo_final ?? '',
    hashIntegridade:    row.hash_integridade ?? '',
    assinaturaData:     row.assinatura_data ?? null,
    assinaturaMetodo:   row.assinatura_metodo ?? null,
    assinadoEm:         row.assinado_em ?? null,
    assinadoIp:         row.assinado_ip ?? null,
    assinadoDispositivo: row.assinado_dispositivo ?? null,
    profissional:       row.profissional ?? '',
    status:             row.status ?? 'pendente',
    createdAt:          row.created_at ?? '',
  };
}

function mapSignatureLink(row: any): DocumentoSignatureLink {
  return {
    id:          row.id,
    documentoId: row.documento_id,
    token:       row.token ?? '',
    expiraEm:    row.expira_em ?? '',
    usadoEm:     row.usado_em ?? null,
  };
}

function mapAnamneseResposta(row: any): AnamneseResposta {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    formularioId: row.formulario_id,
    formularioNome: row.formulario_nome ?? undefined,
    agendamentoId: row.agendamento_id ?? null,
    respostas: (row.respostas ?? {}) as AnamneseResposta['respostas'],
    status: (row.status ?? 'pendente') as AnamneseStatus,
    tokenPublico: row.token_publico ?? '',
    tokenExpiraEm: row.token_expira_em ?? null,
    assinaturaData: row.assinatura_data ?? null,
    assinadoEm: row.assinado_em ?? null,
    revisadoPor: row.revisado_por ?? null,
    revisadoEm: row.revisado_em ?? null,
    createdAt: row.created_at ?? '',
  };
}

// Calcula e registra comissão no momento do checkout (chamado internamente)
async function calcularComissaoCheckout(
  uid: string,
  ag: { id: string; profissional: string; procedimento: string; valor: number; data: string }
): Promise<void> {
  try {
    const profNome = (ag.profissional ?? '').trim();
    const procNome = (ag.procedimento ?? '').trim();

    // Busca equipe e regras em paralelo
    const [equipeRes, regrasRes, procRes] = await Promise.all([
      supabase.from('equipe').select('id, nome').eq('user_id', uid).eq('ativo', true),
      supabase.from('comissao_regras').select('*').eq('user_id', uid).eq('ativo', true),
      supabase.from('procedimentos').select('id, nome').eq('user_id', uid),
    ]);

    const equipe = equipeRes.data ?? [];
    const procedimentos = procRes.data ?? [];
    const regras = regrasRes.data ?? [];

    // Resolve IDs por nome (case-insensitive)
    const profissionalId = equipe.find(
      (e: any) => e.nome?.toLowerCase() === profNome.toLowerCase()
    )?.id ?? null;

    const procedimentoId = procedimentos.find(
      (p: any) => p.nome?.toLowerCase() === procNome.toLowerCase()
    )?.id ?? null;

    // Seleciona melhor regra pela hierarquia de prioridade
    let melhorRegra: any = null;

    if (profissionalId && procedimentoId) {
      melhorRegra = regras.find(
        (r: any) => r.profissional_id === profissionalId && r.procedimento_id === procedimentoId
      );
    }
    if (!melhorRegra && profissionalId) {
      melhorRegra = regras.find(
        (r: any) => r.profissional_id === profissionalId && r.procedimento_id === null
      );
    }
    if (!melhorRegra && procedimentoId) {
      melhorRegra = regras.find(
        (r: any) => r.profissional_id === null && r.procedimento_id === procedimentoId
      );
    }

    const valorBase = Number(ag.valor ?? 0);
    let valorComissao = 0;
    let percentualAplicado: number | null = null;

    if (melhorRegra) {
      if (melhorRegra.tipo === 'percentual') {
        percentualAplicado = Number(melhorRegra.valor);
        valorComissao = Math.round(valorBase * (percentualAplicado / 100) * 100) / 100;
      } else {
        valorComissao = Number(melhorRegra.valor);
      }
    }

    await supabase.from('comissoes').insert({
      user_id: uid,
      agendamento_id: ag.id,
      profissional_id: profissionalId,
      profissional_nome: profNome || 'Sem profissional',
      procedimento_nome: procNome || 'Sem procedimento',
      regra_id: melhorRegra?.id ?? null,
      tipo: melhorRegra?.tipo ?? null,
      percentual_aplicado: percentualAplicado,
      valor_base: valorBase,
      valor_comissao: valorComissao,
      data_atendimento: ag.data,
      sem_regra: !melhorRegra,
      estornada: false,
    });
  } catch (err) {
    // Falha no cálculo de comissão não deve bloquear o checkout
    console.error('[comissao] Erro ao calcular comissão no checkout:', err);
  }
}

async function run<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    throw humanizeError(err);
  }
}

export const api = {
  // ============================================================
  // CLIENTES
  // ============================================================
  async getClientes(userId?: string): Promise<Cliente[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', uid)
        .order('nome');
      if (error) throw error;
      return (data ?? []).map(mapCliente);
    });
  },

  async getCliente(id: string, userId?: string): Promise<Cliente | null> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', uid)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCliente(data) : null;
    });
  },

  async createCliente(cliente: Partial<Cliente>, userId?: string): Promise<Cliente> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!cliente.nome?.trim()) {
        throw new ApiError('Informe o nome do cliente para registrá-lo.', 400);
      }
      const { data, error } = await supabase
        .from('clientes')
        .insert([
          {
            user_id: uid,
            nome: cliente.nome,
            telefone: cliente.telefone ?? null,
            email: cliente.email ?? null,
            data_nascimento: cliente.dataNascimento || null,
            foto_url: cliente.fotoUrl ?? null,
            data_ultima_visita: cliente.dataUltimaVisita || null,
            status_retencao: cliente.statusRetencao ?? 'em_dia',
            tags: cliente.tags ?? [],
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return mapCliente(data);
    });
  },

  async updateCliente(id: string, updates: Partial<Cliente>, userId?: string): Promise<Cliente> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const dbUpdates: Record<string, unknown> = {};
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.telefone !== undefined) dbUpdates.telefone = updates.telefone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.dataNascimento !== undefined) dbUpdates.data_nascimento = updates.dataNascimento || null;
      if (updates.fotoUrl !== undefined) dbUpdates.foto_url = updates.fotoUrl;
      if (updates.dataUltimaVisita !== undefined)
        dbUpdates.data_ultima_visita = updates.dataUltimaVisita || null;
      if (updates.statusRetencao !== undefined) dbUpdates.status_retencao = updates.statusRetencao;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;

      const { data, error } = await supabase
        .from('clientes')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapCliente(data);
    });
  },

  async deleteCliente(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      
      // Deletar registros dependentes primeiro para evitar erro de Foreign Key
      await supabase.from('prontuarios_evolucoes').delete().eq('cliente_id', id).eq('user_id', uid);
      await supabase.from('agendamentos').delete().eq('cliente_id', id).eq('user_id', uid);

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ============================================================
  // AGENDAMENTOS
  // ============================================================
  async getAgendamentos(userId: string | undefined, dataStr: string): Promise<Agendamento[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, clientes ( nome, foto_url )')
        .eq('user_id', uid)
        .eq('data', dataStr)
        .order('hora_inicio');
      if (error) throw error;
      return (data ?? []).map(mapAgendamento);
    });
  },

  async getAgendamentosRange(
    userId: string | undefined,
    inicio: string,
    fim: string
  ): Promise<Agendamento[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, clientes ( nome, foto_url )')
        .eq('user_id', uid)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data')
        .order('hora_inicio');
      if (error) throw error;
      return (data ?? []).map(mapAgendamento);
    });
  },

  async createAgendamento(
    agendamento: Omit<Agendamento, 'id' | 'clienteNome' | 'clienteFoto'>,
    userId?: string
  ): Promise<Agendamento> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!agendamento.clienteId) {
        throw new ApiError('Selecione o cliente antes de criar o agendamento.', 400);
      }

      // Trava de conflito (autoridade): pacientes e profissionais não podem se sobrepor no mesmo horário
      const { data: existentes, error: fetchError } = await supabase
        .from('agendamentos')
        .select('*, clientes ( nome, foto_url )')
        .eq('user_id', uid)
        .eq('data', agendamento.data);
      if (fetchError) throw fetchError;

      const conflito = findAgendamentoConflict(
        {
          clienteId: agendamento.clienteId,
          profissional: agendamento.profissional,
          data: agendamento.data,
          horaInicio: agendamento.horaInicio,
          horaFim: agendamento.horaFim,
        },
        (existentes ?? []).map(mapAgendamento)
      );
      if (conflito) {
        throw new ApiError(conflito.mensagem, 409, 'AGENDAMENTO_CONFLITO');
      }

      const { data, error } = await supabase
        .from('agendamentos')
        .insert([
          {
            user_id: uid,
            cliente_id: agendamento.clienteId,
            data: agendamento.data,
            hora_inicio: agendamento.horaInicio,
            hora_fim: agendamento.horaFim,
            profissional: agendamento.profissional,
            sala: agendamento.sala,
            procedimento: agendamento.procedimento,
            status: agendamento.status,
            tempo_espera_minutos: agendamento.tempoEsperaMinutos ?? null,
            horario_chegada: agendamento.horarioChegada ?? null,
            valor: agendamento.valor,
          },
        ])
        .select('*, clientes ( nome, foto_url )')
        .single();
      if (error) throw error;
      return mapAgendamento(data);
    });
  },

  async updateAgendamentoStatus(
    id: string,
    updates: Partial<Agendamento>,
    userId?: string
  ): Promise<Agendamento> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const dbUpdates: Record<string, unknown> = {};
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.horarioChegada !== undefined) dbUpdates.horario_chegada = updates.horarioChegada;
      if (updates.tempoEsperaMinutos !== undefined)
        dbUpdates.tempo_espera_minutos = updates.tempoEsperaMinutos;
      if (updates.metodoPagamento !== undefined)
        dbUpdates.metodo_pagamento = updates.metodoPagamento;

      const { data, error } = await supabase
        .from('agendamentos')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', uid)
        .select('*, clientes ( nome, foto_url )')
        .single();
      if (error) throw error;

      if (updates.status === 'finalizada' && data?.cliente_id) {
        await supabase
          .from('clientes')
          .update({ data_ultima_visita: data.data })
          .eq('id', data.cliente_id)
          .eq('user_id', uid);

        // US-034: calcula e registra comissão automaticamente no checkout
        await calcularComissaoCheckout(uid, {
          id: data.id,
          profissional: data.profissional ?? '',
          procedimento: data.procedimento ?? '',
          valor: Number(data.valor ?? 0),
          data: data.data,
        });
      }

      return mapAgendamento(data);
    });
  },

  async updateAgendamentoDados(
    id: string,
    updates: { horaInicio?: string; horaFim?: string; procedimento?: string; profissional?: string },
    userId?: string
  ): Promise<Agendamento> {
    return run(async () => {
      const uid = await requireUserId(userId);

      // Se houver mudança que afete a alocação (hora/profissional), revalida conflitos
      const precisaValidar =
        updates.horaInicio !== undefined ||
        updates.horaFim !== undefined ||
        updates.profissional !== undefined;

      if (precisaValidar) {
        const { data: atual, error: fetchAtualErr } = await supabase
          .from('agendamentos')
          .select('*, clientes ( nome, foto_url )')
          .eq('id', id)
          .eq('user_id', uid)
          .single();
        if (fetchAtualErr) throw fetchAtualErr;
        const atualMapped = mapAgendamento(atual);

        const { data: existentes, error: listErr } = await supabase
          .from('agendamentos')
          .select('*, clientes ( nome, foto_url )')
          .eq('user_id', uid)
          .eq('data', atualMapped.data);
        if (listErr) throw listErr;

        const conflito = findAgendamentoConflict(
          {
            clienteId: atualMapped.clienteId,
            profissional: updates.profissional ?? atualMapped.profissional,
            data: atualMapped.data,
            horaInicio: updates.horaInicio ?? atualMapped.horaInicio,
            horaFim: updates.horaFim ?? atualMapped.horaFim,
          },
          (existentes ?? []).map(mapAgendamento),
          id
        );
        if (conflito) {
          throw new ApiError(conflito.mensagem, 409, 'AGENDAMENTO_CONFLITO');
        }
      }

      const dbUpdates: Record<string, unknown> = {};
      if (updates.horaInicio !== undefined) dbUpdates.hora_inicio = updates.horaInicio;
      if (updates.horaFim !== undefined) dbUpdates.hora_fim = updates.horaFim;
      if (updates.procedimento !== undefined) dbUpdates.procedimento = updates.procedimento;
      if (updates.profissional !== undefined) dbUpdates.profissional = updates.profissional;

      const { data, error } = await supabase
        .from('agendamentos')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', uid)
        .select('*, clientes ( nome, foto_url )')
        .single();
      if (error) throw error;
      return mapAgendamento(data);
    });
  },

  async deleteAgendamento(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ============================================================
  // PRONTUÁRIOS / EVOLUÇÕES
  // ============================================================
  async getEvolucoes(userId: string | undefined, clienteId: string): Promise<EvolucaoClinica[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('prontuarios_evolucoes')
        .select('*')
        .eq('user_id', uid)
        .eq('cliente_id', clienteId)
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapEvolucao);
    });
  },

  async createEvolucao(
    clienteId: string,
    evolucao: Omit<EvolucaoClinica, 'id'>,
    userId?: string
  ): Promise<EvolucaoClinica> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!clienteId) {
        throw new ApiError('Selecione um cliente para registrar a evolução.', 400);
      }
      if (!evolucao.relatoNatural?.trim()) {
        throw new ApiError('A evolução clínica precisa de um relato.', 400);
      }
      const { data, error } = await supabase
        .from('prontuarios_evolucoes')
        .insert([
          {
            user_id: uid,
            cliente_id: clienteId,
            data: evolucao.data,
            profissional: evolucao.profissional,
            procedimento: evolucao.procedimento,
            relato_natural: evolucao.relatoNatural,
            observacoes_tecnicas: evolucao.observacoesTecnicas,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return mapEvolucao(data);
    });
  },

  // ============================================================
  // ESTOQUE
  // ============================================================
  async getEstoque(userId?: string): Promise<ItemEstoque[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('estoque')
        .select('*')
        .eq('user_id', uid)
        .order('produto');
      if (error) throw error;
      return (data ?? []).map(mapEstoque);
    });
  },

  async createItemEstoque(item: Omit<ItemEstoque, 'id'>, userId?: string): Promise<ItemEstoque> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('estoque')
        .insert([{
          user_id:           uid,
          produto:           item.produto,
          quantidade:        item.quantidade,
          quantidade_minima: item.quantidadeMinima,
          unidade:           item.unidade,
          status:            item.quantidade <= item.quantidadeMinima ? 'critico' : 'normal',
          ultima_reposicao:  item.ultimaReposicao || null,
          custo_unitario:    item.custoUnitario ?? 0,
          custo_medio:       item.custoMedio ?? item.custoUnitario ?? 0,
          fornecedor:        item.fornecedor ?? '',
          validade:          item.validade ?? null,
          observacoes:       item.observacoes ?? '',
        }])
        .select()
        .single();
      if (error) throw error;
      return mapEstoque(data);
    });
  },

  async updateEstoque(
    id: string,
    quantidade: number,
    status: string,
    ultimaReposicao?: string,
    userId?: string,
    extras?: { custoUnitario?: number; custoMedio?: number; fornecedor?: string; validade?: string | null; observacoes?: string; produto?: string; quantidadeMinima?: number; unidade?: string }
  ): Promise<ItemEstoque> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const updates: Record<string, unknown> = { quantidade, status };
      if (ultimaReposicao) updates.ultima_reposicao = ultimaReposicao;
      if (extras?.custoUnitario  !== undefined) updates.custo_unitario  = extras.custoUnitario;
      if (extras?.custoMedio     !== undefined) updates.custo_medio     = extras.custoMedio;
      if (extras?.fornecedor     !== undefined) updates.fornecedor      = extras.fornecedor;
      if (extras?.validade       !== undefined) updates.validade        = extras.validade;
      if (extras?.observacoes    !== undefined) updates.observacoes     = extras.observacoes;
      if (extras?.produto        !== undefined) updates.produto         = extras.produto;
      if (extras?.quantidadeMinima !== undefined) updates.quantidade_minima = extras.quantidadeMinima;
      if (extras?.unidade        !== undefined) updates.unidade         = extras.unidade;
      const { data, error } = await supabase
        .from('estoque')
        .update(updates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapEstoque(data);
    });
  },

  async deleteItemEstoque(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('estoque')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ── US-0444: Estoque Fracionado ──────────────────────────────────────

  async getEstoqueVinculos(userId: string, produtoId?: string): Promise<EstoqueVinculo[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      let q = supabase
        .from('estoque_vinculos_procedimentos')
        .select('*, estoque(produto)')
        .eq('user_id', uid)
        .eq('ativo', true)
        .order('procedimento_nome');
      if (produtoId) q = (q as any).eq('produto_id', produtoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id:               row.id,
        userId:           row.user_id,
        produtoId:        row.produto_id,
        produtoNome:      row.estoque?.produto ?? '',
        procedimentoNome: row.procedimento_nome ?? '',
        quantidade:       Number(row.quantidade ?? 0),
        ativo:            row.ativo ?? true,
        createdAt:        row.created_at ?? '',
      }));
    });
  },

  async upsertEstoqueVinculo(
    dados: Pick<EstoqueVinculo, 'produtoId' | 'procedimentoNome' | 'quantidade'>,
    userId: string
  ): Promise<EstoqueVinculo> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('estoque_vinculos_procedimentos')
        .upsert({
          user_id:           uid,
          produto_id:        dados.produtoId,
          procedimento_nome: dados.procedimentoNome,
          quantidade:        dados.quantidade,
          ativo:             true,
        }, { onConflict: 'user_id,produto_id,procedimento_nome' })
        .select('*, estoque(produto)')
        .single();
      if (error) throw error;
      return {
        id:               data.id,
        userId:           data.user_id,
        produtoId:        data.produto_id,
        produtoNome:      (data as any).estoque?.produto ?? '',
        procedimentoNome: data.procedimento_nome,
        quantidade:       Number(data.quantidade),
        ativo:            data.ativo,
        createdAt:        data.created_at,
      };
    });
  },

  async deleteEstoqueVinculo(id: string, userId: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('estoque_vinculos_procedimentos')
        .update({ ativo: false })
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async getEstoqueMovimentos(userId: string, produtoId?: string, limit = 100): Promise<EstoqueMovimento[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      let q = supabase
        .from('estoque_movimentos')
        .select('*, estoque(produto)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (produtoId) q = (q as any).eq('produto_id', produtoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id:            row.id,
        userId:        row.user_id,
        produtoId:     row.produto_id,
        produtoNome:   row.estoque?.produto ?? '',
        tipo:          row.tipo as EstoqueMovimentoTipo,
        quantidade:    Number(row.quantidade),
        custoUnitario: Number(row.custo_unitario ?? 0),
        referencia:    row.referencia ?? null,
        agendamentoId: row.agendamento_id ?? null,
        profissional:  row.profissional ?? null,
        justificativa: row.justificativa ?? null,
        criadoPor:     row.criado_por ?? '',
        createdAt:     row.created_at ?? '',
      }));
    });
  },

  async registrarEntradaEstoque(
    produtoId: string,
    dados: { quantidade: number; custoUnitario: number; fornecedor?: string; validade?: string; criadoPor: string },
    userId: string
  ): Promise<ItemEstoque> {
    return run(async () => {
      const uid = await requireUserId(userId);
      // Fetch current state for weighted avg calculation
      const { data: curr, error: e1 } = await supabase
        .from('estoque')
        .select('quantidade, custo_medio')
        .eq('id', produtoId)
        .single();
      if (e1) throw e1;
      const qtdAtual = Number(curr.quantidade ?? 0);
      const custoAtual = Number(curr.custo_medio ?? 0);
      const novoTotal = qtdAtual + dados.quantidade;
      const novoCustoMedio = novoTotal > 0
        ? (qtdAtual * custoAtual + dados.quantidade * dados.custoUnitario) / novoTotal
        : dados.custoUnitario;
      // Update product
      const patch: Record<string, unknown> = {
        quantidade:        novoTotal,
        custo_medio:       novoCustoMedio,
        custo_unitario:    dados.custoUnitario,
        ultima_reposicao:  new Date().toISOString().split('T')[0],
        status:            'normal',
      };
      if (dados.fornecedor !== undefined) patch.fornecedor = dados.fornecedor;
      if (dados.validade   !== undefined) patch.validade   = dados.validade;
      const { data: updated, error: e2 } = await supabase
        .from('estoque')
        .update(patch)
        .eq('id', produtoId)
        .eq('user_id', uid)
        .select()
        .single();
      if (e2) throw e2;
      // Record movement
      await supabase.from('estoque_movimentos').insert({
        user_id:        uid,
        produto_id:     produtoId,
        tipo:           'entrada',
        quantidade:     dados.quantidade,
        custo_unitario: dados.custoUnitario,
        referencia:     dados.fornecedor ?? '',
        criado_por:     dados.criadoPor,
      });
      return mapEstoque(updated);
    });
  },

  async registrarAjusteEstoque(
    produtoId: string,
    dados: { quantidade: number; tipo: 'ajuste' | 'devolucao' | 'vencimento'; justificativa: string; criadoPor: string; agendamentoId?: string; profissional?: string; referencia?: string },
    userId: string
  ): Promise<ItemEstoque> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data: curr, error: e1 } = await supabase
        .from('estoque')
        .select('quantidade, quantidade_minima, custo_medio')
        .eq('id', produtoId)
        .single();
      if (e1) throw e1;
      const novaQtd = Math.max(0, Number(curr.quantidade ?? 0) + dados.quantidade);
      const qtdMin = Number(curr.quantidade_minima ?? 0);
      const { data: updated, error: e2 } = await supabase
        .from('estoque')
        .update({ quantidade: novaQtd, status: novaQtd <= qtdMin ? 'critico' : 'normal' })
        .eq('id', produtoId)
        .eq('user_id', uid)
        .select()
        .single();
      if (e2) throw e2;
      await supabase.from('estoque_movimentos').insert({
        user_id:        uid,
        produto_id:     produtoId,
        tipo:           dados.tipo,
        quantidade:     dados.quantidade,
        custo_unitario: Number(curr.custo_medio ?? 0),
        referencia:     dados.referencia ?? null,
        agendamento_id: dados.agendamentoId ?? null,
        profissional:   dados.profissional ?? null,
        justificativa:  dados.justificativa,
        criado_por:     dados.criadoPor,
      });
      return mapEstoque(updated);
    });
  },

  async baixarEstoqueCheckout(
    agendamentoId: string,
    procedimentoNome: string,
    profissionalNome: string,
    userId: string,
    quantidadesOverride?: Record<string, number>
  ): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      // Fetch linked products for this procedure
      const { data: vinculos, error: e1 } = await supabase
        .from('estoque_vinculos_procedimentos')
        .select('produto_id, quantidade')
        .eq('user_id', uid)
        .eq('procedimento_nome', procedimentoNome)
        .eq('ativo', true);
      if (e1) throw e1;
      if (!vinculos || vinculos.length === 0) return;
      for (const v of vinculos) {
        const qtdConsumir = quantidadesOverride?.[v.produto_id] ?? Number(v.quantidade);
        if (qtdConsumir <= 0) continue;
        const { data: curr } = await supabase
          .from('estoque')
          .select('quantidade, quantidade_minima, custo_medio')
          .eq('id', v.produto_id)
          .single();
        if (!curr) continue;
        const novaQtd = Math.max(0, Number(curr.quantidade) - qtdConsumir);
        const qtdMin = Number(curr.quantidade_minima ?? 0);
        await supabase
          .from('estoque')
          .update({ quantidade: novaQtd, status: novaQtd <= qtdMin ? 'critico' : 'normal' })
          .eq('id', v.produto_id);
        await supabase.from('estoque_movimentos').insert({
          user_id:        uid,
          produto_id:     v.produto_id,
          tipo:           'saida',
          quantidade:     -qtdConsumir,
          custo_unitario: Number(curr.custo_medio ?? 0),
          referencia:     procedimentoNome,
          agendamento_id: agendamentoId,
          profissional:   profissionalNome,
          justificativa:  'Baixa automática no checkout',
          criado_por:     profissionalNome,
        });
      }
    });
  },

  // ============================================================
  // PERFIL DO USUÁRIO
  // ============================================================
  async getPerfil(userId?: string) {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    });
  },

  // Retorna perfil simplificado + resolve tenantId para membros da equipe.
  // Inclui auto-recuperação via RPC para casos em que o trigger de banco
  // não detectou corretamente que o usuário é membro de equipe.
  async getUserProfile(userId?: string): Promise<UserProfile> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('usuarios')
        .select('nome, nome_clinica, foto_url, role, owner_id')
        .eq('id', uid)
        .maybeSingle();
      if (error) throw error;

      let role = (data?.role as UserRole) ?? 'dono';
      let ownerId: string | null = data?.owner_id ?? null;

      // Self-healing: se o registro não indica 'equipe', consulta a RPC
      // resolve_equipe_owner() que lê auth.users + equipe sem RLS e
      // corrige o banco in-place se necessário.
      if (role !== 'equipe') {
        try {
          const { data: resolvedOwner } = await supabase.rpc('resolve_equipe_owner');
          if (resolvedOwner) {
            role = 'equipe';
            ownerId = resolvedOwner as string;
          }
        } catch {
          // RPC ainda não existe no banco — ignora silenciosamente.
        }
      }

      const tenantId = role === 'equipe' && ownerId ? ownerId : uid;

      let equipeNome: string | undefined;
      let equipeFotoUrl: string | undefined;
      let cargo: string | undefined;
      let nomeClinica: string | undefined;

      if (role === 'equipe' && ownerId) {
        // Get the member's email from the live session (no extra network call).
        const { data: authUser } = await supabase.auth.getUser();
        const memberEmail = authUser?.user?.email;

        if (memberEmail) {
          // equipe RLS uses get_tenant_id() = ownerId, so this query is allowed.
          const { data: equipeRow } = await supabase
            .from('equipe')
            .select('nome, cargo, foto_url')
            .eq('user_id', ownerId)
            .ilike('email', memberEmail)
            .maybeSingle();
          equipeNome  = equipeRow?.nome    ?? undefined;
          cargo       = equipeRow?.cargo   ?? undefined;
          equipeFotoUrl = equipeRow?.foto_url ?? undefined;
        }

        // usuarios_select RLS: id = get_tenant_id() = ownerId — equipe can read owner row.
        const { data: ownerRow } = await supabase
          .from('usuarios')
          .select('nome_clinica')
          .eq('id', ownerId)
          .maybeSingle();
        nomeClinica = ownerRow?.nome_clinica ?? undefined;
      } else {
        // Dono: clinic name comes from their own row (already fetched above).
        nomeClinica = data?.nome_clinica ?? undefined;
      }

      return {
        nome: equipeNome || data?.nome || '',
        fotoUrl: equipeFotoUrl || data?.foto_url || '',
        role,
        tenantId,
        cargo,
        nomeClinica,
      };
    });
  },

  async upsertPerfil(
    perfil: {
      nome?: string;
      nome_clinica?: string;
      telefone?: string;
      telefone_pessoal?: string;
      endereco?: string;
      email?: string;
      data_nascimento?: string;
      foto_url?: string;
    },
    userId?: string
  ) {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('usuarios')
        .upsert({ id: uid, ...perfil }, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  // Upload de foto de perfil para o bucket "avatars".
  // Requer que o bucket exista e seja público no painel Supabase.
  async uploadFotoPerfil(file: File, userId?: string): Promise<string> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${uid}/profile.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // Adiciona cache-bust para forçar atualização da imagem no browser.
      return `${data.publicUrl}?t=${Date.now()}`;
    });
  },


  // ============================================================
  // PROCEDIMENTOS
  // ============================================================
  async getProcedimentos(userId?: string): Promise<Procedimento[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('procedimentos')
        .select('*')
        .eq('user_id', uid)
        .order('nome');
      if (error) throw error;
      return (data ?? []).map(mapProcedimento);
    });
  },

  async createProcedimento(
    procedimento: Omit<Procedimento, 'id'>,
    userId?: string
  ): Promise<Procedimento> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!procedimento.nome?.trim()) {
        throw new ApiError('Informe o nome do procedimento.', 400);
      }
      const { data, error } = await supabase
        .from('procedimentos')
        .insert([{
          user_id: uid,
          nome: procedimento.nome,
          descricao: procedimento.descricao ?? null,
          duracao_minutos: procedimento.duracaoMinutos,
          validade_dias: procedimento.validadeDias,
          preco: procedimento.preco,
          sala_requerida: procedimento.salaRequerida,
          profissional_responsavel: procedimento.profissionalResponsavel,
        }])
        .select()
        .single();
      if (error) throw error;
      return mapProcedimento(data);
    });
  },

  async updateProcedimento(
    id: string,
    updates: Partial<Procedimento>,
    userId?: string
  ): Promise<Procedimento> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const dbUpdates: Record<string, unknown> = {};
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.descricao !== undefined) dbUpdates.descricao = updates.descricao;
      if (updates.duracaoMinutos !== undefined) dbUpdates.duracao_minutos = updates.duracaoMinutos;
      if (updates.validadeDias !== undefined) dbUpdates.validade_dias = updates.validadeDias;
      if (updates.preco !== undefined) dbUpdates.preco = updates.preco;
      if (updates.salaRequerida !== undefined) dbUpdates.sala_requerida = updates.salaRequerida;
      if (updates.profissionalResponsavel !== undefined)
        dbUpdates.profissional_responsavel = updates.profissionalResponsavel;
      const { data, error } = await supabase
        .from('procedimentos')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapProcedimento(data);
    });
  },

  async deleteProcedimento(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('procedimentos')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ============================================================
  // EQUIPE (membros profissionais da clínica)
  // ============================================================
  async getEquipe(userId?: string, opts?: { somenteAtivos?: boolean }): Promise<MembroEquipe[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      let query = supabase
        .from('equipe')
        .select('*')
        .eq('user_id', uid)
        .order('nome');
      if (opts?.somenteAtivos) query = query.eq('ativo', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapMembroEquipe);
    });
  },

  async createMembroEquipe(
    membro: Omit<MembroEquipe, 'id'>,
    userId?: string
  ): Promise<MembroEquipe> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!membro.nome?.trim()) {
        throw new ApiError('Informe o nome do membro da equipe.', 400);
      }
      const { data, error } = await supabase
        .from('equipe')
        .insert([{
          user_id: uid,
          nome: membro.nome,
          email: membro.email || null,
          cargo: membro.cargo || null,
          foto_url: membro.fotoUrl || null,
          ativo: membro.ativo ?? true,
        }])
        .select()
        .single();
      if (error) throw error;
      return mapMembroEquipe(data);
    });
  },

  async updateMembroEquipe(
    id: string,
    updates: Partial<MembroEquipe>,
    userId?: string
  ): Promise<MembroEquipe> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const dbUpdates: Record<string, unknown> = {};
      if (updates.nome !== undefined)    dbUpdates.nome    = updates.nome;
      if (updates.email !== undefined)   dbUpdates.email   = updates.email || null;
      if (updates.cargo !== undefined)   dbUpdates.cargo   = updates.cargo || null;
      if (updates.fotoUrl !== undefined) dbUpdates.foto_url = updates.fotoUrl || null;
      if (updates.ativo !== undefined)   dbUpdates.ativo   = updates.ativo;
      const { data, error } = await supabase
        .from('equipe')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapMembroEquipe(data);
    });
  },

  async deleteMembroEquipe(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('equipe')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ============================================================
  // TEMPLATES DE MENSAGENS
  // ============================================================
  async getTemplatesMensagens(userId?: string): Promise<TemplateMensagem[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('templates_mensagens')
        .select('*')
        .eq('user_id', uid)
        .order('titulo');
      if (error) throw error;
      return (data ?? []).map(mapTemplate);
    });
  },

  async createTemplateMensagem(
    template: Omit<TemplateMensagem, 'id'>,
    userId?: string
  ): Promise<TemplateMensagem> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!template.titulo?.trim() || !template.texto?.trim()) {
        throw new ApiError('Informe título e texto do template.', 400);
      }
      const { data, error } = await supabase
        .from('templates_mensagens')
        .insert([
          {
            user_id: uid,
            titulo: template.titulo,
            gatilho: template.gatilho,
            texto: template.texto,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return mapTemplate(data);
    });
  },

  async updateTemplateMensagem(
    id: string,
    updates: Partial<TemplateMensagem>,
    userId?: string
  ): Promise<TemplateMensagem> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const dbUpdates: Record<string, unknown> = {};
      if (updates.titulo !== undefined) dbUpdates.titulo = updates.titulo;
      if (updates.gatilho !== undefined) dbUpdates.gatilho = updates.gatilho;
      if (updates.texto !== undefined) dbUpdates.texto = updates.texto;
      const { data, error } = await supabase
        .from('templates_mensagens')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapTemplate(data);
    });
  },

  async deleteTemplateMensagem(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('templates_mensagens')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ============================================================
  // GALERIA DE EVOLUÇÃO POR IMAGEM
  // ============================================================
  async getGaleria(userId: string | undefined, clienteId: string): Promise<GaleriaItem[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('galeria_antes_depois')
        .select('*')
        .eq('user_id', uid)
        .eq('cliente_id', clienteId)
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapGaleria);
    });
  },

  async createGaleriaItem(
    clienteId: string,
    item: Omit<GaleriaItem, 'id' | 'clienteId'>,
    userId?: string
  ): Promise<GaleriaItem> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!item.imagem) {
        throw new ApiError('Selecione a imagem "Antes" para registrar a comparação.', 400);
      }
      const { data, error } = await supabase
        .from('galeria_antes_depois')
        .insert([
          {
            user_id: uid,
            cliente_id: clienteId,
            imagem: item.imagem,
            imagem_depois: item.imagemDepois ?? null,
            data: item.data,
            descricao: item.descricao,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return mapGaleria(data);
    });
  },

  async deleteGaleriaItem(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('galeria_antes_depois')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async createGaleriaShareLink(
    clienteId: string,
    userId?: string
  ): Promise<{ token: string; expiraEm: string }> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const token = crypto.randomUUID();
      const { data, error } = await supabase
        .from('galeria_compartilhamentos')
        .insert([{ token, user_id: uid, cliente_id: clienteId }])
        .select('token, expira_em')
        .single();
      if (error) throw error;
      return { token: data.token, expiraEm: data.expira_em };
    });
  },

  async getGaleriaPublica(token: string): Promise<{
    items: GaleriaItem[];
    clienteNome: string;
    clinicaNome: string;
    expiraEm: string;
  } | null> {
    const { data, error } = await supabase.rpc('get_galeria_publica', { p_token: token });
    if (error || !data || data.erro) return null;
    return {
      items: (data.items ?? []).map((g: any) => ({
        id: g.id,
        clienteId: '',
        imagem: g.imagem ?? '',
        imagemDepois: g.imagem_depois ?? undefined,
        data: g.data ?? '',
        descricao: g.descricao ?? '',
      })),
      clienteNome: data.cliente_nome ?? 'Paciente',
      clinicaNome: data.clinica_nome ?? 'Clínica',
      expiraEm: data.expira_em ?? '',
    };
  },

  // ============================================================
  // FECHAMENTO FINANCEIRO (agregado a partir de agendamentos finalizados)
  // ============================================================
  async getFechamentoFinanceiro(
    userId: string | undefined,
    dataStr: string
  ): Promise<FechamentoFinanceiro> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const [agRes, comRes] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('valor, metodo_pagamento')
          .eq('user_id', uid)
          .eq('data', dataStr)
          .eq('status', 'finalizada'),
        supabase
          .from('comissoes')
          .select('valor_comissao')
          .eq('user_id', uid)
          .eq('data_atendimento', dataStr)
          .eq('estornada', false),
      ]);
      if (agRes.error) throw agRes.error;

      const rows = agRes.data ?? [];
      const faturamentoTotal = rows.reduce((sum, r: any) => sum + Number(r.valor || 0), 0);
      const comissoesPagas = Math.round(
        (comRes.data ?? []).reduce((sum, r: any) => sum + Number(r.valor_comissao || 0), 0) * 100
      ) / 100;

      const metodosLabel: Record<string, string> = {
        pix: 'Pix',
        credito: 'Cartão de Crédito',
        debito: 'Cartão de Débito',
        dinheiro: 'Dinheiro',
      };
      const buckets: Record<string, number> = {};
      for (const r of rows as any[]) {
        const key = (r.metodo_pagamento as string) || 'nao_informado';
        buckets[key] = (buckets[key] ?? 0) + Number(r.valor || 0);
      }
      const formasPagamento = Object.entries(buckets)
        .map(([metodo, valor]) => ({
          metodo: metodosLabel[metodo] ?? 'Não informado',
          valor,
          percentual: faturamentoTotal > 0 ? Math.round((valor / faturamentoTotal) * 100) : 0,
        }))
        .sort((a, b) => b.valor - a.valor);

      return { faturamentoTotal, comissoesPagas, formasPagamento };
    });
  },

  async getFechamentoFinanceiroRange(
    userId: string | undefined,
    inicio: string,
    fim: string
  ): Promise<FechamentoFinanceiro> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const [agRes, comRes] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('valor, metodo_pagamento')
          .eq('user_id', uid)
          .gte('data', inicio)
          .lte('data', fim)
          .eq('status', 'finalizada'),
        supabase
          .from('comissoes')
          .select('valor_comissao')
          .eq('user_id', uid)
          .gte('data_atendimento', inicio)
          .lte('data_atendimento', fim)
          .eq('estornada', false),
      ]);
      if (agRes.error) throw agRes.error;

      const rows = agRes.data ?? [];
      const faturamentoTotal = rows.reduce((sum, r: any) => sum + Number(r.valor || 0), 0);
      const comissoesPagas = Math.round(
        (comRes.data ?? []).reduce((sum, r: any) => sum + Number(r.valor_comissao || 0), 0) * 100
      ) / 100;

      const metodosLabel: Record<string, string> = {
        pix: 'Pix',
        credito: 'Cartão de Crédito',
        debito: 'Cartão de Débito',
        dinheiro: 'Dinheiro',
      };
      const buckets: Record<string, number> = {};
      for (const r of rows as any[]) {
        const key = (r.metodo_pagamento as string) || 'nao_informado';
        buckets[key] = (buckets[key] ?? 0) + Number(r.valor || 0);
      }
      const formasPagamento = Object.entries(buckets)
        .map(([metodo, valor]) => ({
          metodo: metodosLabel[metodo] ?? 'Não informado',
          valor,
          percentual: faturamentoTotal > 0 ? Math.round((valor / faturamentoTotal) * 100) : 0,
        }))
        .sort((a, b) => b.valor - a.valor);

      return { faturamentoTotal, comissoesPagas, formasPagamento };
    });
  },

  // ============================================================
  // CLIENTES EM RETORNO (computado a partir de agendamentos + procedimentos)
  // ============================================================
  async getClientesRetorno(userId?: string): Promise<ClienteRetorno[]> {
    return run(async () => {
      const uid = await requireUserId(userId);

      const [procRes, agRes, tplRes] = await Promise.all([
        supabase.from('procedimentos').select('*').eq('user_id', uid),
        supabase
          .from('agendamentos')
          .select('id, cliente_id, data, procedimento, status, clientes ( nome, telefone )')
          .eq('user_id', uid)
          .eq('status', 'finalizada')
          .order('data', { ascending: false }),
        supabase.from('templates_mensagens').select('id, titulo, gatilho').eq('user_id', uid),
      ]);
      if (procRes.error) throw procRes.error;
      if (agRes.error) throw agRes.error;
      if (tplRes.error) throw tplRes.error;

      const procedimentos = (procRes.data ?? []).map(mapProcedimento);
      const templates = tplRes.data ?? [];

      // Encontrar o template "ausente prolongada" e "retorno por validade"
      const tplAusencia =
        templates.find((t: any) => /ausen|resgate/i.test(t.titulo))?.id ??
        templates[0]?.id ?? '';
      const tplRetorno =
        templates.find((t: any) => /retorno|validade/i.test(t.titulo))?.id ??
        templates[0]?.id ?? '';

      // Pega o último atendimento por cliente
      const ultimoPorCliente = new Map<string, any>();
      for (const ag of agRes.data ?? []) {
        if (!ultimoPorCliente.has(ag.cliente_id)) {
          ultimoPorCliente.set(ag.cliente_id, ag);
        }
      }

      const hoje = new Date();
      const hojeMs = hoje.getTime();
      const retornos: ClienteRetorno[] = [];

      for (const [clienteId, ag] of ultimoPorCliente) {
        const dataUltima = new Date(ag.data + 'T00:00:00');
        const diffDias = Math.floor((hojeMs - dataUltima.getTime()) / (1000 * 60 * 60 * 24));
        const proc = procedimentos.find((p) => p.nome === ag.procedimento);
        const validade = proc?.validadeDias ?? 0;

        let motivoAlerta = '';
        let templateId = '';

        if (validade > 0 && diffDias >= validade) {
          motivoAlerta = `${proc?.nome ?? 'Procedimento'} vencido (${diffDias} dias)`;
          templateId = tplRetorno;
        } else if (diffDias >= 60) {
          motivoAlerta = `Ausência prolongada (${diffDias} dias)`;
          templateId = tplAusencia;
        } else {
          continue;
        }

        retornos.push({
          id: `r_${clienteId}`,
          clienteId,
          clienteNome: ag.clientes?.nome ?? 'Cliente',
          telefone: ag.clientes?.telefone ?? '',
          ultimoProcedimento: ag.procedimento ?? '',
          dataUltimoProcedimento: ag.data,
          motivoAlerta,
          tempoAusenciaDias: diffDias,
          templateSugeridoId: templateId,
        });
      }

      // Ordena por urgência (mais tempo de ausência primeiro)
      retornos.sort((a, b) => b.tempoAusenciaDias - a.tempoAusenciaDias);
      return retornos;
    });
  },

  // ============================================================
  // AGENDAMENTO ONLINE — acesso público (sem auth)
  // ============================================================
  async getClinicaBySlug(slug: string): Promise<ClinicaPublica | null> {
    const { data, error } = await supabase.rpc('get_clinic_by_slug', { p_slug: slug });
    if (error) throw humanizeError(error);
    return (data as ClinicaPublica) ?? null;
  },

  async getProfissionaisPublicos(userId: string): Promise<ProfissionalPublico[]> {
    const { data, error } = await supabase.rpc('get_public_professionals', { p_user_id: userId });
    if (error) throw humanizeError(error);
    return (data as ProfissionalPublico[]) ?? [];
  },

  async getProcedimentosPublicos(userId: string): Promise<ProcedimentoPublico[]> {
    const { data, error } = await supabase.rpc('get_public_procedures', { p_user_id: userId });
    if (error) throw humanizeError(error);
    return (data as ProcedimentoPublico[]) ?? [];
  },

  async getSlotsOcupados(userId: string, date: string, profissional: string): Promise<SlotOcupado[]> {
    const { data, error } = await supabase.rpc('get_booked_slots', {
      p_user_id:      userId,
      p_date:         date,
      p_profissional: profissional,
    });
    if (error) throw humanizeError(error);
    return (data as SlotOcupado[]) ?? [];
  },

  async createPublicBooking(params: {
    clinicSlug:         string;
    profissional:       string;
    procedimento:       string;
    data:               string;
    horaInicio:         string;
    horaFim:            string;
    sala:               string;
    valor:              number;
    pacienteNome:       string;
    pacienteTelefone:   string;
    pacienteEmail:      string;
  }): Promise<{ id: string }> {
    const { data, error } = await supabase.rpc('create_public_booking', {
      p_clinic_slug:        params.clinicSlug,
      p_profissional:       params.profissional,
      p_procedimento:       params.procedimento,
      p_data:               params.data,
      p_hora_inicio:        params.horaInicio,
      p_hora_fim:           params.horaFim,
      p_sala:               params.sala,
      p_valor:              params.valor,
      p_paciente_nome:      params.pacienteNome,
      p_paciente_telefone:  params.pacienteTelefone,
      p_paciente_email:     params.pacienteEmail,
    });
    if (error) throw humanizeError(error);
    return data as { id: string };
  },

  // ============================================================
  // CONFIGURAÇÕES DE AGENDAMENTO ONLINE (autenticado)
  // ============================================================
  async getBookingSettings(userId?: string): Promise<BookingSettings> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('usuarios')
        .select('booking_slug, booking_enabled, booking_min_advance_horas, booking_max_advance_dias')
        .eq('id', uid)
        .single();
      if (error) throw error;
      return {
        bookingSlug:              data.booking_slug ?? null,
        bookingEnabled:           data.booking_enabled ?? false,
        bookingMinAdvanceHoras:   data.booking_min_advance_horas ?? 1,
        bookingMaxAdvanceDias:    data.booking_max_advance_dias ?? 30,
      };
    });
  },

  async updateBookingSettings(settings: Partial<BookingSettings>, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const updates: Record<string, unknown> = {};
      if (settings.bookingSlug !== undefined)
        updates.booking_slug = settings.bookingSlug || null;
      if (settings.bookingEnabled !== undefined)
        updates.booking_enabled = settings.bookingEnabled;
      if (settings.bookingMinAdvanceHoras !== undefined)
        updates.booking_min_advance_horas = settings.bookingMinAdvanceHoras;
      if (settings.bookingMaxAdvanceDias !== undefined)
        updates.booking_max_advance_dias = settings.bookingMaxAdvanceDias;
      const { error } = await supabase.from('usuarios').update(updates).eq('id', uid);
      if (error) throw error;
    });
  },

  async updateProcedimentoBookingVisivel(id: string, visivel: boolean, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('procedimentos')
        .update({ booking_visivel: visivel })
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async updateEquipeBookingVisivel(id: string, visivel: boolean, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('equipe')
        .update({ booking_visivel: visivel })
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ============================================================
  // SEED de dados padrão (fallback client-side caso o trigger DB falhe)
  // ============================================================
  async ensureSeedData(userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);

      // Membros da equipe usam o tenant do dono (uid != auth.uid()).
      // Nunca semear dados em nome de outra conta.
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id && authData.user.id !== uid) return;
      const [{ count: procCount }, { count: tplCount }] = await Promise.all([
        supabase.from('procedimentos').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('templates_mensagens').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      ]);

      if ((procCount ?? 0) === 0) {
        await supabase.from('procedimentos').insert([
          { user_id: uid, nome: 'Toxina Botulínica (Botox)', duracao_minutos: 45, validade_dias: 120, preco: 1200, sala_requerida: 'Cabine 01 - Clínica', profissional_responsavel: 'Dra. Helena Martins' },
          { user_id: uid, nome: 'Lavieen (Pele de Porcelana)', duracao_minutos: 60, validade_dias: 90, preco: 800, sala_requerida: 'Cabine 02 - Tecnologias', profissional_responsavel: 'Esteticista Sarah Kelly' },
          { user_id: uid, nome: 'Preenchimento com Ácido Hialurônico', duracao_minutos: 60, validade_dias: 360, preco: 1600, sala_requerida: 'Cabine 01 - Clínica', profissional_responsavel: 'Dra. Helena Martins' },
          { user_id: uid, nome: 'Bioestimulador de Colágeno (Radiesse)', duracao_minutos: 75, validade_dias: 360, preco: 2200, sala_requerida: 'Cabine 01 - Clínica', profissional_responsavel: 'Dra. Helena Martins' },
          { user_id: uid, nome: 'Peeling Químico Renovador', duracao_minutos: 45, validade_dias: 30, preco: 450, sala_requerida: 'Cabine 03 - Facial', profissional_responsavel: 'Esteticista Sarah Kelly' },
        ]);
      }

      if ((tplCount ?? 0) === 0) {
        await supabase.from('templates_mensagens').insert([
          { user_id: uid, titulo: 'Retorno de Toxina Botulínica (120 dias)', gatilho: 'Vencimento do efeito do procedimento', texto: 'Olá, {nome}. Como você está? ✨ Há cerca de 4 meses cuidamos do seu rosto com a Toxina Botulínica. O efeito protetor da musculatura costuma atenuar por agora. O que acha de reservarmos um momento esta semana para uma avaliação e mantermos sua expressão sempre descansada e rejuvenescida?' },
          { user_id: uid, titulo: 'Boas-vindas pós-procedimento (24h)', gatilho: 'Dia seguinte ao tratamento', texto: 'Olá, {nome}! Passando para saber como está se sentindo após o procedimento de ontem. Lembre-se de seguir as orientações personalizadas que deixamos no seu prontuário e caprichar no filtro solar. Se tiver qualquer dúvida, estamos à inteira disposição. Um abraço carinhoso!' },
          { user_id: uid, titulo: 'Resgate de Cliente Ausente (60 dias)', gatilho: 'Mais de 60 dias sem visitas', texto: 'Olá, {nome}! Sentimos sua falta na clínica nas últimas semanas. 🌸 Preparamos um carinho especial para o seu retorno: uma sessão exclusiva do nosso protocolo Glow Facial como cortesia ao agendar seu próximo cuidado. Qual dia fica melhor para reservarmos sua cabine?' },
        ]);
      }
    });
  },

  // ============================================================
  // CONFIRMAÇÕES AUTOMÁTICAS (US-007b)
  // ============================================================
  async getConfirmacaoSettings(userId?: string): Promise<ConfirmacaoSettings> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .rpc('get_confirmation_settings', { p_user_id: uid });
      if (error) throw error;
      return data ?? {
        confirmacaoHabilitada: true,
        confirmacaoMetodoPadrao: 'whatsapp',
        confirmacaoHorasAntes: 48,
        confirmacaoHorasAntes2: 2,
      };
    });
  },

  async updateConfirmacaoSettings(
    settings: Partial<ConfirmacaoSettings>,
    userId?: string
  ): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const current = await this.getConfirmacaoSettings(uid);
      const merged = { ...current, ...settings };

      const { error } = await supabase
        .rpc('update_confirmation_settings', {
          p_user_id: uid,
          p_habilitada: merged.confirmacaoHabilitada,
          p_metodo_padrao: merged.confirmacaoMetodoPadrao,
          p_horas_antes: merged.confirmacaoHorasAntes,
          p_horas_antes_2: merged.confirmacaoHorasAntes2,
        });
      if (error) throw error;
    });
  },

  async logConfirmacaoSent(
    agendamentoId: string,
    metodo: 'whatsapp' | 'sms',
    telefone: string,
    mensagem: string,
    status: 'enviada' | 'entregue' | 'erro' = 'enviada',
    userId?: string
  ): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .rpc('log_confirmation_sent', {
          p_user_id: uid,
          p_agendamento_id: agendamentoId,
          p_metodo: metodo,
          p_telefone: telefone,
          p_mensagem: mensagem,
          p_status: status,
        });
      if (error) throw error;
    });
  },

  async getPendingConfirmacoes(horasProximas: number = 48, userId?: string): Promise<any[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .rpc('get_pending_confirmations', {
          p_user_id: uid,
          p_horas_proximas: horasProximas,
        });
      if (error) throw error;
      return data ?? [];
    });
  },

  async getConfirmacaoLog(agendamentoId: string, userId?: string): Promise<ConfirmacaoLog[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('confirmacoes_log')
        .select('*')
        .eq('agendamento_id', agendamentoId)
        .eq('user_id', uid)
        .order('enviada_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        agendamentoId: row.agendamento_id,
        metodo: row.metodo,
        telefone: row.telefone,
        mensagem: row.mensagem,
        status: row.status,
        erroMensagem: row.erro_mensagem,
        enviadaEm: row.enviada_em,
      }));
    });
  },

  // ============================================================
  // CONTROLE DE PRESENÇA/FALTAS (US-007c)
  // ============================================================
  async registerAttendance(
    agendamentoId: string,
    presencaStatus: 'compareceu' | 'faltou' | 'desmarcou',
    motivo?: string,
    userId?: string
  ): Promise<void> {
    return run(async () => {
      await requireUserId(userId);
      const { error } = await supabase
        .rpc('register_attendance', {
          p_agendamento_id: agendamentoId,
          p_presenca_status: presencaStatus,
          p_motivo: motivo ?? null,
        });
      if (error) throw error;
    });
  },

  async getAttendanceHistory(clienteId: string, userId?: string): Promise<HistoricoPresenca[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .rpc('get_attendance_history', {
          p_cliente_id: clienteId,
          p_user_id: uid,
        });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        agendamentoId: row.agendamentoId,
        data: row.data,
        horaInicio: row.horaInicio,
        profissional: row.profissional,
        procedimento: row.procedimento,
        presencaStatus: row.presencaStatus,
        faltaMotivo: row.faltaMotivo,
        faltaRegistradaEm: row.faltaRegistradaEm,
      }));
    });
  },

  async getNoShowRisk(clienteId: string, userId?: string): Promise<RiscoFalta> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .rpc('get_no_show_count_60days', {
          p_cliente_id: clienteId,
          p_user_id: uid,
        });
      if (error) throw error;
      return {
        faltasUltimos60dias: data.faltasUltimos60dias ?? 0,
        totalComparecimentos: data.totalComparecimentos ?? 0,
        temRisco: data.temRisco ?? false,
      };
    });
  },

  async getNoShowReport(dataInicio: string, dataFim: string, userId?: string): Promise<RelatorioFaltas> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .rpc('get_no_show_report', {
          p_user_id: uid,
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
        });
      if (error) throw error;
      return {
        totalFaltas: data.totalFaltas ?? 0,
        totalAgendamentos: data.totalAgendamentos ?? 0,
        taxaFaltas: data.taxaFaltas ?? 0,
        faltasPorProfissional: data.faltasPorProfissional ?? {},
        faltasPorProcedimento: data.faltasPorProcedimento ?? {},
      };
    });
  },
  // ============================================================
  // COMISSÕES (US-034)
  // ============================================================

  async getComissaoRegras(userId?: string): Promise<ComissaoRegra[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const [regrasRes, equipeRes, procRes] = await Promise.all([
        supabase.from('comissao_regras').select('*').eq('user_id', uid).order('created_at'),
        supabase.from('equipe').select('id, nome').eq('user_id', uid),
        supabase.from('procedimentos').select('id, nome').eq('user_id', uid),
      ]);
      if (regrasRes.error) throw regrasRes.error;

      const equipeMap = new Map((equipeRes.data ?? []).map((e: any) => [e.id, e.nome]));
      const procMap = new Map((procRes.data ?? []).map((p: any) => [p.id, p.nome]));
      return (regrasRes.data ?? []).map((r: any) => mapComissaoRegra(r, equipeMap, procMap));
    });
  },

  async createComissaoRegra(
    regra: Omit<ComissaoRegra, 'id' | 'prioridade' | 'profissionalNome' | 'procedimentoNome'>,
    userId?: string
  ): Promise<ComissaoRegra> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!regra.profissionalId && !regra.procedimentoId) {
        throw new ApiError('Defina ao menos um profissional ou procedimento para a regra.', 400);
      }
      const { data, error } = await supabase
        .from('comissao_regras')
        .insert({
          user_id: uid,
          profissional_id: regra.profissionalId ?? null,
          procedimento_id: regra.procedimentoId ?? null,
          tipo: regra.tipo,
          valor: regra.valor,
          ativo: regra.ativo,
        })
        .select()
        .single();
      if (error) throw error;
      const [equipeRes, procRes] = await Promise.all([
        supabase.from('equipe').select('id, nome').eq('user_id', uid),
        supabase.from('procedimentos').select('id, nome').eq('user_id', uid),
      ]);
      const equipeMap = new Map((equipeRes.data ?? []).map((e: any) => [e.id, e.nome]));
      const procMap = new Map((procRes.data ?? []).map((p: any) => [p.id, p.nome]));
      return mapComissaoRegra(data, equipeMap, procMap);
    });
  },

  async updateComissaoRegra(
    id: string,
    updates: Partial<Omit<ComissaoRegra, 'id' | 'prioridade' | 'profissionalNome' | 'procedimentoNome'>>,
    userId?: string
  ): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const dbUpdates: Record<string, unknown> = {};
      if (updates.profissionalId !== undefined) dbUpdates.profissional_id = updates.profissionalId ?? null;
      if (updates.procedimentoId !== undefined) dbUpdates.procedimento_id = updates.procedimentoId ?? null;
      if (updates.tipo !== undefined) dbUpdates.tipo = updates.tipo;
      if (updates.valor !== undefined) dbUpdates.valor = updates.valor;
      if (updates.ativo !== undefined) dbUpdates.ativo = updates.ativo;
      const { error } = await supabase
        .from('comissao_regras')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async deleteComissaoRegra(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('comissao_regras')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async getRelatorioComissoes(
    userId: string | undefined,
    filtros: { inicio: string; fim: string; profissionalId?: string | null }
  ): Promise<RelatorioComissaoProfissional[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      let q = supabase
        .from('comissoes')
        .select('*')
        .eq('user_id', uid)
        .gte('data_atendimento', filtros.inicio)
        .lte('data_atendimento', filtros.fim)
        .eq('estornada', false)
        .order('data_atendimento', { ascending: false });

      if (filtros.profissionalId) {
        q = q.eq('profissional_id', filtros.profissionalId);
      }

      const { data, error } = await q;
      if (error) throw error;

      const comissoes = (data ?? []).map(mapComissao);

      // Agrupa por profissional
      const gruposMap = new Map<string, RelatorioComissaoProfissional>();
      for (const c of comissoes) {
        const chave = c.profissionalNome;
        if (!gruposMap.has(chave)) {
          gruposMap.set(chave, {
            profissionalNome: c.profissionalNome,
            profissionalId: c.profissionalId,
            totalAtendimentos: 0,
            totalBase: 0,
            totalComissao: 0,
            itens: [],
          });
        }
        const g = gruposMap.get(chave)!;
        g.totalAtendimentos += 1;
        g.totalBase = Math.round((g.totalBase + c.valorBase) * 100) / 100;
        g.totalComissao = Math.round((g.totalComissao + c.valorComissao) * 100) / 100;
        g.itens.push(c);
      }

      return Array.from(gruposMap.values()).sort(
        (a, b) => b.totalComissao - a.totalComissao
      );
    });
  },

  async getAlertasSemRegra(
    userId: string | undefined,
    filtros: { inicio: string; fim: string }
  ): Promise<Comissao[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('comissoes')
        .select('*')
        .eq('user_id', uid)
        .gte('data_atendimento', filtros.inicio)
        .lte('data_atendimento', filtros.fim)
        .eq('sem_regra', true)
        .eq('estornada', false)
        .order('data_atendimento', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapComissao);
    });
  },

  async fecharPeriodoComissoes(
    userId: string | undefined,
    params: {
      profissionalId: string | null;
      profissionalNome: string | null;
      dataInicio: string;
      dataFim: string;
      fechadoPor: string;
      observacoes?: string;
    }
  ): Promise<FechamentoComissao> {
    return run(async () => {
      const uid = await requireUserId(userId);

      // Busca comissões abertas do período
      let q = supabase
        .from('comissoes')
        .select('id, valor_comissao')
        .eq('user_id', uid)
        .gte('data_atendimento', params.dataInicio)
        .lte('data_atendimento', params.dataFim)
        .eq('estornada', false)
        .is('fechamento_id', null);

      if (params.profissionalId) {
        q = q.eq('profissional_id', params.profissionalId);
      }

      const { data: comissoesAbertas, error: fetchErr } = await q;
      if (fetchErr) throw fetchErr;

      const itens = comissoesAbertas ?? [];
      const totalComissao = Math.round(
        itens.reduce((s: number, r: any) => s + Number(r.valor_comissao || 0), 0) * 100
      ) / 100;

      // Cria o fechamento
      const { data: fechamento, error: insertErr } = await supabase
        .from('fechamentos_comissao')
        .insert({
          user_id: uid,
          profissional_id: params.profissionalId ?? null,
          profissional_nome: params.profissionalNome ?? null,
          data_inicio: params.dataInicio,
          data_fim: params.dataFim,
          total_comissao: totalComissao,
          quantidade_atendimentos: itens.length,
          fechado_por: params.fechadoPor,
          observacoes: params.observacoes ?? null,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      // Vincula as comissões ao fechamento (torna imutáveis)
      if (itens.length > 0) {
        const ids = itens.map((r: any) => r.id);
        await supabase
          .from('comissoes')
          .update({ fechamento_id: fechamento.id })
          .in('id', ids)
          .eq('user_id', uid);
      }

      return mapFechamentoComissao(fechamento);
    });
  },

  async getFechamentosComissao(userId?: string): Promise<FechamentoComissao[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('fechamentos_comissao')
        .select('*')
        .eq('user_id', uid)
        .order('fechado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapFechamentoComissao);
    });
  },

  // ============================================================
  // ANAMNESE DIGITAL (US-023)
  // ============================================================

  async getAnamneseFormularios(userId?: string): Promise<AnamneseFormulario[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('anamnese_formularios')
        .select('*, procedimentos(nome)')
        .eq('user_id', uid)
        .eq('ativo', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) =>
        mapAnamneseFormulario({ ...row, procedimento_nome: row.procedimentos?.nome ?? null })
      );
    });
  },

  async createAnamneseFormulario(
    formulario: Omit<AnamneseFormulario, 'id' | 'createdAt'>,
    userId?: string
  ): Promise<AnamneseFormulario> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('anamnese_formularios')
        .insert({
          user_id: uid,
          nome: formulario.nome,
          procedimento_id: formulario.procedimentoId ?? null,
          campos: formulario.campos,
          ativo: formulario.ativo,
        })
        .select()
        .single();
      if (error) throw error;
      return mapAnamneseFormulario(data);
    });
  },

  async updateAnamneseFormulario(
    id: string,
    updates: Partial<Pick<AnamneseFormulario, 'nome' | 'campos' | 'ativo' | 'procedimentoId'>>,
    userId?: string
  ): Promise<AnamneseFormulario> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const patch: Record<string, unknown> = {};
      if (updates.nome !== undefined) patch.nome = updates.nome;
      if (updates.campos !== undefined) patch.campos = updates.campos;
      if (updates.ativo !== undefined) patch.ativo = updates.ativo;
      if (updates.procedimentoId !== undefined) patch.procedimento_id = updates.procedimentoId;
      const { data, error } = await supabase
        .from('anamnese_formularios')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapAnamneseFormulario(data);
    });
  },

  async getAnamneseRespostas(clienteId: string, userId?: string): Promise<AnamneseResposta[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('anamnese_respostas')
        .select('*, anamnese_formularios(nome)')
        .eq('user_id', uid)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) =>
        mapAnamneseResposta({ ...row, formulario_nome: row.anamnese_formularios?.nome ?? null })
      );
    });
  },

  async createAnamneseResposta(
    params: {
      clienteId: string;
      formularioId: string;
      agendamentoId?: string | null;
    },
    userId?: string
  ): Promise<AnamneseResposta> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('anamnese_respostas')
        .insert({
          user_id: uid,
          cliente_id: params.clienteId,
          formulario_id: params.formularioId,
          agendamento_id: params.agendamentoId ?? null,
          respostas: {},
          status: 'pendente',
        })
        .select()
        .single();
      if (error) throw error;
      return mapAnamneseResposta(data);
    });
  },

  async updateAnamneseResposta(
    id: string,
    updates: {
      respostas?: Record<string, string | string[] | number | boolean>;
      status?: AnamneseStatus;
      assinaturaData?: string | null;
      revisadoPor?: string;
      tokenExpiraEm?: string | null;
    },
    userId?: string
  ): Promise<AnamneseResposta> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const patch: Record<string, unknown> = {};
      if (updates.respostas !== undefined) patch.respostas = updates.respostas;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.assinaturaData !== undefined) patch.assinatura_data = updates.assinaturaData;
      if (updates.revisadoPor !== undefined) {
        patch.revisado_por = updates.revisadoPor;
        patch.revisado_em = new Date().toISOString();
      }
      if (updates.status === 'assinado') patch.assinado_em = new Date().toISOString();
      if (updates.tokenExpiraEm !== undefined) patch.token_expira_em = updates.tokenExpiraEm;
      const { data, error } = await supabase
        .from('anamnese_respostas')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .select('*, anamnese_formularios(nome)')
        .single();
      if (error) throw error;
      return mapAnamneseResposta({
        ...data,
        formulario_nome: (data as any).anamnese_formularios?.nome ?? null,
      });
    });
  },

  async deleteAnamneseFormulario(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('anamnese_formularios')
        .update({ ativo: false })
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ── US-025: Assinatura Digital ──────────────────────────────────

  async getDocumentTemplates(userId?: string): Promise<DocumentoModelo[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('user_id', uid)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []).map(mapDocumentoModelo);
    });
  },

  async createDocumentTemplate(
    dados: Pick<DocumentoModelo, 'nome' | 'tipo' | 'conteudo' | 'variaveis'>,
    userId?: string
  ): Promise<DocumentoModelo> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('document_templates')
        .insert([{
          user_id:   uid,
          nome:      dados.nome,
          tipo:      dados.tipo,
          conteudo:  dados.conteudo,
          variaveis: dados.variaveis,
        }])
        .select()
        .single();
      if (error) throw error;
      return mapDocumentoModelo(data);
    });
  },

  async updateDocumentTemplate(
    id: string,
    dados: Partial<Pick<DocumentoModelo, 'nome' | 'tipo' | 'conteudo' | 'variaveis' | 'ativo'>>,
    userId?: string
  ): Promise<DocumentoModelo> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (dados.nome !== undefined) patch.nome = dados.nome;
      if (dados.tipo !== undefined) patch.tipo = dados.tipo;
      if (dados.conteudo !== undefined) patch.conteudo = dados.conteudo;
      if (dados.variaveis !== undefined) patch.variaveis = dados.variaveis;
      if (dados.ativo !== undefined) patch.ativo = dados.ativo;
      const { data, error } = await supabase
        .from('document_templates')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapDocumentoModelo(data);
    });
  },

  async deleteDocumentTemplate(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('document_templates')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async getDocumentSignatures(userId: string, clienteId: string): Promise<DocumentoAssinado[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('user_id', uid)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapDocumentoAssinado);
    });
  },

  async createDocumentSignature(
    dados: {
      clienteId: string;
      modeloId: string | null;
      titulo: string;
      conteudoFinal: string;
      hashIntegridade: string;
      profissional: string;
      assinaturaData?: string;
      assinaturaMetodo?: 'presencial' | 'remoto';
      assinadoIp?: string;
      assinadoDispositivo?: string;
    },
    userId?: string
  ): Promise<DocumentoAssinado> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const isPresencial = dados.assinaturaMetodo === 'presencial' && dados.assinaturaData;
      const { data, error } = await supabase
        .from('document_signatures')
        .insert([{
          user_id:             uid,
          cliente_id:          dados.clienteId,
          modelo_id:           dados.modeloId,
          titulo:              dados.titulo,
          conteudo_final:      dados.conteudoFinal,
          hash_integridade:    dados.hashIntegridade,
          profissional:        dados.profissional,
          assinatura_data:     dados.assinaturaData ?? null,
          assinatura_metodo:   dados.assinaturaMetodo ?? null,
          assinado_em:         isPresencial ? new Date().toISOString() : null,
          assinado_ip:         dados.assinadoIp ?? null,
          assinado_dispositivo: dados.assinadoDispositivo ?? null,
          status:              isPresencial ? 'assinado' : 'pendente',
        }])
        .select()
        .single();
      if (error) throw error;
      return mapDocumentoAssinado(data);
    });
  },

  async signDocumentPresencial(
    id: string,
    assinaturaData: string,
    userId?: string
  ): Promise<DocumentoAssinado> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('document_signatures')
        .update({
          assinatura_data:   assinaturaData,
          assinatura_metodo: 'presencial',
          assinado_em:       new Date().toISOString(),
          status:            'assinado',
        })
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapDocumentoAssinado(data);
    });
  },

  async createSignatureLink(documentoId: string, userId?: string): Promise<DocumentoSignatureLink> {
    return run(async () => {
      await requireUserId(userId);
      const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('document_signature_links')
        .insert([{ documento_id: documentoId, expira_em: expiraEm }])
        .select()
        .single();
      if (error) throw error;
      return mapSignatureLink(data);
    });
  },

  async getDocumentByToken(token: string): Promise<{
    titulo: string;
    conteudo: string;
    profissional: string;
    hash: string;
    expiraEm: string;
  } | null> {
    const { data, error } = await supabase.rpc('get_document_for_signing', { p_token: token });
    if (error || !data?.success) return null;
    return {
      titulo:      data.titulo,
      conteudo:    data.conteudo,
      profissional: data.profissional,
      hash:        data.hash,
      expiraEm:    data.expira_em,
    };
  },

  async signDocumentByToken(
    token: string,
    assinaturaData: string,
    ip?: string,
    dispositivo?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('sign_document_by_token', {
      p_token:       token,
      p_assinatura:  assinaturaData,
      p_ip:          ip ?? null,
      p_dispositivo: dispositivo ?? null,
    });
    if (error) return { success: false, error: error.message };
    return data as { success: boolean; error?: string };
  },

  // ============================================================
  // REPASSE DE PROFISSIONAIS AUTÔNOMOS (US-036)
  // ============================================================

  async getRepasseRegras(userId?: string): Promise<RepasseRegra[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('repasse_regras')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRepasseRegra);
    });
  },

  async createRepasseRegra(
    regra: Omit<RepasseRegra, 'id'>,
    userId?: string
  ): Promise<RepasseRegra> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('repasse_regras')
        .insert({
          user_id: uid,
          profissional_id: regra.profissionalId,
          profissional_nome: regra.profissionalNome,
          modelo: regra.modelo,
          valor: regra.valor,
          data_inicio: regra.dataInicio,
          data_fim: regra.dataFim ?? null,
          ativo: regra.ativo,
        })
        .select()
        .single();
      if (error) throw error;
      return mapRepasseRegra(data);
    });
  },

  async updateRepasseRegra(
    id: string,
    updates: Partial<Pick<RepasseRegra, 'modelo' | 'valor' | 'dataInicio' | 'dataFim' | 'ativo'>>,
    userId?: string
  ): Promise<RepasseRegra> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const patch: Record<string, unknown> = {};
      if (updates.modelo !== undefined) patch.modelo = updates.modelo;
      if (updates.valor !== undefined) patch.valor = updates.valor;
      if (updates.dataInicio !== undefined) patch.data_inicio = updates.dataInicio;
      if (updates.dataFim !== undefined) patch.data_fim = updates.dataFim ?? null;
      if (updates.ativo !== undefined) patch.ativo = updates.ativo;
      const { data, error } = await supabase
        .from('repasse_regras')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapRepasseRegra(data);
    });
  },

  async calcularPreviewRepasse(
    userId: string | undefined,
    params: { profissionalId: string; dataInicio: string; dataFim: string }
  ): Promise<PreviewRepasse> {
    return run(async () => {
      const uid = await requireUserId(userId);

      // Busca regra ativa para o profissional que cobre o período
      const { data: regrasData, error: regrasErr } = await supabase
        .from('repasse_regras')
        .select('*')
        .eq('user_id', uid)
        .eq('profissional_id', params.profissionalId)
        .eq('ativo', true)
        .lte('data_inicio', params.dataFim)
        .order('data_inicio', { ascending: false });
      if (regrasErr) throw regrasErr;

      const regraAtiva = (regrasData ?? []).find((r: any) =>
        !r.data_fim || r.data_fim >= params.dataInicio
      ) ?? null;

      // Resolve nome do profissional para matching com agendamentos
      const { data: equipeRow } = await supabase
        .from('equipe')
        .select('nome')
        .eq('id', params.profissionalId)
        .eq('user_id', uid)
        .single();

      const profNome = equipeRow?.nome ?? '';

      if (!profNome) {
        return {
          regra: regraAtiva ? mapRepasseRegra(regraAtiva) : null,
          totalAtendimentos: 0,
          faturamentoBruto: 0,
          valorRepasseProfissional: 0,
          valorRetencaoClinica: 0,
          itens: [],
        };
      }

      // Atendimentos finalizados do profissional no período (valor líquido pós-estorno)
      const { data: agData, error: agErr } = await supabase
        .from('v_faturamento_consolidado')
        .select('agendamento_id, data, procedimento, profissional, valor_liquido')
        .eq('user_id', uid)
        .gte('data', params.dataInicio)
        .lte('data', params.dataFim)
        .order('data', { ascending: true });
      if (agErr) throw agErr;

      // Filtra por profissional (case-insensitive, js-side para segurança)
      const profNomeLower = profNome.toLowerCase();
      const atendimentos = (agData ?? []).filter(
        (a: any) => (a.profissional ?? '').toLowerCase() === profNomeLower
      );

      const totalAtendimentos = atendimentos.length;
      const faturamentoBruto = Math.round(
        atendimentos.reduce((s: number, a: any) => s + Number(a.valor_liquido ?? 0), 0) * 100
      ) / 100;

      let valorRepasseProfissional = 0;
      let valorRetencaoClinica = 0;
      let itens: RepasseItemSnapshot[];

      if (!regraAtiva) {
        itens = atendimentos.map((a: any) => ({
          agendamentoId: a.agendamento_id,
          data: a.data,
          procedimento: a.procedimento ?? '',
          valorLiquido: Number(a.valor_liquido ?? 0),
          valorRepasse: 0,
        }));
      } else {
        const modelo = regraAtiva.modelo as RepasseModelo;
        const valor = Number(regraAtiva.valor);

        if (modelo === 'percentual') {
          itens = atendimentos.map((a: any) => {
            const vl = Number(a.valor_liquido ?? 0);
            const vr = Math.round(vl * (valor / 100) * 100) / 100;
            return {
              agendamentoId: a.agendamento_id,
              data: a.data,
              procedimento: a.procedimento ?? '',
              valorLiquido: vl,
              valorRepasse: vr,
            };
          });
          valorRepasseProfissional = Math.round(
            itens.reduce((s, i) => s + i.valorRepasse, 0) * 100
          ) / 100;
          valorRetencaoClinica = Math.round(
            (faturamentoBruto - valorRepasseProfissional) * 100
          ) / 100;
        } else if (modelo === 'fixo_sessao') {
          itens = atendimentos.map((a: any) => ({
            agendamentoId: a.agendamento_id,
            data: a.data,
            procedimento: a.procedimento ?? '',
            valorLiquido: Number(a.valor_liquido ?? 0),
            valorRepasse: valor,
          }));
          valorRepasseProfissional = 0;
          valorRetencaoClinica = Math.round(totalAtendimentos * valor * 100) / 100;
        } else {
          // fixo_periodo: lista atendimentos como referência, valor é fixo mensal
          itens = atendimentos.map((a: any) => ({
            agendamentoId: a.agendamento_id,
            data: a.data,
            procedimento: a.procedimento ?? '',
            valorLiquido: Number(a.valor_liquido ?? 0),
            valorRepasse: 0,
          }));
          valorRepasseProfissional = 0;
          valorRetencaoClinica = valor;
        }
      }

      return {
        regra: regraAtiva ? mapRepasseRegra(regraAtiva) : null,
        totalAtendimentos,
        faturamentoBruto,
        valorRepasseProfissional,
        valorRetencaoClinica,
        itens,
      };
    });
  },

  async fecharPeriodoRepasse(
    userId: string | undefined,
    params: {
      profissionalId: string;
      profissionalNome: string;
      dataInicio: string;
      dataFim: string;
      fechadoPor: string;
      observacoes?: string;
    }
  ): Promise<FechamentoRepasse> {
    return run(async () => {
      const uid = await requireUserId(userId);

      // Calcula preview para obter todos os valores
      const preview = await api.calcularPreviewRepasse(uid, {
        profissionalId: params.profissionalId,
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
      });

      const modelo = preview.regra?.modelo ?? 'percentual';

      const { data, error } = await supabase
        .from('fechamentos_repasse')
        .insert({
          user_id: uid,
          profissional_id: params.profissionalId,
          profissional_nome: params.profissionalNome,
          modelo,
          data_inicio: params.dataInicio,
          data_fim: params.dataFim,
          total_atendimentos: preview.totalAtendimentos,
          faturamento_bruto: preview.faturamentoBruto,
          valor_repasse_profissional: preview.valorRepasseProfissional,
          valor_retencao_clinica: preview.valorRetencaoClinica,
          itens_snapshot: preview.itens,
          fechado_por: params.fechadoPor,
          observacoes: params.observacoes ?? null,
          notificacao_enviada: false,
        })
        .select()
        .single();
      if (error) throw error;
      return mapFechamentoRepasse(data);
    });
  },

  async getFechamentosRepasse(userId?: string): Promise<FechamentoRepasse[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('fechamentos_repasse')
        .select('*')
        .eq('user_id', uid)
        .order('fechado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapFechamentoRepasse);
    });
  },

  async marcarNotificacaoRepasse(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      // Nota: a tabela tem REVOKE UPDATE — apenas notificacao_enviada pode ser
      // atualizada via service_role ou política específica. Em produção, usar
      // uma edge function ou service_role key para essa atualização.
      // Por ora, este método existe para futura integração com WhatsApp (US-007b).
      console.log('[repasse] Notificação marcada para fechamento', id, 'user', uid);
    });
  },

  // ============================================================
  // PIPELINE DE LEADS / FUNIL CRM (US-011)
  // ============================================================

  // ── Etapas do Funil ──────────────────────────────────────────

  async getFunilEtapas(userId?: string): Promise<FunilEtapa[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('funil_etapas')
        .select('*')
        .eq('user_id', uid)
        .order('ordem');
      if (error) throw error;
      return (data ?? []).map(mapFunilEtapa);
    });
  },

  async initFunilPadrao(userId?: string): Promise<FunilEtapa[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data: existing } = await supabase
        .from('funil_etapas')
        .select('id')
        .eq('user_id', uid)
        .limit(1);
      if ((existing ?? []).length > 0) return this.getFunilEtapas(uid);

      const defaults = [
        { nome: 'Novo Lead',          ordem: 0, cor: '#6366F1', tipo: 'ativo' },
        { nome: 'Primeiro Contato',   ordem: 1, cor: '#F59E0B', tipo: 'ativo' },
        { nome: 'Orçamento Enviado',  ordem: 2, cor: '#3B82F6', tipo: 'ativo' },
        { nome: 'Agendado',           ordem: 3, cor: '#8B5CF6', tipo: 'ativo' },
        { nome: 'Convertido',         ordem: 4, cor: '#10B981', tipo: 'convertido' },
        { nome: 'Perdido',            ordem: 5, cor: '#EF4444', tipo: 'perdido' },
      ];
      const { data, error } = await supabase
        .from('funil_etapas')
        .insert(defaults.map((d) => ({ ...d, user_id: uid })))
        .select();
      if (error) throw error;
      return (data ?? []).map(mapFunilEtapa).sort((a, b) => a.ordem - b.ordem);
    });
  },

  async createFunilEtapa(
    etapa: Omit<FunilEtapa, 'id'>,
    userId?: string
  ): Promise<FunilEtapa> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!etapa.nome?.trim()) throw new ApiError('Informe o nome da etapa.', 400);
      const { data, error } = await supabase
        .from('funil_etapas')
        .insert({ user_id: uid, nome: etapa.nome, ordem: etapa.ordem, cor: etapa.cor, tipo: etapa.tipo })
        .select()
        .single();
      if (error) throw error;
      return mapFunilEtapa(data);
    });
  },

  async updateFunilEtapa(
    id: string,
    updates: Partial<Pick<FunilEtapa, 'nome' | 'ordem' | 'cor' | 'tipo'>>,
    userId?: string
  ): Promise<FunilEtapa> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const patch: Record<string, unknown> = {};
      if (updates.nome  !== undefined) patch.nome  = updates.nome;
      if (updates.ordem !== undefined) patch.ordem = updates.ordem;
      if (updates.cor   !== undefined) patch.cor   = updates.cor;
      if (updates.tipo  !== undefined) patch.tipo  = updates.tipo;
      const { data, error } = await supabase
        .from('funil_etapas')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapFunilEtapa(data);
    });
  },

  async deleteFunilEtapa(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('etapa_id', id)
        .eq('user_id', uid);
      if ((count ?? 0) > 0) {
        throw new ApiError('Mova os leads desta etapa antes de excluí-la.', 400);
      }
      const { error } = await supabase
        .from('funil_etapas')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ── Leads ────────────────────────────────────────────────────

  async getLeads(userId?: string): Promise<Lead[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapLead);
    });
  },

  async createLead(
    lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'clienteId' | 'etapaEntradaEm'>,
    userId?: string
  ): Promise<Lead> {
    return run(async () => {
      const uid = await requireUserId(userId);
      if (!lead.nome?.trim()) throw new ApiError('Informe o nome do lead.', 400);
      const { data, error } = await supabase
        .from('leads')
        .insert({
          user_id:                uid,
          nome:                   lead.nome,
          telefone:               lead.telefone || null,
          email:                  lead.email || null,
          procedimento_interesse: lead.procedimentoInteresse || null,
          origem:                 lead.origem,
          observacoes:            lead.observacoes || null,
          etapa_id:               lead.etapaId,
          responsavel_id:         lead.responsavelId || null,
          responsavel_nome:       lead.responsavelNome || null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapLead(data);
    });
  },

  async updateLead(
    id: string,
    updates: Partial<Pick<Lead, 'nome' | 'telefone' | 'email' | 'procedimentoInteresse' | 'origem' | 'observacoes' | 'responsavelId' | 'responsavelNome'>>,
    userId?: string
  ): Promise<Lead> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const patch: Record<string, unknown> = {};
      if (updates.nome                  !== undefined) patch.nome                   = updates.nome;
      if (updates.telefone              !== undefined) patch.telefone               = updates.telefone || null;
      if (updates.email                 !== undefined) patch.email                  = updates.email || null;
      if (updates.procedimentoInteresse !== undefined) patch.procedimento_interesse = updates.procedimentoInteresse || null;
      if (updates.origem                !== undefined) patch.origem                 = updates.origem;
      if (updates.observacoes           !== undefined) patch.observacoes            = updates.observacoes || null;
      if (updates.responsavelId         !== undefined) patch.responsavel_id         = updates.responsavelId || null;
      if (updates.responsavelNome       !== undefined) patch.responsavel_nome       = updates.responsavelNome || null;
      const { data, error } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapLead(data);
    });
  },

  async moverLead(
    leadId: string,
    novaEtapaId: string,
    usuarioNome: string,
    userId?: string
  ): Promise<Lead> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data: leadAtual, error: errLead } = await supabase
        .from('leads')
        .select('etapa_id')
        .eq('id', leadId)
        .eq('user_id', uid)
        .single();
      if (errLead) throw errLead;

      const etapaAnteriorId = leadAtual.etapa_id as string;

      // Atualiza etapa e reseta o timer de entrada
      const { data, error } = await supabase
        .from('leads')
        .update({ etapa_id: novaEtapaId, etapa_entrada_em: new Date().toISOString() })
        .eq('id', leadId)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;

      // Registra no histórico (trilha imutável)
      await supabase.from('lead_historico').insert({
        user_id:          uid,
        lead_id:          leadId,
        etapa_anterior_id: etapaAnteriorId,
        etapa_nova_id:    novaEtapaId,
        usuario_nome:     usuarioNome,
        tipo:             'movimentacao',
      });

      return mapLead(data);
    });
  },

  async converterLeadEmPaciente(
    leadId: string,
    usuarioNome: string,
    userId?: string
  ): Promise<{ lead: Lead; clienteId: string }> {
    return run(async () => {
      const uid = await requireUserId(userId);

      // Busca dados do lead
      const { data: leadRow, error: errLead } = await supabase
        .from('leads')
        .select('*, funil_etapas!leads_etapa_id_fkey(tipo)')
        .eq('id', leadId)
        .eq('user_id', uid)
        .single();
      if (errLead) throw errLead;

      // Cria cliente com os dados do lead
      const { data: clienteRow, error: errCliente } = await supabase
        .from('clientes')
        .insert({
          user_id:           uid,
          nome:              leadRow.nome,
          telefone:          leadRow.telefone || null,
          email:             leadRow.email || null,
          data_ultima_visita: new Date().toISOString().split('T')[0],
          status_retencao:   'em_dia',
          tags:              [],
        })
        .select()
        .single();
      if (errCliente) throw errCliente;

      const clienteId = clienteRow.id as string;

      // Busca etapa de tipo 'convertido'
      const { data: etapaConvertido } = await supabase
        .from('funil_etapas')
        .select('id')
        .eq('user_id', uid)
        .eq('tipo', 'convertido')
        .limit(1)
        .single();

      const novaEtapaId = etapaConvertido?.id ?? leadRow.etapa_id;
      const etapaAnteriorId = leadRow.etapa_id;

      // Atualiza lead: marca cliente_id e move para etapa convertido
      const { data: leadAtualizado, error: errUpdate } = await supabase
        .from('leads')
        .update({
          cliente_id:       clienteId,
          etapa_id:         novaEtapaId,
          etapa_entrada_em: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('user_id', uid)
        .select()
        .single();
      if (errUpdate) throw errUpdate;

      // Registra conversão no histórico
      await supabase.from('lead_historico').insert({
        user_id:           uid,
        lead_id:           leadId,
        etapa_anterior_id: etapaAnteriorId,
        etapa_nova_id:     novaEtapaId,
        usuario_nome:      usuarioNome,
        tipo:              'movimentacao',
        observacao:        `Convertido em paciente (cliente #${clienteId.slice(0, 8)})`,
      });

      return { lead: mapLead(leadAtualizado), clienteId };
    });
  },

  async deleteLead(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  // ── Histórico ────────────────────────────────────────────────

  async getLeadHistorico(leadId: string, userId?: string): Promise<LeadHistorico[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('lead_historico')
        .select('*')
        .eq('lead_id', leadId)
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapLeadHistorico);
    });
  },

  async addLeadNota(
    leadId: string,
    nota: string,
    usuarioNome: string,
    userId?: string
  ): Promise<LeadHistorico> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data: lead } = await supabase
        .from('leads')
        .select('etapa_id')
        .eq('id', leadId)
        .eq('user_id', uid)
        .single();
      const { data, error } = await supabase
        .from('lead_historico')
        .insert({
          user_id:       uid,
          lead_id:       leadId,
          etapa_nova_id: lead?.etapa_id,
          usuario_nome:  usuarioNome,
          observacao:    nota,
          tipo:          'nota',
        })
        .select()
        .single();
      if (error) throw error;
      return mapLeadHistorico(data);
    });
  },

  // ── Automações ───────────────────────────────────────────────

  async getLeadAutomacoes(etapaId: string, userId?: string): Promise<LeadAutomacao[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('lead_automacoes')
        .select('*')
        .eq('etapa_id', etapaId)
        .eq('user_id', uid)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(mapLeadAutomacao);
    });
  },

  async createLeadAutomacao(
    automacao: Omit<LeadAutomacao, 'id'> & { userId?: string },
    userId?: string
  ): Promise<LeadAutomacao> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('lead_automacoes')
        .insert({
          user_id:      uid,
          etapa_id:     automacao.etapaId,
          tipo:         automacao.tipo,
          gatilho:      automacao.gatilho,
          dias_espera:  automacao.diasEspera ?? null,
          mensagem:     automacao.mensagem ?? null,
          tarefa_titulo: automacao.tarefaTitulo ?? null,
          ativo:        automacao.ativo,
        })
        .select()
        .single();
      if (error) throw error;
      return mapLeadAutomacao(data);
    });
  },

  async updateLeadAutomacao(
    id: string,
    updates: Partial<Omit<LeadAutomacao, 'id' | 'etapaId'>>,
    userId?: string
  ): Promise<LeadAutomacao> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const patch: Record<string, unknown> = {};
      if (updates.tipo         !== undefined) patch.tipo          = updates.tipo;
      if (updates.gatilho      !== undefined) patch.gatilho       = updates.gatilho;
      if (updates.diasEspera   !== undefined) patch.dias_espera   = updates.diasEspera;
      if (updates.mensagem     !== undefined) patch.mensagem      = updates.mensagem;
      if (updates.tarefaTitulo !== undefined) patch.tarefa_titulo = updates.tarefaTitulo;
      if (updates.ativo        !== undefined) patch.ativo         = updates.ativo;
      const { data, error } = await supabase
        .from('lead_automacoes')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapLeadAutomacao(data);
    });
  },

  async deleteLeadAutomacao(id: string, userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('lead_automacoes')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async dispararAutomacoesEtapa(
    leadId: string,
    etapaId: string,
    usuarioNome: string,
    userId?: string
  ): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data: automacoes } = await supabase
        .from('lead_automacoes')
        .select('*')
        .eq('etapa_id', etapaId)
        .eq('user_id', uid)
        .eq('ativo', true)
        .eq('gatilho', 'ao_entrar');

      for (const a of automacoes ?? []) {
        let observacao = '';
        if (a.tipo === 'tarefa') {
          observacao = `Tarefa: ${a.tarefa_titulo ?? 'Ação pendente'}`;
        } else if (a.tipo === 'whatsapp') {
          // E3-G4 não implementado — registra intenção no histórico
          observacao = `[WhatsApp pendente] ${a.mensagem ?? ''}`;
        } else if (a.tipo === 'email') {
          observacao = `[E-mail pendente] ${a.mensagem ?? ''}`;
        }

        await supabase.from('lead_historico').insert({
          user_id:       uid,
          lead_id:       leadId,
          etapa_nova_id: etapaId,
          usuario_nome:  usuarioNome,
          tipo:          'automacao',
          observacao,
        });
      }
    });
  },

  // ── Métricas do Funil (CA-06) ────────────────────────────────

  async getFunilMetricas(etapas: FunilEtapa[], leads: Lead[]): Promise<FunilMetricas> {
    const agora = new Date();
    const hoje  = agora.toISOString().split('T')[0];
    const inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - 7);
    const inicioMes    = new Date(agora); inicioMes.setDate(agora.getDate() - 30);

    const leadsPorEtapa: Record<string, number> = {};
    const tempoTotalPorEtapa: Record<string, number> = {};
    const contadorEtapa: Record<string, number> = {};
    const leadsPorOrigem: Record<string, number> = {};

    for (const etapa of etapas) {
      leadsPorEtapa[etapa.id] = 0;
      tempoTotalPorEtapa[etapa.id] = 0;
      contadorEtapa[etapa.id] = 0;
    }

    let leadsHoje = 0;
    let leadsSemana = 0;
    let leadsMes = 0;

    for (const lead of leads) {
      if (leadsPorEtapa[lead.etapaId] !== undefined) {
        leadsPorEtapa[lead.etapaId]++;
      }

      const diasNaEtapa = Math.floor(
        (agora.getTime() - new Date(lead.etapaEntradaEm).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (tempoTotalPorEtapa[lead.etapaId] !== undefined) {
        tempoTotalPorEtapa[lead.etapaId] += diasNaEtapa;
        contadorEtapa[lead.etapaId]++;
      }

      leadsPorOrigem[lead.origem] = (leadsPorOrigem[lead.origem] ?? 0) + 1;

      const dataLead = lead.createdAt.split('T')[0];
      if (dataLead === hoje) leadsHoje++;
      if (new Date(lead.createdAt) >= inicioSemana) leadsSemana++;
      if (new Date(lead.createdAt) >= inicioMes) leadsMes++;
    }

    const tempoMedioPorEtapa: Record<string, number> = {};
    const taxaConversaoPorEtapa: Record<string, number> = {};
    for (const etapa of etapas) {
      tempoMedioPorEtapa[etapa.id] = contadorEtapa[etapa.id] > 0
        ? Math.round(tempoTotalPorEtapa[etapa.id] / contadorEtapa[etapa.id])
        : 0;
      taxaConversaoPorEtapa[etapa.id] = 0; // calculado via historico — simplificado aqui
    }

    return {
      totalLeads: leads.length,
      leadsPorEtapa,
      taxaConversaoPorEtapa,
      tempoMedioPorEtapa,
      leadsPorOrigem,
      leadsHoje,
      leadsSemana,
      leadsMes,
    };
  },

  // ── Orçamentos (US-012) ──────────────────────────────────────────────

  async getOrcamentos(userId: string, status?: OrcamentoStatus): Promise<Orcamento[]> {
    const uid = await requireUserId(userId);
    // Expirar orçamentos vencidos antes de buscar
    try { await supabase.rpc('expirar_orcamentos_vencidos'); } catch (_) {};

    let q = supabase
      .from('orcamentos')
      .select('*, orcamento_itens(*)')
      .eq('user_id', uid)
      .order('data_envio', { ascending: false });

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw humanizeError(error);
    return (data ?? []).map(mapOrcamento);
  },

  async createOrcamento(
    payload: {
      clienteId?: string | null;
      leadId?: string | null;
      nomeCliente: string;
      telefone?: string;
      profissionalId?: string | null;
      profissionalNome?: string | null;
      dataEnvio: string;
      validade: string;
      observacoes?: string | null;
      itens: { procedimentoId?: string | null; descricao: string; quantidade: number; valorUnitario: number }[];
    },
    userId: string
  ): Promise<Orcamento> {
    const uid = await requireUserId(userId);

    const { data: orc, error: orcErr } = await supabase
      .from('orcamentos')
      .insert({
        user_id:           uid,
        cliente_id:        payload.clienteId ?? null,
        lead_id:           payload.leadId ?? null,
        nome_cliente:      payload.nomeCliente,
        telefone:          payload.telefone ?? '',
        profissional_id:   payload.profissionalId ?? null,
        profissional_nome: payload.profissionalNome ?? null,
        data_envio:        payload.dataEnvio,
        validade:          payload.validade,
        observacoes:       payload.observacoes ?? null,
        status:            'aberto',
        valor_total:       0,
      })
      .select()
      .single();

    if (orcErr || !orc) throw humanizeError(orcErr);

    if (payload.itens.length > 0) {
      const { error: itErr } = await supabase.from('orcamento_itens').insert(
        payload.itens.map((it) => ({
          orcamento_id:    orc.id,
          user_id:         uid,
          procedimento_id: it.procedimentoId ?? null,
          descricao:       it.descricao,
          quantidade:      it.quantidade,
          valor_unitario:  it.valorUnitario,
        }))
      );
      if (itErr) throw humanizeError(itErr);
    }

    // Recarrega com itens e valor_total calculado pelo trigger
    const { data: full, error: fullErr } = await supabase
      .from('orcamentos')
      .select('*, orcamento_itens(*)')
      .eq('id', orc.id)
      .single();
    if (fullErr || !full) throw humanizeError(fullErr);
    return mapOrcamento(full);
  },

  async updateOrcamentoStatus(
    id: string,
    status: OrcamentoStatus,
    motivoPerdaKey: OrcamentoMotivoPerdaKey | null,
    userId: string
  ): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('orcamentos')
      .update({ status, motivo_perda: motivoPerdaKey ?? null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw humanizeError(error);
  },

  async renovarOrcamento(id: string, novaValidade: string, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('orcamentos')
      .update({ status: 'aberto', validade: novaValidade, motivo_perda: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw humanizeError(error);
  },

  async deleteOrcamento(id: string, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('orcamentos')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw humanizeError(error);
  },

  async getOrcamentoFollowupConfig(userId: string): Promise<OrcamentoFollowupConfig[]> {
    const uid = await requireUserId(userId);
    const { data, error } = await supabase
      .from('orcamento_followup_config')
      .select('*')
      .eq('user_id', uid)
      .order('ordem', { ascending: true });
    if (error) throw humanizeError(error);
    return (data ?? []).map(mapFollowupConfig);
  },

  async createOrcamentoFollowupConfig(
    payload: { diasAposEnvio: number; canal: OrcamentoCanalFollowup; mensagemTemplate: string; ordem: number },
    userId: string
  ): Promise<OrcamentoFollowupConfig> {
    const uid = await requireUserId(userId);
    const { data, error } = await supabase
      .from('orcamento_followup_config')
      .insert({
        user_id:            uid,
        dias_apos_envio:    payload.diasAposEnvio,
        canal:              payload.canal,
        mensagem_template:  payload.mensagemTemplate,
        ativo:              true,
        ordem:              payload.ordem,
      })
      .select()
      .single();
    if (error || !data) throw humanizeError(error);
    return mapFollowupConfig(data);
  },

  async updateOrcamentoFollowupConfig(
    id: string,
    payload: Partial<{ diasAposEnvio: number; canal: OrcamentoCanalFollowup; mensagemTemplate: string; ativo: boolean; ordem: number }>,
    userId: string
  ): Promise<void> {
    const uid = await requireUserId(userId);
    const update: Record<string, unknown> = {};
    if (payload.diasAposEnvio !== undefined) update.dias_apos_envio = payload.diasAposEnvio;
    if (payload.canal !== undefined)         update.canal = payload.canal;
    if (payload.mensagemTemplate !== undefined) update.mensagem_template = payload.mensagemTemplate;
    if (payload.ativo !== undefined)         update.ativo = payload.ativo;
    if (payload.ordem !== undefined)         update.ordem = payload.ordem;
    const { error } = await supabase
      .from('orcamento_followup_config')
      .update(update)
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw humanizeError(error);
  },

  async deleteOrcamentoFollowupConfig(id: string, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('orcamento_followup_config')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw humanizeError(error);
  },

  async getOrcamentoFollowupLog(orcamentoId: string, userId: string): Promise<OrcamentoFollowupLog[]> {
    const uid = await requireUserId(userId);
    const { data, error } = await supabase
      .from('orcamento_followup_log')
      .select('*')
      .eq('orcamento_id', orcamentoId)
      .eq('user_id', uid)
      .order('enviado_em', { ascending: false });
    if (error) throw humanizeError(error);
    return (data ?? []).map(mapFollowupLog);
  },

  async registrarFollowupLog(
    payload: { orcamentoId: string; configId: string | null; canal: string; mensagem: string },
    userId: string
  ): Promise<OrcamentoFollowupLog> {
    const uid = await requireUserId(userId);
    const { data, error } = await supabase
      .from('orcamento_followup_log')
      .insert({
        orcamento_id: payload.orcamentoId,
        user_id:      uid,
        config_id:    payload.configId,
        canal:        payload.canal,
        mensagem:     payload.mensagem,
        status:       'pendente',
      })
      .select()
      .single();
    if (error || !data) throw humanizeError(error);
    return mapFollowupLog(data);
  },

  async getOrcamentoRelatorio(userId: string): Promise<OrcamentoRelatorio> {
    const uid = await requireUserId(userId);
    try { await supabase.rpc('expirar_orcamentos_vencidos'); } catch (_) {};

    const { data, error } = await supabase
      .from('orcamentos')
      .select('status, motivo_perda, valor_total')
      .eq('user_id', uid);

    if (error) throw humanizeError(error);

    const rows = data ?? [];
    const totalEnviados   = rows.length;
    const totalAprovados  = rows.filter((r) => r.status === 'aprovado').length;
    const totalPerdidos   = rows.filter((r) => r.status === 'perdido').length;
    const totalExpirados  = rows.filter((r) => r.status === 'expirado').length;
    const denominador     = totalAprovados + totalPerdidos + totalExpirados;
    const taxaConversao   = denominador > 0 ? Math.round((totalAprovados / denominador) * 100) : 0;

    const aprovados = rows.filter((r) => r.status === 'aprovado');
    const valorTotalConvertido = aprovados.reduce((s, r) => s + (r.valor_total ?? 0), 0);
    const ticketMedioAprovados = totalAprovados > 0 ? valorTotalConvertido / totalAprovados : 0;

    const motivosPerda: Record<OrcamentoMotivoPerdaKey, number> = {
      preco: 0, concorrente: 0, nao_respondeu: 0, outro: 0,
    };
    for (const r of rows.filter((r) => r.status === 'perdido')) {
      const k = (r.motivo_perda ?? 'outro') as OrcamentoMotivoPerdaKey;
      motivosPerda[k] = (motivosPerda[k] ?? 0) + 1;
    }

    return { totalEnviados, totalAprovados, totalPerdidos, totalExpirados, taxaConversao, valorTotalConvertido, ticketMedioAprovados, motivosPerda };
  },

  // ── CRC — Central de Relacionamento (US-013) ──────────────────────────

  async getFaltasRecentes(userId: string, dias: number, profissionalId?: string): Promise<CrcFalta[]> {
    const uid = await requireUserId(userId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dias);
    const cutoffISO = cutoff.toISOString().split('T')[0];

    let q = supabase
      .from('agendamentos')
      .select('id, data, hora_inicio, procedimento, profissional, presenca_status, falta_motivo, cliente_id, clientes(id, nome, telefone)')
      .eq('user_id', uid)
      .eq('presenca_status', 'faltou')
      .gte('data', cutoffISO)
      .order('data', { ascending: false });

    if (profissionalId) q = (q as any).eq('profissional', profissionalId);

    const { data, error } = await q;
    if (error) throw humanizeError(error);

    return (data ?? []).map((row: any) => ({
      agendamentoId: row.id,
      clienteId:     row.cliente_id,
      clienteNome:   row.clientes?.nome ?? 'Desconhecido',
      telefone:      row.clientes?.telefone ?? '',
      data:          row.data,
      procedimento:  row.procedimento ?? '',
      profissional:  row.profissional ?? '',
      faltaMotivo:   row.falta_motivo ?? null,
    }));
  },

  async getInadimplentes(userId: string): Promise<ContaReceber[]> {
    const uid = await requireUserId(userId);
    try { await supabase.rpc('atualizar_status_contas_vencidas'); } catch (_) {};

    const { data, error } = await supabase
      .from('contas_receber')
      .select('*, clientes(nome, telefone)')
      .eq('user_id', uid)
      .neq('status', 'pago')
      .order('data_vencimento', { ascending: true });

    if (error) throw humanizeError(error);

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return (data ?? []).map((row: any) => {
      const venc = new Date(row.data_vencimento + 'T00:00:00');
      const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        id:             row.id,
        clienteId:      row.cliente_id,
        clienteNome:    row.clientes?.nome ?? 'Desconhecido',
        telefone:       row.clientes?.telefone ?? '',
        descricao:      row.descricao,
        valor:          row.valor,
        dataVencimento: row.data_vencimento,
        dataPagamento:  row.data_pagamento ?? null,
        status:         row.status as ContaReceberStatus,
        agendamentoId:  row.agendamento_id ?? null,
        observacoes:    row.observacoes ?? null,
        diasAtraso,
        createdAt:      row.created_at,
      };
    });
  },

  async createContaReceber(
    payload: { clienteId: string; descricao: string; valor: number; dataVencimento: string; observacoes?: string | null },
    userId: string
  ): Promise<ContaReceber> {
    const uid = await requireUserId(userId);
    const { data, error } = await supabase
      .from('contas_receber')
      .insert({
        user_id:         uid,
        cliente_id:      payload.clienteId,
        descricao:       payload.descricao,
        valor:           payload.valor,
        data_vencimento: payload.dataVencimento,
        observacoes:     payload.observacoes ?? null,
        status:          'pendente',
      })
      .select('*, clientes(nome, telefone)')
      .single();
    if (error || !data) throw humanizeError(error);

    const venc = new Date(data.data_vencimento + 'T00:00:00');
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return {
      id:             data.id,
      clienteId:      data.cliente_id,
      clienteNome:    (data as any).clientes?.nome ?? '',
      telefone:       (data as any).clientes?.telefone ?? '',
      descricao:      data.descricao,
      valor:          data.valor,
      dataVencimento: data.data_vencimento,
      dataPagamento:  null,
      status:         data.status as ContaReceberStatus,
      agendamentoId:  null,
      observacoes:    data.observacoes ?? null,
      diasAtraso:     Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))),
      createdAt:      data.created_at,
    };
  },

  async marcarContaPaga(id: string, dataPagamento: string, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('contas_receber')
      .update({ status: 'pago', data_pagamento: dataPagamento, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw humanizeError(error);
  },

  async deleteContaReceber(id: string, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('contas_receber')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw humanizeError(error);
  },

  async getPacientesSemReagendamento(userId: string, dias: number): Promise<CrcSemReagendamento[]> {
    const uid = await requireUserId(userId);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - dias);
    const cutoffISO = cutoff.toISOString().split('T')[0];
    const hojeISO   = new Date().toISOString().split('T')[0];

    const { data: clientes, error: cErr } = await supabase
      .from('clientes')
      .select('id, nome, telefone, data_ultima_visita')
      .eq('user_id', uid)
      .eq('crc_nao_retorna', false)
      .lte('data_ultima_visita', cutoffISO)
      .not('data_ultima_visita', 'is', null);

    if (cErr) throw humanizeError(cErr);
    if (!clientes?.length) return [];

    const clienteIds = clientes.map((c: any) => c.id);

    const [futureRes, lastRes] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('cliente_id')
        .eq('user_id', uid)
        .gte('data', hojeISO)
        .in('cliente_id', clienteIds),
      supabase
        .from('agendamentos')
        .select('cliente_id, procedimento, profissional, data')
        .eq('user_id', uid)
        .in('cliente_id', clienteIds)
        .order('data', { ascending: false }),
    ]);

    const withFuture = new Set((futureRes.data ?? []).map((a: any) => a.cliente_id));

    const lastByClient = new Map<string, any>();
    for (const a of (lastRes.data ?? [])) {
      if (!lastByClient.has(a.cliente_id)) lastByClient.set(a.cliente_id, a);
    }

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return clientes
      .filter((c: any) => !withFuture.has(c.id))
      .map((c: any) => {
        const last = lastByClient.get(c.id);
        const visitDate = new Date(c.data_ultima_visita + 'T00:00:00');
        const diasSemVisita = Math.floor((hoje.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          clienteId:         c.id,
          clienteNome:       c.nome ?? '',
          telefone:          c.telefone ?? '',
          ultimoProcedimento: last?.procedimento ?? '',
          profissional:      last?.profissional ?? '',
          dataUltimaVisita:  c.data_ultima_visita,
          diasSemVisita,
        };
      })
      .sort((a, b) => b.diasSemVisita - a.diasSemVisita);
  },

  async marcarClienteNaoRetorna(clienteId: string, naoRetorna: boolean, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('clientes')
      .update({ crc_nao_retorna: naoRetorna })
      .eq('id', clienteId)
      .eq('user_id', uid);
    if (error) throw humanizeError(error);
  },

  async registrarCrcAcao(
    payload: { clienteId: string; tipo: CrcAcaoTipo; contexto: CrcAcaoContexto; observacao?: string | null; usuarioNome: string },
    userId: string
  ): Promise<CrcAcao> {
    const uid = await requireUserId(userId);
    const { data, error } = await supabase
      .from('crc_acoes')
      .insert({
        user_id:      uid,
        cliente_id:   payload.clienteId,
        tipo:         payload.tipo,
        contexto:     payload.contexto,
        observacao:   payload.observacao ?? null,
        usuario_nome: payload.usuarioNome,
      })
      .select()
      .single();
    if (error || !data) throw humanizeError(error);
    return {
      id:          data.id,
      clienteId:   data.cliente_id,
      tipo:        data.tipo as CrcAcaoTipo,
      contexto:    data.contexto as CrcAcaoContexto,
      observacao:  data.observacao ?? null,
      usuarioNome: data.usuario_nome,
      createdAt:   data.created_at,
    };
  },

  // ── WhatsApp Integrado (US-017) ───────────────────────────────────────

  async getWhatsAppConfig(userId: string): Promise<WhatsAppConfig> {
    const uid = await requireUserId(userId);
    const { data } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (!data) return { id: null, provider: 'zapi', zapiInstance: '', zapiToken: '', zapiClientToken: '', numeroOficial: '', horaInicio: '08:00', horaFim: '20:00', ativo: false };
    return {
      id:               data.id,
      provider:         data.provider as WhatsAppProvider,
      zapiInstance:     data.zapi_instance ?? '',
      zapiToken:        data.zapi_token ?? '',
      zapiClientToken:  data.zapi_client_token ?? '',
      numeroOficial:    data.numero_oficial ?? '',
      horaInicio:       data.hora_inicio ?? '08:00',
      horaFim:          data.hora_fim ?? '20:00',
      ativo:            data.ativo ?? false,
    };
  },

  async saveWhatsAppConfig(config: Omit<WhatsAppConfig, 'id'>, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const payload = {
      user_id:           uid,
      provider:          config.provider,
      zapi_instance:     config.zapiInstance || null,
      zapi_token:        config.zapiToken || null,
      zapi_client_token: config.zapiClientToken || null,
      numero_oficial:    config.numeroOficial || null,
      hora_inicio:       config.horaInicio,
      hora_fim:          config.horaFim,
      ativo:             config.ativo,
      updated_at:        new Date().toISOString(),
    };
    const { error } = await supabase
      .from('whatsapp_config')
      .upsert({ ...payload }, { onConflict: 'user_id' });
    if (error) throw humanizeError(error);
  },

  async getWhatsAppMensagens(userId: string, clienteId?: string, limit = 100): Promise<WhatsAppMensagem[]> {
    const uid = await requireUserId(userId);
    let q = supabase
      .from('whatsapp_mensagens')
      .select('*, clientes(nome)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (clienteId) q = (q as any).eq('cliente_id', clienteId);
    const { data, error } = await q;
    if (error) throw humanizeError(error);
    return (data ?? []).map((row: any) => ({
      id:             row.id,
      clienteId:      row.cliente_id,
      clienteNome:    row.clientes?.nome ?? undefined,
      direcao:        row.direcao as 'out' | 'in',
      conteudo:       row.conteudo,
      status:         row.status as WhatsAppStatus,
      providerMsgId:  row.provider_msg_id ?? null,
      batchId:        row.batch_id ?? null,
      usuarioNome:    row.usuario_nome ?? '',
      agendadoPara:   row.agendado_para ?? null,
      errorMsg:       row.error_msg ?? null,
      createdAt:      row.created_at,
    }));
  },

  async sendWhatsApp(
    payload: { clienteId: string; clienteNome: string; telefone: string; mensagem: string; batchId?: string | null },
    userId: string,
    usuarioNome: string
  ): Promise<{ mensagemId: string; mode: 'api' | 'link' | 'fora_horario' | 'opt_out' | 'sem_telefone' }> {
    const uid = await requireUserId(userId);

    // Verifica opt-out
    const { data: optOut } = await supabase
      .from('whatsapp_opt_out')
      .select('id')
      .eq('user_id', uid)
      .eq('cliente_id', payload.clienteId)
      .maybeSingle();
    if (optOut) return { mensagemId: '', mode: 'opt_out' };

    // Verifica telefone
    if (!payload.telefone?.trim()) return { mensagemId: '', mode: 'sem_telefone' };

    // Loga a mensagem como "enviando"
    const { data: msg, error: logErr } = await supabase
      .from('whatsapp_mensagens')
      .insert({
        user_id:      uid,
        cliente_id:   payload.clienteId,
        direcao:      'out',
        conteudo:     payload.mensagem,
        status:       'enviando',
        batch_id:     payload.batchId ?? null,
        usuario_nome: usuarioNome,
      })
      .select('id')
      .single();
    if (logErr || !msg) throw humanizeError(logErr);

    // Verifica config e horário
    const cfg = await api.getWhatsAppConfig(uid);

    const agora = new Date();
    const [hIni, mIni] = cfg.horaInicio.split(':').map(Number);
    const [hFim, mFim] = cfg.horaFim.split(':').map(Number);
    const minAgora = agora.getHours() * 60 + agora.getMinutes();
    const minIni   = hIni * 60 + mIni;
    const minFim   = hFim * 60 + mFim;
    const dentroHorario = minAgora >= minIni && minAgora <= minFim;

    if (!dentroHorario) {
      await supabase.from('whatsapp_mensagens').update({ status: 'agendado' }).eq('id', msg.id);
      return { mensagemId: msg.id, mode: 'fora_horario' };
    }

    // Tenta enviar via Edge Function (API real) se configurado
    if (cfg.ativo && cfg.zapiInstance && cfg.zapiToken) {
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('send-whatsapp', {
          body: { mensagemId: msg.id, clienteId: payload.clienteId, mensagem: payload.mensagem, telefone: payload.telefone, userId: uid },
        });
        if (!fnErr && fnData?.success) {
          return { mensagemId: msg.id, mode: 'api' };
        }
      } catch (_) { /* fallback to wa.me */ }
    }

    // Fallback: wa.me link (abre navegador)
    const num   = payload.telefone.replace(/\D/g, '');
    const phone = num.startsWith('55') ? num : `55${num}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(payload.mensagem)}`, '_blank');
    await supabase.from('whatsapp_mensagens').update({ status: 'enviado' }).eq('id', msg.id);
    return { mensagemId: msg.id, mode: 'link' };
  },

  async getWhatsAppOptOuts(userId: string): Promise<WhatsAppOptOut[]> {
    const uid = await requireUserId(userId);
    const { data, error } = await supabase
      .from('whatsapp_opt_out')
      .select('*, clientes(nome)')
      .eq('user_id', uid)
      .order('opt_out_at', { ascending: false });
    if (error) throw humanizeError(error);
    return (data ?? []).map((row: any) => ({
      id:          row.id,
      clienteId:   row.cliente_id,
      clienteNome: row.clientes?.nome ?? undefined,
      motivo:      row.motivo ?? '',
      optOutAt:    row.opt_out_at,
    }));
  },

  async marcarOptOut(clienteId: string, motivo: string, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('whatsapp_opt_out')
      .upsert({ user_id: uid, cliente_id: clienteId, motivo, opt_out_at: new Date().toISOString() }, { onConflict: 'user_id,cliente_id' });
    if (error) throw humanizeError(error);
  },

  async removerOptOut(clienteId: string, userId: string): Promise<void> {
    const uid = await requireUserId(userId);
    const { error } = await supabase
      .from('whatsapp_opt_out')
      .delete()
      .eq('user_id', uid)
      .eq('cliente_id', clienteId);
    if (error) throw humanizeError(error);
  },

  async getWhatsAppBatchResult(batchId: string, userId: string): Promise<WhatsAppBatchResult> {
    const uid = await requireUserId(userId);
    const { data, error } = await supabase
      .from('whatsapp_mensagens')
      .select('status')
      .eq('user_id', uid)
      .eq('batch_id', batchId);
    if (error) throw humanizeError(error);
    const rows = data ?? [];
    return {
      batchId,
      total:        rows.length,
      enviados:     rows.filter((r: any) => ['enviado', 'entregue', 'lido'].includes(r.status)).length,
      falhas:       rows.filter((r: any) => r.status === 'falha').length,
      optOuts:      0,
      semTelefone:  0,
    };
  },

  // ── Planos de Tratamento (US-026) ──────────────────────────────────

  async getPlanosTratamento(userId: string, clienteId: string): Promise<PlanoTratamento[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('planos_tratamento')
        .select('*')
        .eq('user_id', uid)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPlanoTratamento);
    });
  },

  async createPlanoTratamento(
    userId: string,
    clienteId: string,
    payload: Omit<PlanoTratamento, 'id' | 'clienteId' | 'createdAt' | 'updatedAt'>,
  ): Promise<PlanoTratamento> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('planos_tratamento')
        .insert({
          user_id:                uid,
          cliente_id:             clienteId,
          nome_protocolo:         payload.nomeProtocolo,
          objetivo:               payload.objetivo,
          procedimentos:          payload.procedimentos,
          total_sessoes:          payload.totalSessoes,
          frequencia_recomendada: payload.frequenciaRecomendada,
          frequencia_dias:        payload.frequenciaDias ?? null,
          observacoes_iniciais:   payload.observacoesIniciais,
          status:                 'ativo',
        })
        .select()
        .single();
      if (error) throw error;
      return mapPlanoTratamento(data);
    });
  },

  async updatePlanoTratamento(
    id: string,
    userId: string,
    payload: Partial<Pick<PlanoTratamento, 'status' | 'motivoEncerramento'>>,
  ): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payload.status !== undefined) updates.status = payload.status;
      if (payload.motivoEncerramento !== undefined) updates.motivo_encerramento = payload.motivoEncerramento;
      const { error } = await supabase
        .from('planos_tratamento')
        .update(updates)
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async getSessoesTratamento(userId: string, planoId: string): Promise<SessaoTratamento[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('sessoes_tratamento')
        .select('*')
        .eq('user_id', uid)
        .eq('plano_id', planoId)
        .order('numero_sessao', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapSessaoTratamento);
    });
  },

  async registrarSessaoTratamento(
    userId: string,
    planoId: string,
    payload: {
      numeroSessao: number;
      observacoesClinicas: string;
      materiaisUsados: string;
      fotoAntes?: string | null;
      fotoDepois?: string | null;
      nivelResposta?: number | null;
      agendamentoId?: string | null;
    },
  ): Promise<SessaoTratamento> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const dataHoje = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('sessoes_tratamento')
        .upsert(
          {
            user_id:              uid,
            plano_id:             planoId,
            numero_sessao:        payload.numeroSessao,
            data_realizada:       dataHoje,
            agendamento_id:       payload.agendamentoId ?? null,
            observacoes_clinicas: payload.observacoesClinicas,
            materiais_usados:     payload.materiaisUsados,
            foto_antes:           payload.fotoAntes ?? null,
            foto_depois:          payload.fotoDepois ?? null,
            nivel_resposta:       payload.nivelResposta ?? null,
            realizada:            true,
          },
          { onConflict: 'plano_id,numero_sessao' },
        )
        .select()
        .single();
      if (error) throw error;

      // auto-concluir plano quando todas as sessões foram realizadas
      const { data: plano } = await supabase
        .from('planos_tratamento')
        .select('total_sessoes, status')
        .eq('id', planoId)
        .single();
      if (plano?.status === 'ativo') {
        const { count } = await supabase
          .from('sessoes_tratamento')
          .select('id', { count: 'exact', head: true })
          .eq('plano_id', planoId)
          .eq('realizada', true);
        if ((count ?? 0) >= plano.total_sessoes) {
          await supabase
            .from('planos_tratamento')
            .update({ status: 'concluido', updated_at: new Date().toISOString() })
            .eq('id', planoId);
        }
      }

      return mapSessaoTratamento(data);
    });
  },

  async getPlanoAlertasContinuidade(userId: string): Promise<PlanoAlertaContinuidade[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('vw_planos_alerta_continuidade')
        .select('*')
        .eq('user_id', uid);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        planoId:           row.plano_id,
        clienteId:         row.cliente_id,
        clienteNome:       row.cliente_nome ?? '',
        clienteTelefone:   row.cliente_telefone ?? '',
        nomeProtocolo:     row.nome_protocolo ?? '',
        totalSessoes:      row.total_sessoes ?? 0,
        sessoesRealizadas: Number(row.sessoes_realizadas ?? 0),
        sessoesRestantes:  Number(row.sessoes_restantes ?? 0),
        ultimaSessao:      row.ultima_sessao ?? '',
        frequenciaDias:    row.frequencia_dias ?? 0,
      }));
    });
  },

  async getCrcAcoes(userId: string, clienteId?: string): Promise<CrcAcao[]> {
    const uid = await requireUserId(userId);
    let q = supabase
      .from('crc_acoes')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(200);
    if (clienteId) q = (q as any).eq('cliente_id', clienteId);
    const { data, error } = await q;
    if (error) throw humanizeError(error);
    return (data ?? []).map((row: any) => ({
      id:          row.id,
      clienteId:   row.cliente_id,
      tipo:        row.tipo as CrcAcaoTipo,
      contexto:    row.contexto as CrcAcaoContexto,
      observacao:  row.observacao ?? null,
      usuarioNome: row.usuario_nome,
      createdAt:   row.created_at,
    }));
  },

  // ── US-027: Templates de Prescrições ─────────────────────────────────

  async getPrescricaoTemplates(
    userId: string,
    options?: { categoria?: TemplateCategoria; somenteProprios?: boolean }
  ): Promise<PrescricaoTemplate[]> {
    return run(async () => {
      const uid = await requireUserId(userId);
      let q = supabase
        .from('prescricao_templates')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (options?.categoria) q = (q as any).eq('categoria', options.categoria);
      const { data, error } = await q;
      if (error) throw error;
      const all = (data ?? []).map(mapPrescricaoTemplate);
      if (options?.somenteProprios) {
        return all.filter(t => t.criadoPorUserId === uid);
      }
      return all.filter(t => t.compartilhado || t.criadoPorUserId === uid);
    });
  },

  async createPrescricaoTemplate(
    dados: Pick<PrescricaoTemplate, 'nome' | 'categoria' | 'conteudo' | 'variaveis' | 'compartilhado' | 'permissaoEdicao'> & { criadoPorNome: string },
    userId: string
  ): Promise<PrescricaoTemplate> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('prescricao_templates')
        .insert({
          user_id:            uid,
          criado_por_user_id: uid,
          criado_por_nome:    dados.criadoPorNome,
          nome:               dados.nome,
          categoria:          dados.categoria,
          conteudo:           dados.conteudo,
          variaveis:          dados.variaveis,
          compartilhado:      dados.compartilhado,
          permissao_edicao:   dados.permissaoEdicao,
        })
        .select()
        .single();
      if (error) throw error;
      return mapPrescricaoTemplate(data);
    });
  },

  async updatePrescricaoTemplate(
    id: string,
    dados: Partial<Pick<PrescricaoTemplate, 'nome' | 'categoria' | 'conteudo' | 'variaveis' | 'compartilhado' | 'permissaoEdicao' | 'ativo'>>,
    editadoPorNome: string,
    userId: string
  ): Promise<PrescricaoTemplate> {
    return run(async () => {
      const uid = await requireUserId(userId);
      // Salva versão anterior antes de editar (se conteúdo mudou)
      if (dados.conteudo !== undefined) {
        const { data: atual } = await supabase
          .from('prescricao_templates')
          .select('conteudo')
          .eq('id', id)
          .single();
        if (atual?.conteudo && atual.conteudo !== dados.conteudo) {
          const { data: maxRow } = await supabase
            .from('prescricao_template_versoes')
            .select('versao')
            .eq('template_id', id)
            .order('versao', { ascending: false })
            .limit(1)
            .single();
          const proximaVersao = (maxRow?.versao ?? 0) + 1;
          await supabase.from('prescricao_template_versoes').insert({
            template_id:       id,
            versao:            proximaVersao,
            conteudo_anterior: atual.conteudo,
            editado_por_nome:  editadoPorNome,
          });
        }
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (dados.nome        !== undefined) patch.nome             = dados.nome;
      if (dados.categoria   !== undefined) patch.categoria        = dados.categoria;
      if (dados.conteudo    !== undefined) patch.conteudo         = dados.conteudo;
      if (dados.variaveis   !== undefined) patch.variaveis        = dados.variaveis;
      if (dados.compartilhado !== undefined) patch.compartilhado  = dados.compartilhado;
      if (dados.permissaoEdicao !== undefined) patch.permissao_edicao = dados.permissaoEdicao;
      if (dados.ativo       !== undefined) patch.ativo            = dados.ativo;
      const { data, error } = await supabase
        .from('prescricao_templates')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single();
      if (error) throw error;
      return mapPrescricaoTemplate(data);
    });
  },

  async deletePrescricaoTemplate(id: string, userId: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { error } = await supabase
        .from('prescricao_templates')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    });
  },

  async registrarUsoPrescricaoTemplate(
    templateId: string,
    clienteId: string | null,
    procedimento: string | null,
    userId: string
  ): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
      await supabase.from('prescricao_template_usos').insert({
        template_id:  templateId,
        user_id:      uid,
        cliente_id:   clienteId,
        procedimento: procedimento,
      });
      const { data: curr } = await supabase
        .from('prescricao_templates')
        .select('uso_count')
        .eq('id', templateId)
        .single();
      await supabase
        .from('prescricao_templates')
        .update({
          uso_count:    (curr?.uso_count ?? 0) + 1,
          ultimo_uso_em: new Date().toISOString(),
        })
        .eq('id', templateId);
    });
  },

  async getPrescricaoTemplateVersoes(templateId: string, userId: string): Promise<PrescricaoTemplateVersao[]> {
    return run(async () => {
      await requireUserId(userId);
      const { data, error } = await supabase
        .from('prescricao_template_versoes')
        .select('*')
        .eq('template_id', templateId)
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPrescricaoTemplateVersao);
    });
  },

  async getPrescricaoTemplateUsos(templateId: string, userId: string): Promise<PrescricaoTemplateUso[]> {
    return run(async () => {
      await requireUserId(userId);
      const { data, error } = await supabase
        .from('prescricao_template_usos')
        .select('*')
        .eq('template_id', templateId)
        .order('usado_em', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(mapPrescricaoTemplateUso);
    });
  },
};

// ── Mappers internos (US-012) ─────────────────────────────────────────

function mapOrcamento(row: any): Orcamento {
  return {
    id:               row.id,
    clienteId:        row.cliente_id ?? null,
    leadId:           row.lead_id ?? null,
    nomeCliente:      row.nome_cliente ?? '',
    telefone:         row.telefone ?? '',
    profissionalId:   row.profissional_id ?? null,
    profissionalNome: row.profissional_nome ?? null,
    dataEnvio:        row.data_envio ?? '',
    validade:         row.validade ?? '',
    status:           (row.status as OrcamentoStatus) ?? 'aberto',
    motivoPerdaKey:   (row.motivo_perda as OrcamentoMotivoPerdaKey) ?? null,
    valorTotal:       row.valor_total ?? 0,
    observacoes:      row.observacoes ?? null,
    itens:            Array.isArray(row.orcamento_itens)
                        ? row.orcamento_itens.map(mapOrcamentoItem)
                        : undefined,
    createdAt:        row.created_at ?? '',
    updatedAt:        row.updated_at ?? '',
  };
}

function mapOrcamentoItem(row: any): OrcamentoItem {
  return {
    id:             row.id,
    orcamentoId:    row.orcamento_id,
    procedimentoId: row.procedimento_id ?? null,
    descricao:      row.descricao ?? '',
    quantidade:     row.quantidade ?? 1,
    valorUnitario:  row.valor_unitario ?? 0,
    valorTotal:     (row.quantidade ?? 1) * (row.valor_unitario ?? 0),
  };
}

function mapFollowupConfig(row: any): OrcamentoFollowupConfig {
  return {
    id:               row.id,
    diasAposEnvio:    row.dias_apos_envio,
    canal:            row.canal as OrcamentoCanalFollowup,
    mensagemTemplate: row.mensagem_template ?? '',
    ativo:            row.ativo ?? true,
    ordem:            row.ordem ?? 0,
  };
}

function mapFollowupLog(row: any): OrcamentoFollowupLog {
  return {
    id:           row.id,
    orcamentoId:  row.orcamento_id,
    configId:     row.config_id ?? null,
    canal:        row.canal ?? '',
    mensagem:     row.mensagem ?? '',
    enviadoEm:    row.enviado_em ?? '',
    status:       row.status ?? 'pendente',
  };
}

// ── Mappers internos (US-026) ─────────────────────────────────────────

function mapPlanoTratamento(row: any): PlanoTratamento {
  return {
    id:                     row.id,
    clienteId:              row.cliente_id,
    nomeProtocolo:          row.nome_protocolo ?? '',
    objetivo:               row.objetivo ?? '',
    procedimentos:          row.procedimentos ?? '',
    totalSessoes:           row.total_sessoes ?? 1,
    frequenciaRecomendada:  row.frequencia_recomendada ?? '',
    frequenciaDias:         row.frequencia_dias ?? null,
    observacoesIniciais:    row.observacoes_iniciais ?? '',
    status:                 (row.status as PlanoStatus) ?? 'ativo',
    motivoEncerramento:     row.motivo_encerramento ?? null,
    createdAt:              row.created_at ?? '',
    updatedAt:              row.updated_at ?? '',
  };
}

function mapSessaoTratamento(row: any): SessaoTratamento {
  return {
    id:                   row.id,
    planoId:              row.plano_id,
    numeroSessao:         row.numero_sessao,
    dataRealizada:        row.data_realizada ?? null,
    agendamentoId:        row.agendamento_id ?? null,
    observacoesClinicas:  row.observacoes_clinicas ?? '',
    materiaisUsados:      row.materiais_usados ?? '',
    fotoAntes:            row.foto_antes ?? null,
    fotoDepois:           row.foto_depois ?? null,
    nivelResposta:        row.nivel_resposta ?? null,
    realizada:            row.realizada ?? false,
    createdAt:            row.created_at ?? '',
  };
}

// ── US-027: Templates de Prescrições ────────────────────────────────

function mapPrescricaoTemplate(row: any): PrescricaoTemplate {
  return {
    id:                row.id,
    userId:            row.user_id,
    criadoPorUserId:   row.criado_por_user_id,
    criadoPorNome:     row.criado_por_nome ?? '',
    nome:              row.nome ?? '',
    categoria:         (row.categoria as TemplateCategoria) ?? 'outro',
    conteudo:          row.conteudo ?? '',
    variaveis:         row.variaveis ?? [],
    compartilhado:     row.compartilhado ?? false,
    permissaoEdicao:   (row.permissao_edicao as TemplatePermissaoEdicao) ?? 'somente_criador',
    ativo:             row.ativo ?? true,
    usoCount:          row.uso_count ?? 0,
    ultimoUsoEm:       row.ultimo_uso_em ?? null,
    createdAt:         row.created_at ?? '',
    updatedAt:         row.updated_at ?? '',
  };
}

function mapPrescricaoTemplateVersao(row: any): PrescricaoTemplateVersao {
  return {
    id:               row.id,
    templateId:       row.template_id,
    versao:           row.versao,
    conteudoAnterior: row.conteudo_anterior ?? '',
    editadoPorNome:   row.editado_por_nome ?? '',
    editadoEm:        row.editado_em ?? '',
  };
}

function mapPrescricaoTemplateUso(row: any): PrescricaoTemplateUso {
  return {
    id:          row.id,
    templateId:  row.template_id,
    userId:      row.user_id,
    clienteId:   row.cliente_id ?? null,
    procedimento: row.procedimento ?? null,
    usadoEm:     row.usado_em ?? '',
  };
}

// Marcador para detectar mock import residual em tooling/lint.
export const __api_uses_only_supabase__ = true;
