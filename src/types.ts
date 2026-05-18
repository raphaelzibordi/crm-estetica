export interface Usuario {
  id: string; // Supabase auth.users id
  nome_clinica: string;
  telefone: string;
  endereco: string;
  email: string;
  created_at?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  dataNascimento: string;
  fotoUrl: string;
  dataUltimaVisita: string;
  statusRetencao: 'em_dia' | 'alerta_retencao' | 'ausente';
  tags: string[]; // ex: ['Pele Seca', 'Premium', 'Indicação']
}

export interface EvolucaoClinica {
  id: string;
  data: string;
  profissional: string;
  procedimento: string;
  relatoNatural: string; // Ex: "Paciente apresentou excelente receptividade ao Lavieen. Leve eritema pós-procedimento já atenuado com máscara calmante."
  observacoesTecnicas: string;
}

export interface AntesDepois {
  id: string;
  dataAntes: string;
  dataDepois: string;
  imagemAntes: string;
  imagemDepois: string;
  descricao: string;
}

export interface ProntuarioEstetico {
  clienteId: string;
  evolucoes: EvolucaoClinica[];
  galeria: AntesDepois[];
}

export type StatusJornada = 'agendada' | 'chegou' | 'atendimento' | 'checkout' | 'finalizada';

export interface Agendamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteFoto?: string;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaFim: string; // HH:MM
  profissional: string;
  sala: string;
  procedimento: string;
  status: StatusJornada;
  tempoEsperaMinutos?: number; // Tempo de espera na clínica
  horarioChegada?: string;
  valor: number;
  metodoPagamento?: 'pix' | 'credito' | 'debito' | 'dinheiro';
}

export interface Procedimento {
  id: string;
  nome: string;
  descricao?: string;
  duracaoMinutos: number;
  validadeDias: number;
  preco: number;
  salaRequerida: string;
  profissionalResponsavel: string;
}

export interface ItemEstoque {
  id: string;
  produto: string;
  quantidade: number;
  quantidadeMinima: number;
  unidade: string;
  status: 'normal' | 'critico';
  ultimaReposicao: string;
}

export interface ClienteRetorno {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  ultimoProcedimento: string;
  dataUltimoProcedimento: string;
  motivoAlerta: string; // Ex: "Botox vencendo (120 dias)", "Ausente há 60 dias"
  tempoAusenciaDias: number;
  templateSugeridoId: string;
}

export interface TemplateMensagem {
  id: string;
  titulo: string;
  gatilho: string;
  texto: string;
}

export interface FechamentoFinanceiro {
  faturamentoTotal: number;
  comissoesPagas: number;
  formasPagamento: {
    metodo: string;
    valor: number;
    percentual: number;
  }[];
}

export interface GaleriaItem {
  id: string;
  clienteId: string;
  imagem: string;
  data: string;
  descricao: string;
}

export type MetodoPagamento = 'pix' | 'credito' | 'debito' | 'dinheiro';

export const IS_TYPED = true;
