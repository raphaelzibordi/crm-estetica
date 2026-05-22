export type UserRole = 'dono' | 'equipe';

export interface Usuario {
  id: string;
  nome: string;            // nome pessoal
  nomeClinica: string;
  telefone: string;        // telefone da clínica
  telefonePessoal: string;
  endereco: string;
  email: string;
  dataNascimento: string;
  fotoUrl: string;
  role: UserRole;
  ownerId: string | null;  // preenchido quando role = 'equipe'
  created_at?: string;
}

export interface UserProfile {
  nome: string;
  fotoUrl: string;
  role: UserRole;
  tenantId: string; // owner's user_id (for equipe) or own user_id (for dono)
  cargo?: string;      // job title — equipe only
  nomeClinica?: string; // owner's clinic name — equipe only, used in welcome modal
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
  // US-007b: Confirmação automática
  confirmacaoMetodo?: 'whatsapp' | 'sms';
  confirmacaoEnviadaEm?: string;
  confirmacaoStatus?: 'pendente' | 'enviada' | 'entregue' | 'lido';
  confirmacaoTelefone?: string;
  // US-007c: Controle de presença/faltas
  presencaStatus?: 'compareceu' | 'faltou' | 'desmarcou';
  faltaMotivo?: string;
  faltaRegistradaEm?: string;
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
  bookingVisivel?: boolean;
}

export interface MembroEquipe {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  fotoUrl?: string;
  ativo: boolean;
  bookingVisivel?: boolean;
}

