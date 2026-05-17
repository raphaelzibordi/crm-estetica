import type { Cliente, Agendamento, Procedimento, ItemEstoque, ClienteRetorno, TemplateMensagem, FechamentoFinanceiro, ProntuarioEstetico } from '../types';

export const mockClientes: Cliente[] = [
  {
    id: 'c1',
    nome: 'Alessandra Alencar',
    telefone: '(11) 98234-1122',
    email: 'alessandra.alencar@email.com',
    dataNascimento: '1988-04-12',
    fotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    dataUltimaVisita: '2026-05-10',
    statusRetencao: 'em_dia',
    tags: ['Preenchimento', 'Pele Seca', 'Premium']
  },
  {
    id: 'c2',
    nome: 'Beatriz Vasconcellos',
    telefone: '(11) 97112-8833',
    email: 'beatriz.v@email.com',
    dataNascimento: '1992-09-25',
    fotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    dataUltimaVisita: '2026-01-15',
    statusRetencao: 'alerta_retencao',
    tags: ['Botox', 'Pele Madura', 'Indicação']
  },
  {
    id: 'c3',
    nome: 'Camila Albuquerque',
    telefone: '(11) 99345-4455',
    email: 'camila.alb@email.com',
    dataNascimento: '1985-11-03',
    fotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    dataUltimaVisita: '2026-05-17',
    statusRetencao: 'em_dia',
    tags: ['Lavieen', 'Melasma']
  },
  {
    id: 'c4',
    nome: 'Debora Mendonça',
    telefone: '(11) 98123-6677',
    email: 'debora.mendonca@email.com',
    dataNascimento: '1979-07-14',
    fotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    dataUltimaVisita: '2026-03-05',
    statusRetencao: 'ausente',
    tags: ['Bioestimulador', 'Firmeza']
  },
  {
    id: 'c5',
    nome: 'Erika Schmidt',
    telefone: '(11) 99012-7788',
    email: 'erika.schmidt@email.com',
    dataNascimento: '1995-02-28',
    fotoUrl: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=150',
    dataUltimaVisita: '2026-05-15',
    statusRetencao: 'em_dia',
    tags: ['Lábios', 'Pele Jovem']
  }
];

export const mockProntuarios: Record<string, ProntuarioEstetico> = {
  c1: {
    clienteId: 'c1',
    evolucoes: [
      {
        id: 'ev1_1',
        data: '2026-05-10',
        profissional: 'Dra. Helena Martins',
        procedimento: 'Preenchimento Labial',
        relatoNatural: 'Realizado preenchimento labial com 1.0 ml de ácido hialurônico (Restylane Kysse). Aplicação suave visando definição do arco do cupido e volumização sutil do lábio inferior. Paciente relatou dor mínima. Edema leve esperado.',
        observacoesTecnicas: 'Técnica de retroinjeção e microbolus. Total de 1.0ml. Lote: H10293X.'
      },
      {
        id: 'ev1_2',
        data: '2025-11-12',
        profissional: 'Dra. Helena Martins',
        procedimento: 'Aplicação de Toxina Botulínica',
        relatoNatural: 'Aplicação preventiva em terço superior (glabela, fronte e orbicular dos olhos). Excelente relaxamento muscular mantendo a naturalidade da expressão facial.',
        observacoesTecnicas: 'Toxina Dysport, total 50U. Sem intercorrências.'
      }
    ],
    galeria: [
      {
        id: 'gal1',
        dataAntes: '2026-05-10',
        dataDepois: '2026-05-24', // Retorno ou pós simulado
        imagemAntes: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400', // Mock elegante lábios/face
        imagemDepois: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400',
        descricao: 'Preenchimento Labial - Evolução de simetria e volumização natural'
      }
    ]
  },
  c2: {
    clienteId: 'c2',
    evolucoes: [
      {
        id: 'ev2_1',
        data: '2026-01-15',
        profissional: 'Dra. Helena Martins',
        procedimento: 'Aplicação de Toxina Botulínica',
        relatoNatural: 'Paciente realizou aplicação em terço superior total. Ótima resposta muscular inicial. Já se passaram 120 dias, efeito começa a atenuar. Requer contato ativo para manutenção.',
        observacoesTecnicas: 'Toxina Dysport, total 48U.'
      }
    ],
    galeria: []
  },
  c3: {
    clienteId: 'c3',
    evolucoes: [
      {
        id: 'ev3_1',
        data: '2026-05-17',
        profissional: 'Esteticista Sarah Kelly',
        procedimento: 'Tecnologia Lavieen',
        relatoNatural: 'Sessão de Lavieen realizada com foco em refinar textura da pele e suavizar manchas de melasma na região malar. Pele apresentou eritema uniforme e leve calor ao final da aplicação. Aplicado sérum regenerador Lumina.',
        observacoesTecnicas: 'Energia 8mJ, modo dinâmico. Paciente orientada sobre fotoproteção rigorosa.'
      }
    ],
    galeria: [
      {
        id: 'gal3',
        dataAntes: '2026-04-10',
        dataDepois: '2026-05-17',
        imagemAntes: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400',
        imagemDepois: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400',
        descricao: 'Protocolo de Clareamento e Glow Facial Lavieen'
      }
    ]
  },
  c4: {
    clienteId: 'c4',
    evolucoes: [
      {
        id: 'ev4_1',
        data: '2026-03-05',
        profissional: 'Dra. Helena Martins',
        procedimento: 'Bioestimulador de Colágeno (Radiesse)',
        relatoNatural: 'Aplicação de bioestimulador em região de terço médio e inferior do rosto visando melhora da flacidez tissular e redefinição do contorno mandibular. Procedimento confortável.',
        observacoesTecnicas: '1 ampola de Radiesse diluída 1:2. Cânula 22G.'
      }
    ],
    galeria: []
  },
  c5: {
    clienteId: 'c5',
    evolucoes: [
      {
        id: 'ev5_1',
        data: '2026-05-15',
        profissional: 'Dra. Helena Martins',
        procedimento: 'Preenchimento de Olheiras',
        relatoNatural: 'Correção sutil do sulco lacrimal com ácido hialurônico de baixa densidade (Restylane Refyne). Melhora imediata do aspecto de cansaço facial. Sem equimoses.',
        observacoesTecnicas: '0.6 ml total (0.3 ml cada lado). Agulha 30G profunda.'
      }
    ],
    galeria: []
  }
};

