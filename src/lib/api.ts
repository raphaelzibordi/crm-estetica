import { supabase } from './supabase';
import type { Agendamento, Cliente, EvolucaoClinica, ItemEstoque, StatusJornada } from '../types';

export const api = {
  // Clientes
  async getClientes(userId: string) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('user_id', userId)
      .order('nome');
    if (error) throw error;
    return data;
  },
  
  async createCliente(cliente: Partial<Cliente>, userId: string) {
    const { data, error } = await supabase
      .from('clientes')
      .insert([{ 
        user_id: userId,
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        data_nascimento: cliente.dataNascimento,
        foto_url: cliente.fotoUrl,
        data_ultima_visita: cliente.dataUltimaVisita,
        status_retencao: cliente.statusRetencao || 'em_dia',
        tags: cliente.tags || []
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Agendamentos
  async getAgendamentos(userId: string, dataStr: string) {
    const { data, error } = await supabase
      .from('agendamentos')
      .select(`
        *,
        clientes (
          nome,
          foto_url
        )
      `)
      .eq('user_id', userId)
      .eq('data', dataStr)
      .order('hora_inicio');
    if (error) throw error;
    return data.map((item: any) => ({
      id: item.id,
      clienteId: item.cliente_id,
      clienteNome: item.clientes?.nome || 'Desconhecido',
      clienteFoto: item.clientes?.foto_url,
      data: item.data,
      horaInicio: item.hora_inicio,
      horaFim: item.hora_fim,
      profissional: item.profissional,
      sala: item.sala,
      procedimento: item.procedimento,
      status: item.status as StatusJornada,
      tempoEsperaMinutos: item.tempo_espera_minutos,
      horarioChegada: item.horario_chegada,
      valor: Number(item.valor)
    })) as Agendamento[];
  },

  async createAgendamento(agendamento: Omit<Agendamento, 'id' | 'clienteNome' | 'clienteFoto'>, userId: string) {
    const { data, error } = await supabase
      .from('agendamentos')
      .insert([{
        user_id: userId,
        cliente_id: agendamento.clienteId,
        data: agendamento.data,
        hora_inicio: agendamento.horaInicio,
        hora_fim: agendamento.horaFim,
        profissional: agendamento.profissional,
        sala: agendamento.sala,
        procedimento: agendamento.procedimento,
        status: agendamento.status,
        tempo_espera_minutos: agendamento.tempoEsperaMinutos,
        horario_chegada: agendamento.horarioChegada,
        valor: agendamento.valor
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAgendamentoStatus(id: string, updates: Partial<Agendamento>) {
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.horarioChegada !== undefined) dbUpdates.horario_chegada = updates.horarioChegada;
    if (updates.tempoEsperaMinutos !== undefined) dbUpdates.tempo_espera_minutos = updates.tempoEsperaMinutos;

    const { data, error } = await supabase
      .from('agendamentos')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Prontuarios / Evolucoes
  async getEvolucoes(userId: string, clienteId: string) {
    const { data, error } = await supabase
      .from('prontuarios_evolucoes')
      .select('*')
      .eq('user_id', userId)
      .eq('cliente_id', clienteId)
      .order('data', { ascending: false });
    if (error) throw error;
    return data.map((item: any) => ({
      id: item.id,
      data: item.data,
      profissional: item.profissional,
      procedimento: item.procedimento,
      relatoNatural: item.relato_natural,
      observacoesTecnicas: item.observacoes_tecnicas
    })) as EvolucaoClinica[];
  },

  async createEvolucao(clienteId: string, evolucao: Omit<EvolucaoClinica, 'id'>, userId: string) {
    const { data, error } = await supabase
      .from('prontuarios_evolucoes')
      .insert([{
        user_id: userId,
        cliente_id: clienteId,
        data: evolucao.data,
        profissional: evolucao.profissional,
        procedimento: evolucao.procedimento,
        relato_natural: evolucao.relatoNatural,
        observacoes_tecnicas: evolucao.observacoesTecnicas
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Estoque
  async getEstoque(userId: string) {
    const { data, error } = await supabase
      .from('estoque')
      .select('*')
      .eq('user_id', userId)
      .order('produto');
    if (error) throw error;
    return data.map((item: any) => ({
      id: item.id,
      produto: item.produto,
      quantidade: item.quantidade,
      quantidadeMinima: item.quantidade_minima,
      unidade: item.unidade,
      status: item.status,
      ultimaReposicao: item.ultima_reposicao
    })) as ItemEstoque[];
  },

  async updateEstoque(id: string, quantidade: number, status: string, ultimaReposicao?: string) {
    const updates: any = { quantidade, status };
    if (ultimaReposicao) updates.ultima_reposicao = ultimaReposicao;

    const { data, error } = await supabase
      .from('estoque')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
