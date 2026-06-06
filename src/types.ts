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
  // Resumo do histórico clínico gerado por IA (US-028 / CA-03)
  resumoClinicoIA: string | null;
  resumoClinicoIAGeradoEm: string | null;
}

export interface EvolucaoClinica {
  id: string;
  data: string;
  profissional: string;
  procedimento: string;
  relatoNatural: string; // Ex: "Paciente apresentou excelente receptividade ao Lavieen. Leve eritema pós-procedimento já atenuado com máscara calmante."
  observacoesTecnicas: string;
  // Assinatura digital e imutabilidade (US-021 / CFM 1.638/2002)
  assinadoEm: string | null;       // timestamp da assinatura — registro torna-se imutável a partir daqui
  assinadoPor: string | null;      // nome do profissional que assinou
  assinaturaHash: string | null;   // hash SHA-256 do conteúdo + identidade + timestamp
  aditamentoDe: string | null;     // id do registro original quando esta entrada é uma correção/aditamento
}

// ── IA no Prontuário: gravação, transcrição e estruturação (US-028) ──
export type StatusGravacaoConsulta =
  | 'aguardando_consentimento'
  | 'gravando'
  | 'transcrevendo'
  | 'em_revisao'
  | 'aprovada'
  | 'descartada';

export interface GravacaoConsulta {
  id: string;
  clienteId: string;
  profissional: string;
  // Consentimento explícito do paciente (CA-04) — obrigatório antes de gravar
  consentimentoAceito: boolean;
  consentimentoEm: string | null;
  status: StatusGravacaoConsulta;
  // Transcrição bruta (editável pelo profissional antes da aprovação) — CA-01
  transcricaoBruta: string | null;
  // Estruturação automática nas seções do prontuário — CA-02
  estruturaQueixa: string | null;
  estruturaHistorico: string | null;
  estruturaExame: string | null;
  estruturaConduta: string | null;
  estruturaPrescricao: string | null;
  cid10Sugestoes: string[];
  // Vínculo com a evolução clínica gerada após aprovação (US-021)
  evolucaoId: string | null;
  // Privacidade dos dados de IA (CA-05)
  audioExcluidoEm: string | null;
  createdAt: string;
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

// SALA-001/002: Gerenciamento de salas de atendimento
export interface Sala {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  createdAt?: string;
}

export interface SalaStatus {
  sala: Sala;
  disponivel: boolean;
  ocupadaPor?: string;
}

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
  roomId?: string; // SALA-002: FK para salas.id
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
  // SALA-005: Audit trail de mudanças de sala
  salaHistorico?: Array<{ from: string; to: string; changedAt: string }>;
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

export interface Room {
  id: string;
  name: string;
  description?: string;
  status: 'ativa' | 'inativa';
  createdAt: string;
}

export interface ItemEstoque {
  id: string;
  produto: string;
  quantidade: number;
  quantidadeMinima: number;
  unidade: string;
  status: 'normal' | 'critico';
  ultimaReposicao: string;
  // US-0444: campos estendidos
  custoUnitario: number;
  custoMedio: number;
  fornecedor: string;
  validade: string | null;
  observacoes: string;
}

// ── Estoque Fracionado (US-0444) ──────────────────────────────────────

export type EstoqueMovimentoTipo = 'entrada' | 'saida' | 'ajuste' | 'devolucao' | 'vencimento';

export interface EstoqueVinculo {
  id: string;
  userId: string;
  produtoId: string;
  produtoNome?: string;
  procedimentoNome: string;
  quantidade: number;
  ativo: boolean;
  createdAt: string;
}

export interface EstoqueMovimento {
  id: string;
  userId: string;
  produtoId: string;
  produtoNome?: string;
  tipo: EstoqueMovimentoTipo;
  quantidade: number;
  custoUnitario: number;
  referencia: string | null;
  agendamentoId: string | null;
  profissional: string | null;
  justificativa: string | null;
  criadoPor: string;
  createdAt: string;
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
  imagem: string;      // foto "antes"
  imagemDepois?: string; // foto "depois" (opcional para retrocompatibilidade)
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

// ── Pipeline de Leads / Funil CRM (US-011) ───────────────────────────

export type FunilEtapaTipo = 'ativo' | 'convertido' | 'perdido';
export type LeadOrigem = 'instagram' | 'google' | 'indicacao' | 'whatsapp' | 'tiktok' | 'outro';
export type LeadHistoricoTipo = 'movimentacao' | 'tarefa' | 'nota' | 'automacao';
export type LeadAutomacaoTipo = 'whatsapp' | 'email' | 'tarefa';
export type LeadAutomacaoGatilho = 'ao_entrar' | 'apos_dias';

export interface FunilEtapa {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  tipo: FunilEtapaTipo;
}

export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  procedimentoInteresse: string;
  origem: LeadOrigem;
  observacoes: string;
  etapaId: string;
  etapaEntradaEm: string; // ISO — quando entrou na etapa atual
  responsavelId: string | null;
  responsavelNome: string | null;
  clienteId: string | null; // preenchido após conversão
  createdAt: string;
  updatedAt: string;
}

export interface LeadHistorico {
  id: string;
  leadId: string;
  etapaAnteriorId: string | null;
  etapaNovaId: string;
  usuarioNome: string;
  observacao: string | null;
  tipo: LeadHistoricoTipo;
  createdAt: string;
}

export interface LeadAutomacao {
  id: string;
  etapaId: string;
  tipo: LeadAutomacaoTipo;
  gatilho: LeadAutomacaoGatilho;
  diasEspera: number | null;
  mensagem: string | null;
  tarefaTitulo: string | null;
  ativo: boolean;
}

export interface FunilMetricas {
  totalLeads: number;
  leadsPorEtapa: Record<string, number>;
  taxaConversaoPorEtapa: Record<string, number>; // % que saiu da etapa para a próxima
  tempoMedioPorEtapa: Record<string, number>;    // dias médios por etapa
  leadsPorOrigem: Record<string, number>;
  leadsHoje: number;
  leadsSemana: number;
  leadsMes: number;
}

// ── Orçamentos (US-012) ───────────────────────────────────────────────

export type OrcamentoStatus = 'aberto' | 'aprovado' | 'perdido' | 'expirado';
export type OrcamentoMotivoPerdaKey = 'preco' | 'concorrente' | 'nao_respondeu' | 'outro';
export type OrcamentoCanalFollowup = 'whatsapp' | 'email' | 'ambos';

export interface OrcamentoItem {
  id: string;
  orcamentoId: string;
  procedimentoId: string | null;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number; // calculado: quantidade * valorUnitario
}

export interface Orcamento {
  id: string;
  clienteId: string | null;
  leadId: string | null;
  nomeCliente: string;
  telefone: string;
  profissionalId: string | null;
  profissionalNome: string | null;
  dataEnvio: string;    // YYYY-MM-DD
  validade: string;     // YYYY-MM-DD
  status: OrcamentoStatus;
  motivoPerdaKey: OrcamentoMotivoPerdaKey | null;
  valorTotal: number;
  observacoes: string | null;
  itens?: OrcamentoItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrcamentoFollowupConfig {
  id: string;
  diasAposEnvio: number;
  canal: OrcamentoCanalFollowup;
  mensagemTemplate: string;
  ativo: boolean;
  ordem: number;
}

export interface OrcamentoFollowupLog {
  id: string;
  orcamentoId: string;
  configId: string | null;
  canal: string;
  mensagem: string;
  enviadoEm: string;
  status: 'pendente' | 'enviado' | 'falha';
}

export interface OrcamentoRelatorio {
  totalEnviados: number;
  totalAprovados: number;
  totalPerdidos: number;
  totalExpirados: number;
  taxaConversao: number;        // percentual aprovados / (aprovados + perdidos + expirados)
  valorTotalConvertido: number;
  ticketMedioAprovados: number;
  motivosPerda: Record<OrcamentoMotivoPerdaKey, number>;
}

// ── CRC — Central de Relacionamento (US-013) ─────────────────────────

export interface CrcFalta {
  agendamentoId: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  data: string;
  procedimento: string;
  profissional: string;
  faltaMotivo: string | null;
}

export type ContaReceberStatus = 'pendente' | 'pago' | 'vencido';

export interface ContaReceber {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: ContaReceberStatus;
  agendamentoId: string | null;
  observacoes: string | null;
  diasAtraso: number;
  createdAt: string;
}

export interface CrcSemReagendamento {
  clienteId: string;
  clienteNome: string;
  telefone: string;
  ultimoProcedimento: string;
  profissional: string;
  dataUltimaVisita: string;
  diasSemVisita: number;
}

export type CrcAcaoTipo = 'mensagem_whatsapp' | 'ligacao' | 'reagendamento' | 'cobranca' | 'nao_retorna' | 'outro';
export type CrcAcaoContexto = 'falta' | 'inadimplente' | 'sem_reagendamento';

export interface CrcAcao {
  id: string;
  clienteId: string;
  tipo: CrcAcaoTipo;
  contexto: CrcAcaoContexto;
  observacao: string | null;
  usuarioNome: string;
  createdAt: string;
}

// ── WhatsApp Integrado (US-017) ──────────────────────────────────────

export type WhatsAppProvider = 'zapi' | '360dialog' | 'twilio';
export type WhatsAppStatus = 'enviando' | 'enviado' | 'entregue' | 'lido' | 'falha' | 'agendado' | 'cancelado';
export type TemplateMensagemCategoria = 'cobranca' | 'relacionamento' | 'marketing' | 'operacional';

export interface WhatsAppConfig {
  id: string | null;
  provider: WhatsAppProvider;
  zapiInstance: string;
  zapiToken: string;
  zapiClientToken: string;
  numeroOficial: string;
  horaInicio: string;   // HH:MM
  horaFim: string;      // HH:MM
  ativo: boolean;
}

export interface WhatsAppMensagem {
  id: string;
  clienteId: string;
  clienteNome?: string;
  direcao: 'out' | 'in';
  conteudo: string;
  status: WhatsAppStatus;
  providerMsgId: string | null;
  batchId: string | null;
  usuarioNome: string;
  agendadoPara: string | null;
  errorMsg: string | null;
  createdAt: string;
}

export interface WhatsAppOptOut {
  id: string;
  clienteId: string;
  clienteNome?: string;
  motivo: string;
  optOutAt: string;
}

export interface WhatsAppBatchResult {
  batchId: string;
  total: number;
  enviados: number;
  falhas: number;
  optOuts: number;
  semTelefone: number;
}

// ── Plano de Tratamento (US-026) ─────────────────────────────────────

export type PlanoStatus = 'ativo' | 'concluido' | 'encerrado_antecipado';

export interface PlanoTratamento {
  id: string;
  clienteId: string;
  nomeProtocolo: string;
  objetivo: string;
  procedimentos: string;
  totalSessoes: number;
  frequenciaRecomendada: string;
  frequenciaDias: number | null;
  observacoesIniciais: string;
  status: PlanoStatus;
  motivoEncerramento: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessaoTratamento {
  id: string;
  planoId: string;
  numeroSessao: number;
  dataRealizada: string | null;
  agendamentoId: string | null;
  observacoesClinicas: string;
  materiaisUsados: string;
  fotoAntes: string | null;
  fotoDepois: string | null;
  nivelResposta: number | null;
  realizada: boolean;
  createdAt: string;
}

export interface PlanoAlertaContinuidade {
  planoId: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  nomeProtocolo: string;
  totalSessoes: number;
  sessoesRealizadas: number;
  sessoesRestantes: number;
  ultimaSessao: string;
  frequenciaDias: number;
}

// ── Templates de Prescrições (US-027) ────────────────────────────────

export type TemplateCategoria =
  | 'prescricao'
  | 'orientacao_pos_procedimento'
  | 'recomendacao_dermatologica'
  | 'recomendacao_estetica'
  | 'outro';

export type TemplatePermissaoEdicao = 'somente_criador' | 'qualquer_profissional';

export interface PrescricaoTemplate {
  id: string;
  userId: string;
  criadoPorUserId: string;
  criadoPorNome: string;
  nome: string;
  categoria: TemplateCategoria;
  conteudo: string;
  variaveis: string[];
  compartilhado: boolean;
  permissaoEdicao: TemplatePermissaoEdicao;
  ativo: boolean;
  usoCount: number;
  ultimoUsoEm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrescricaoTemplateVersao {
  id: string;
  templateId: string;
  versao: number;
  conteudoAnterior: string;
  editadoPorNome: string;
  editadoEm: string;
}

export interface PrescricaoTemplateUso {
  id: string;
  templateId: string;
  userId: string;
  clienteId: string | null;
  procedimento: string | null;
  usadoEm: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// US-047: LGPD
// ─────────────────────────────────────────────────────────────────────────────

export type LGPDConsentimentoTipo = 'servico' | 'marketing';
export type LGPDConsentimentoMetodo = 'checkbox' | 'assinatura_digital' | 'responsavel_legal';
export type LGPDSolicitacaoTipo = 'acesso' | 'exclusao' | 'portabilidade' | 'revogacao_consentimento';
export type LGPDSolicitacaoStatus = 'pendente' | 'em_processamento' | 'concluida' | 'rejeitada';

export interface LGPDConsentimento {
  id: string;
  userId: string;
  clienteId: string;
  versaoTermo: string;
  tipo: LGPDConsentimentoTipo;
  aceito: boolean;
  ipAddress?: string;
  metodo: LGPDConsentimentoMetodo;
  responsavelLegalNome?: string;
  responsavelLegalCpf?: string;
  termoTexto?: string;
  revogadoEm?: string;
  createdAt: string;
}

export interface LGPDSolicitacao {
  id: string;
  userId: string;
  clienteId: string;
  clienteNome?: string;
  tipo: LGPDSolicitacaoTipo;
  status: LGPDSolicitacaoStatus;
  motivo?: string;
  resposta?: string;
  processadoPor?: string;
  processadoEm?: string;
  prazoLegal?: string;
  dadosExportados?: Record<string, unknown>;
  createdAt: string;
}

export interface LGPDStats {
  totalPacientes: number;
  comConsentimentoServico: number;
  semConsentimento: number;
  comConsentimentoMarketing: number;
  solicitacoesPendentes: number;
  solicitacoesEmProcessamento: number;
}

// ── Gestão Financeira Prospectiva (US-033) ───────────────────────────

export type ContaPagarStatus = 'pendente' | 'pago' | 'vencido';
export type ContaPagarRecorrencia = 'unica' | 'mensal' | 'anual';
export type FormaRecebimento = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'outro';

export interface CategoriaDespesa {
  id: string;
  nome: string;
  cor: string;
  sistema: boolean;
  createdAt: string;
}

export interface ContaPagar {
  id: string;
  categoriaId: string | null;
  categoriaNome: string | null;
  categoriaCor: string | null;
  fornecedor: string;
  descricao: string | null;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: ContaPagarStatus;
  recorrencia: ContaPagarRecorrencia;
  comprovanteUrl: string | null;
  observacoes: string | null;
  createdAt: string;
}

export interface FluxoCaixaItem {
  data: string;
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoDia: number;
  saldoAcumulado: number;
}

export interface ResumoFinanceiro {
  totalAReceber: number;
  totalAPagar: number;
  saldoProjetado: number;
  vencendoEm3Dias: number;
  vencidos: number;
}

// ── US-048: Multiclínicas e Rede de Clínicas ────────────────────────

export interface Rede {
  id: string;
  ownerId: string;
  nome: string;
  descricao?: string;
  pacienteCompartilhado: boolean;
  descontoVolumePct: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Unidade {
  id: string;
  redeId: string;
  ownerId: string;
  nome: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UnidadeRole = 'gestor_rede' | 'dono' | 'equipe' | 'visualizador';

export interface UnidadeUsuario {
  id: string;
  unidadeId: string;
  userId: string;
  role: UnidadeRole;
  permissoes: Record<string, boolean>;
  ativo: boolean;
  createdAt: string;
}

export interface MetricasUnidade {
  unidadeId: string;
  unidadeNome: string;
  faturamento: number;
  totalAgendamentos: number;
  agendamentosFinalizados: number;
  ticketMedio: number;
}

export interface PainelRede {
  rede: Rede;
  unidades: Unidade[];
  metricas: MetricasUnidade[];
  totalFaturamento: number;
  totalAgendamentos: number;
  ticketMedioGeral: number;
  periodo: { dataInicio: string; dataFim: string };
}

export const IS_TYPED = true;