export const mockProcedimentos: Procedimento[] = [
  {
    id: 'p1',
    nome: 'Toxina Botulínica (Botox)',
    duracaoMinutos: 45,
    validadeDias: 120,
    preco: 1200,
    salaRequerida: 'Cabine 01 - Clínica',
    profissionalResponsavel: 'Dra. Helena Martins'
  },
  {
    id: 'p2',
    nome: 'Lavieen (Pele de Porcelana)',
    duracaoMinutos: 60,
    validadeDias: 90,
    preco: 800,
    salaRequerida: 'Cabine 02 - Tecnologias',
    profissionalResponsavel: 'Esteticista Sarah Kelly'
  },
  {
    id: 'p3',
    nome: 'Preenchimento com Ácido Hialurônico',
    duracaoMinutos: 60,
    validadeDias: 360,
    preco: 1600,
    salaRequerida: 'Cabine 01 - Clínica',
    profissionalResponsavel: 'Dra. Helena Martins'
  },
  {
    id: 'p4',
    nome: 'Bioestimulador de Colágeno (Radiesse)',
    duracaoMinutos: 75,
    validadeDias: 360,
    preco: 2200,
    salaRequerida: 'Cabine 01 - Clínica',
    profissionalResponsavel: 'Dra. Helena Martins'
  },
  {
    id: 'p5',
    nome: 'Peeling Químico Renovador',
    duracaoMinutos: 45,
    validadeDias: 30,
    preco: 450,
    salaRequerida: 'Cabine 03 - Facial',
    profissionalResponsavel: 'Esteticista Sarah Kelly'
  }
];

export const mockAgendamentosDia: Agendamento[] = [
  {
    id: 'a1',
    clienteId: 'c1',
    clienteNome: 'Alessandra Alencar',
    clienteFoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    data: '2026-05-17',
    horaInicio: '09:00',
    horaFim: '10:00',
    profissional: 'Dra. Helena Martins',
    sala: 'Cabine 01 - Clínica',
    procedimento: 'Preenchimento com Ácido Hialurônico',
    status: 'finalizada',
    valor: 1600
  },
  {
    id: 'a2',
    clienteId: 'c3',
    clienteNome: 'Camila Albuquerque',
    clienteFoto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    data: '2026-05-17',
    horaInicio: '10:30',
    horaFim: '11:30',
    profissional: 'Esteticista Sarah Kelly',
    sala: 'Cabine 02 - Tecnologias',
    procedimento: 'Lavieen (Pele de Porcelana)',
    status: 'atendimento',
    horarioChegada: '10:20',
    tempoEsperaMinutos: 10,
    valor: 800
  },
  {
    id: 'a3',
    clienteId: 'c5',
    clienteNome: 'Erika Schmidt',
    clienteFoto: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=150',
    data: '2026-05-17',
    horaInicio: '11:45',
    horaFim: '12:30',
    profissional: 'Dra. Helena Martins',
    sala: 'Cabine 01 - Clínica',
    procedimento: 'Peeling Químico Renovador',
    status: 'chegou',
    horarioChegada: '11:35',
    tempoEsperaMinutos: 10,
    valor: 450
  },
  {
    id: 'a4',
    clienteId: 'c2',
    clienteNome: 'Beatriz Vasconcellos',
    clienteFoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    data: '2026-05-17',
    horaInicio: '14:00',
    horaFim: '14:45',
    profissional: 'Dra. Helena Martins',
    sala: 'Cabine 01 - Clínica',
    procedimento: 'Toxina Botulínica (Botox)',
    status: 'agendada',
    valor: 1200
  },
  {
    id: 'a5',
    clienteId: 'c4',
    clienteNome: 'Debora Mendonça',
    clienteFoto: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    data: '2026-05-17',
    horaInicio: '15:30',
    horaFim: '16:45',
    profissional: 'Dra. Helena Martins',
    sala: 'Cabine 01 - Clínica',
    procedimento: 'Bioestimulador de Colágeno (Radiesse)',
    status: 'agendada',
    valor: 2200
  }
];

