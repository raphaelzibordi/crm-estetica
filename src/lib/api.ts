import { supabase } from './supabase';
import { ApiError, humanizeError } from './errors';
import type {
  Agendamento,
  Cliente,
  EvolucaoClinica,
  ItemEstoque,
  StatusJornada,
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
  // PERFIL DO USUÁRIO (clínica)
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

  async upsertPerfil(
    perfil: { nome_clinica?: string; telefone?: string; endereco?: string; email?: string },
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
};
