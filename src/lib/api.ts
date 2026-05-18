import { supabase } from './supabase';
import { ApiError, humanizeError } from './errors';
import type {
  Agendamento,
  Cliente,
  ClienteRetorno,
  EvolucaoClinica,
  FechamentoFinanceiro,
  GaleriaItem,
  ItemEstoque,
  MembroEquipe,
  Procedimento,
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
  };
}

function mapEstoque(row: any): ItemEstoque {
  return {
    id: row.id,
    produto: row.produto,
    quantidade: Number(row.quantidade ?? 0),
    quantidadeMinima: Number(row.quantidade_minima ?? 0),
    unidade: row.unidade ?? 'un',
    status: (row.status as ItemEstoque['status']) ?? 'normal',
    ultimaReposicao: row.ultima_reposicao ?? '',
  };
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

      // Quando o atendimento é finalizado, registra a data como última visita do cliente
      if (updates.status === 'finalizada' && data?.cliente_id) {
        await supabase
          .from('clientes')
          .update({ data_ultima_visita: data.data })
          .eq('id', data.cliente_id)
          .eq('user_id', uid);
      }

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
        .insert([
          {
            user_id: uid,
            produto: item.produto,
            quantidade: item.quantidade,
            quantidade_minima: item.quantidadeMinima,
            unidade: item.unidade,
            status: item.status,
            ultima_reposicao: item.ultimaReposicao || null,
          },
        ])
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
    userId?: string
  ): Promise<ItemEstoque> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const updates: Record<string, unknown> = { quantidade, status };
      if (ultimaReposicao) updates.ultima_reposicao = ultimaReposicao;

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
  async getUserProfile(userId?: string): Promise<UserProfile> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('usuarios')
        .select('nome, foto_url, role, owner_id')
        .eq('id', uid)
        .maybeSingle();
      if (error) throw error;
      const role = ((data?.role as UserRole) ?? 'dono');
      const tenantId = (role === 'equipe' && data?.owner_id) ? data.owner_id : uid;
      return {
        nome: data?.nome ?? '',
        fotoUrl: data?.foto_url ?? '',
        role,
        tenantId,
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
        throw new ApiError('Selecione uma imagem para registrar a evolução.', 400);
      }
      const { data, error } = await supabase
        .from('galeria_antes_depois')
        .insert([
          {
            user_id: uid,
            cliente_id: clienteId,
            imagem: item.imagem,
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

  // ============================================================
  // FECHAMENTO FINANCEIRO (agregado a partir de agendamentos finalizados)
  // ============================================================
  async getFechamentoFinanceiro(
    userId: string | undefined,
    dataStr: string
  ): Promise<FechamentoFinanceiro> {
    return run(async () => {
      const uid = await requireUserId(userId);
      const { data, error } = await supabase
        .from('agendamentos')
        .select('valor, metodo_pagamento')
        .eq('user_id', uid)
        .eq('data', dataStr)
        .eq('status', 'finalizada');
      if (error) throw error;

      const rows = data ?? [];
      const faturamentoTotal = rows.reduce((sum, r: any) => sum + Number(r.valor || 0), 0);
      const comissoesPagas = Math.round(faturamentoTotal * 0.3 * 100) / 100;

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
  // SEED de dados padrão (fallback client-side caso o trigger DB falhe)
  // ============================================================
  async ensureSeedData(userId?: string): Promise<void> {
    return run(async () => {
      const uid = await requireUserId(userId);
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
};

// Marcador para detectar mock import residual em tooling/lint.
export const __api_uses_only_supabase__ = true;