export const mockEstoque: ItemEstoque[] = [
  {
    id: 'e1',
    produto: 'Toxina Dysport 500U',
    quantidade: 3,
    quantidadeMinima: 5,
    unidade: 'frasco',
    status: 'critico',
    ultimaReposicao: '2026-05-01'
  },
  {
    id: 'e2',
    produto: 'Restylane Kysse 1ml',
    quantidade: 8,
    quantidadeMinima: 4,
    unidade: 'seringa',
    status: 'normal',
    ultimaReposicao: '2026-05-10'
  },
  {
    id: 'e3',
    produto: 'Restylane Refyne 1ml',
    quantidade: 2,
    quantidadeMinima: 3,
    unidade: 'seringa',
    status: 'critico',
    ultimaReposicao: '2026-04-20'
  },
  {
    id: 'e4',
    produto: 'Radiesse Duo 1.5ml',
    quantidade: 7,
    quantidadeMinima: 4,
    unidade: 'seringa',
    status: 'normal',
    ultimaReposicao: '2026-05-12'
  },
  {
    id: 'e5',
    produto: 'Ponteira Lavieen Descartável',
    quantidade: 25,
    quantidadeMinima: 10,
    unidade: 'unidade',
    status: 'normal',
    ultimaReposicao: '2026-05-15'
  },
  {
    id: 'e6',
    produto: 'Creme Regenerador Lumina 50g',
    quantidade: 4,
    quantidadeMinima: 8,
    unidade: 'pote',
    status: 'critico',
    ultimaReposicao: '2026-04-15'
  }
];

export const mockTemplatesMensagens: TemplateMensagem[] = [
  {
    id: 't1',
    titulo: 'Retorno de Toxina Botulínica (120 dias)',
    gatilho: 'Vencimento do efeito do procedimento',
    texto: 'Olá, {nome}. Como você está? ✨ Há cerca de 4 meses cuidamos do seu rosto com a Toxina Botulínica. O efeito protetor da musculatura costuma atenuar por agora. O que acha de reservarmos um momento esta semana para Dra. Helena avaliar e mantermos sua expressão sempre descansada e rejuvenescida?'
  },
  {
    id: 't2',
    titulo: 'Boas-vindas pós-procedimento (24h)',
    gatilho: 'Dia seguinte ao tratamento',
    texto: 'Olá, {nome}! Passando para saber como está se sentindo após o procedimento de ontem. Lembre-se de seguir as orientações personalizadas que deixamos no seu prontuário e caprichar no filtro solar. Se tiver qualquer dúvida, Dra. Helena e eu estamos à inteira disposição. Um abraço carinhoso!'
  },
  {
    id: 't3',
    titulo: 'Resgate de Cliente Ausente (60 dias)',
    gatilho: 'Mais de 60 dias sem visitas',
    texto: 'Olá, {nome}! Sentimos sua falta na clínica nas últimas semanas. 🌸 Preparamos um carinho especial para o seu retorno: uma sessão exclusiva do nosso protocolo Glow Facial como cortesia ao agendar seu próximo cuidado. Qual dia fica melhor para reservarmos sua cabine?'
  }
];

export const mockClientesRetorno: ClienteRetorno[] = [
  {
    id: 'r1',
    clienteId: 'c2',
    clienteNome: 'Beatriz Vasconcellos',
    telefone: '(11) 97112-8833',
    ultimoProcedimento: 'Toxina Botulínica (Botox)',
    dataUltimoProcedimento: '2026-01-15',
    motivoAlerta: 'Toxina expirada (122 dias)',
    tempoAusenciaDias: 122,
    templateSugeridoId: 't1'
  },
  {
    id: 'r2',
    clienteId: 'c4',
    clienteNome: 'Debora Mendonça',
    telefone: '(11) 98123-6677',
    ultimoProcedimento: 'Bioestimulador (Radiesse)',
    dataUltimoProcedimento: '2026-03-05',
    motivoAlerta: 'Ausência prolongada (73 dias)',
    tempoAusenciaDias: 73,
    templateSugeridoId: 't3'
  }
];

export const mockFinanceiro: FechamentoFinanceiro = {
  faturamentoTotal: 6250, // Faturamento bruto simulado para o dia (ex: procedimentos já pagos e agendados)
  comissoesPagas: 1875, // 30% comissão média para profissionais
  formasPagamento: [
    { metodo: 'Pix', valor: 3125, percentual: 50 },
    { metodo: 'Cartão de Crédito (Parcelado)', valor: 2500, percentual: 40 },
    { metodo: 'Cartão de Débito', valor: 625, percentual: 10 }
  ]
};