export interface Profissional {
  id: string;
  nome: string;
  cargo: string;
  isResponsavel: boolean;
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

// ── Agendamento Online (US-007) ──────────────────────────────────

export interface ClinicaPublica {
  userId: string;
  nomeClinica: string;
  minAdvanceHoras: number;
  maxAdvanceDias: number;
}

export interface ProfissionalPublico {
  id: string;
  nome: string;
  cargo: string;
}

export interface ProcedimentoPublico {
  id: string;
  nome: string;
  duracaoMinutos: number;
  preco: number;
  salaRequerida: string;
  profissionalResponsavel: string;
}

export interface SlotOcupado {
  horaInicio: string; // HH:MM
  horaFim: string;    // HH:MM
}

export interface BookingSettings {
  bookingSlug: string | null;
  bookingEnabled: boolean;
  bookingMinAdvanceHoras: number;
  bookingMaxAdvanceDias: number;
}

// ── Confirmações Automáticas (US-007b) ───────────────────────────

export interface ConfirmacaoSettings {
  confirmacaoHabilitada: boolean;
  confirmacaoMetodoPadrao: 'whatsapp' | 'sms' | 'ambos';
  confirmacaoHorasAntes: number;    // Primeiro lembrete (ex: 48)
  confirmacaoHorasAntes2: number;   // Segundo lembrete (ex: 2)
}

export interface ConfirmacaoLog {
  id: string;
  agendamentoId: string;
  metodo: 'whatsapp' | 'sms';
  telefone: string;
  mensagem?: string;
  status: 'enviada' | 'entregue' | 'erro';
  erroMensagem?: string;
  enviadaEm: string;
}

// ── Controle de Presença/Faltas (US-007c) ─────────────────────

export interface HistoricoPresenca {
  agendamentoId: string;
  data: string;
  horaInicio: string;
  profissional: string;
  procedimento: string;
  presencaStatus: 'compareceu' | 'faltou' | 'desmarcou' | null;
  faltaMotivo?: string;
  faltaRegistradaEm?: string;
}

export interface RiscoFalta {
  faltasUltimos60dias: number;
  totalComparecimentos: number;
  temRisco: boolean; // true se >= 2 faltas em 60 dias
}

export interface RelatorioFaltas {
  totalFaltas: number;
  totalAgendamentos: number;
  taxaFaltas: number; // percentual
  faltasPorProfissional?: Record<string, number>;
  faltasPorProcedimento?: Record<string, number>;
}

// ── Comissões (US-034) ────────────────────────────────────────────

export type ComissaoTipo = 'percentual' | 'fixo';
export type ComissaoPrioridade = 'especifica' | 'por_profissional' | 'por_procedimento';

export interface ComissaoRegra {
  id: string;
  profissionalId: string | null;
  profissionalNome?: string;
  procedimentoId: string | null;
  procedimentoNome?: string;
  tipo: ComissaoTipo;
  valor: number;
  ativo: boolean;
  prioridade: ComissaoPrioridade;
}

export interface Comissao {
  id: string;
  agendamentoId: string;
  profissionalId: string | null;
  profissionalNome: string;
  procedimentoNome: string;
  regraId: string | null;
  tipo: ComissaoTipo | null;
  percentualAplicado: number | null;
  valorBase: number;
  valorComissao: number;
  dataAtendimento: string;
  fechamentoId: string | null;
  semRegra: boolean;
  estornada: boolean;
}

export interface RelatorioComissaoProfissional {
  profissionalNome: string;
  profissionalId: string | null;
  totalAtendimentos: number;
  totalBase: number;
  totalComissao: number;
  itens: Comissao[];
}

export interface FechamentoComissao {
  id: string;
  profissionalId: string | null;
  profissionalNome: string | null;
  dataInicio: string;
  dataFim: string;
  totalComissao: number;
  quantidadeAtendimentos: number;
  fechadoEm: string;
  fechadoPor: string;
  observacoes?: string;
}

// ── Anamnese Digital (US-023) ─────────────────────────────────

export type AnamneseCampoTipo =
  | 'texto_livre'
  | 'multipla_escolha'
  | 'sim_nao'
  | 'escala_numerica'
  | 'assinatura_consentimento';

export interface AnamneseCampo {
  id: string;
  tipo: AnamneseCampoTipo;
  label: string;
  obrigatorio: boolean;
  opcoes?: string[]; // apenas para multipla_escolha
}

export interface AnamneseFormulario {
  id: string;
  nome: string;
  procedimentoId: string | null;
  procedimentoNome?: string;
  campos: AnamneseCampo[];
  ativo: boolean;
  createdAt: string;
}

export type AnamneseStatus = 'pendente' | 'preenchido' | 'assinado';

export interface AnamneseResposta {
  id: string;
  clienteId: string;
  formularioId: string;
  formularioNome?: string;
  agendamentoId: string | null;
  respostas: Record<string, string | string[] | number | boolean>;
  status: AnamneseStatus;
  tokenPublico: string;
  tokenExpiraEm: string | null;
  assinaturaData: string | null; // base64 PNG
  assinadoEm: string | null;
  revisadoPor: string | null;
  revisadoEm: string | null;
  createdAt: string;
}

// ── Assinatura Digital (US-025) ───────────────────────────────────

export type DocumentoTipo =
  | 'contrato'
  | 'tcle'
  | 'termo_anestesia'
  | 'termo_fotografias'
  | 'prescricao'
  | 'outro';

export type DocumentoStatus = 'pendente' | 'assinado' | 'expirado';
export type AssinaturaMetodo = 'presencial' | 'remoto';

export interface DocumentoModelo {
  id: string;
  nome: string;
  tipo: DocumentoTipo;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
  createdAt: string;
}

export interface DocumentoAssinado {
  id: string;
  clienteId: string;
  clienteNome?: string;
  modeloId: string | null;
  modeloNome?: string;
  titulo: string;
  conteudoFinal: string;
  hashIntegridade: string;
  assinaturaData: string | null;
  assinaturaMetodo: AssinaturaMetodo | null;
  assinadoEm: string | null;
  assinadoIp: string | null;
  assinadoDispositivo: string | null;
  profissional: string;
  status: DocumentoStatus;
  createdAt: string;
}

export interface DocumentoSignatureLink {
  id: string;
  documentoId: string;
  token: string;
  expiraEm: string;
  usadoEm: string | null;
}

// ── Repasse de Profissionais Autônomos (US-036) ───────────────────────

export type RepasseModelo = 'percentual' | 'fixo_periodo' | 'fixo_sessao';

export interface RepasseRegra {
  id: string;
  profissionalId: string;
  profissionalNome: string;
  modelo: RepasseModelo;
  valor: number;        // % (percentual) ou R$ (fixo_periodo / fixo_sessao)
  dataInicio: string;
  dataFim: string | null;
  ativo: boolean;
}

export interface RepasseItemSnapshot {
  agendamentoId: string;
  data: string;
  procedimento: string;
  valorLiquido: number;
  valorRepasse: number; // o que a clínica repassa ao profissional (percentual) ou cobra dele (fixo_sessao)
}

export interface FechamentoRepasse {
  id: string;
  profissionalId: string;
  profissionalNome: string;
  modelo: RepasseModelo;
  dataInicio: string;
  dataFim: string;
  totalAtendimentos: number;
  faturamentoBruto: number;
  valorRepasseProfissional: number; // saída da clínica (percentual) ou 0 (modelos fixos)
  valorRetencaoClinica: number;     // o que a clínica fica (percentual) ou recebe (fixos)
  itensSnapshot: RepasseItemSnapshot[];
  fechadoEm: string;
  fechadoPor: string;
  observacoes?: string;
  notificacaoEnviada: boolean;
}

export interface PreviewRepasse {
  regra: RepasseRegra | null;
  totalAtendimentos: number;
  faturamentoBruto: number;
  valorRepasseProfissional: number;
  valorRetencaoClinica: number;
  itens: RepasseItemSnapshot[];
}

export const IS_TYPED = true;
