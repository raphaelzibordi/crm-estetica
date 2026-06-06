// ============================================================================
// US-028 · E5-G7 — IA no prontuário: transcrição de áudio e
// resumo automático do histórico clínico
//
// Esta camada concentra os DOIS pontos de integração com IA externa:
//   1) Transcrição de áudio (CA-01)
//   2) Estruturação do relato em seções do prontuário + sugestão de CID-10,
//      e geração do resumo de histórico clínico (CA-02 / CA-03)
//
// Decisão de escopo (registrada explicitamente — ver conversa com o usuário):
//   • Transcrição: usa a Web Speech API nativa do navegador
//     (SpeechRecognition / webkitSpeechRecognition) — gratuita, sem chaves
//     externas, funciona em Chrome/Edge. É um substituto pragmático para
//     Whisper/Google STT/Azure citados no card; pode ser trocado depois
//     sem alterar o restante do fluxo (a interface `TranscricaoEngine` abaixo
//     é o ponto único de troca).
//   • Estruturação e resumo: heurísticas determinísticas locais (mock),
//     com a função `chamarLLMEstruturacao` como ÚNICO ponto de integração
//     a ser plugado a uma API real (Claude API / GPT-4) quando houver chave.
//     Nenhum dado de áudio/texto é hoje enviado a provedores de LLM — ver
//     CA-05 (privacidade dos dados de IA).
// ============================================================================

// ---------------------------------------------------------------------------
// 1) Transcrição de áudio (CA-01) — Web Speech API
// ---------------------------------------------------------------------------

export interface TranscricaoListener {
  onInterimResult?: (textoParcial: string) => void;
  onFinalResult?: (trecho: string) => void;
  onError?: (mensagem: string) => void;
  onEnd?: () => void;
}

export interface TranscricaoEngine {
  disponivel: boolean;
  iniciar: (listener: TranscricaoListener) => void;
  parar: () => void;
}

/**
 * Cria um motor de transcrição baseado na Web Speech API do navegador.
 * Retorna `disponivel = false` quando a API não existe (ex.: Firefox,
 * Safari antigo, ambientes headless) — a UI deve então oferecer a
 * digitação manual da transcrição como alternativa.
 */
export function criarMotorTranscricao(idioma: string = 'pt-BR'): TranscricaoEngine {
  const SpeechRecognitionCtor: any =
    (typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
    null;

  if (!SpeechRecognitionCtor) {
    return {
      disponivel: false,
      iniciar: () => {},
      parar: () => {},
    };
  }

  let recognition: any = null;

  return {
    disponivel: true,
    iniciar(listener: TranscricaoListener) {
      recognition = new SpeechRecognitionCtor();
      recognition.lang = idioma;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const texto = result[0]?.transcript ?? '';
          if (result.isFinal) {
            listener.onFinalResult?.(texto.trim());
          } else {
            interim += texto;
          }
        }
        if (interim) listener.onInterimResult?.(interim.trim());
      };

      recognition.onerror = (event: any) => {
        listener.onError?.(event?.error || 'Erro desconhecido na transcrição.');
      };

      recognition.onend = () => {
        listener.onEnd?.();
      };

      try {
        recognition.start();
      } catch (e: any) {
        listener.onError?.(e?.message || 'Não foi possível iniciar a transcrição.');
      }
    },
    parar() {
      try {
        recognition?.stop();
      } catch {
        /* no-op */
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 2) Estruturação automática (CA-02) — heurísticas locais (mock do LLM)
// ---------------------------------------------------------------------------

export interface EstruturaProntuario {
  queixaPrincipal: string;
  historico: string;
  exame: string;
  conduta: string;
  prescricao: string;
  cid10Sugestoes: string[];
}

// Pequeno dicionário de termos estéticos/clínicos -> sugestão de CID-10.
// Em produção isso seria substituído pela resposta do LLM (ver
// `chamarLLMEstruturacao`); aqui serve como heurística determinística
// para que a função seja testável e útil sem depender de API externa.
const CID10_PISTAS: Array<{ termos: RegExp; codigo: string; descricao: string }> = [
  { termos: /melasma|mancha(s)? (de pele|escura)/i, codigo: 'L81.1', descricao: 'Melasma / hipercromia' },
  { termos: /acne|cravo|espinha/i, codigo: 'L70', descricao: 'Acne' },
  { termos: /rosácea|vermelhidão facial/i, codigo: 'L71', descricao: 'Rosácea' },
  { termos: /flacidez|firmeza da pele/i, codigo: 'L98.8', descricao: 'Flacidez cutânea' },
  { termos: /cicatriz/i, codigo: 'L90.5', descricao: 'Condições cicatriciais da pele' },
  { termos: /eritema|vermelhidão|irritação/i, codigo: 'L53.9', descricao: 'Eritema não especificado' },
  { termos: /alergia|alérgic[ao]|reação alérgica/i, codigo: 'L23.9', descricao: 'Dermatite de contato alérgica' },
];

function sugerirCID10(texto: string): string[] {
  const sugestoes: string[] = [];
  for (const pista of CID10_PISTAS) {
    if (pista.termos.test(texto)) {
      sugestoes.push(`${pista.codigo} — ${pista.descricao}`);
    }
  }
  return sugestoes;
}

/**
 * Divide o texto transcrito em frases e as distribui heuristicamente
 * pelas seções do prontuário (Queixa, Histórico, Exame, Conduta, Prescrição),
 * com base em palavras-chave típicas de cada seção.
 *
 * IMPORTANTE (regra de negócio do card): "A IA sugere — o profissional
 * decide." Esta função NUNCA é o destino final dos dados — o resultado
 * é sempre apresentado para revisão e edição antes de ser salvo (CA-02).
 */
function estruturarPorHeuristica(transcricao: string): EstruturaProntuario {
  const frases = transcricao
    .split(/(?<=[.!?])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);

  const secoes: Record<'queixa' | 'historico' | 'exame' | 'conduta' | 'prescricao', string[]> = {
    queixa: [],
    historico: [],
    exame: [],
    conduta: [],
    prescricao: [],
  };

  const padroes: Array<{ chave: keyof typeof secoes; regex: RegExp }> = [
    { chave: 'queixa', regex: /queixa|relata|reclama|incomod|veio (porque|para)|procurou/i },
    { chave: 'historico', regex: /histór|já fez|anteriormente|sessões? anteriores|tratamentos? anteriores|desde/i },
    { chave: 'exame', regex: /exame|observ[ao]|apresenta|nota-se|à inspeção|pele (apresenta|está)|visualiz/i },
    { chave: 'conduta', regex: /conduta|indicad[oa]|recomend|plano|próxim[ao]|sugiro|sugerimos|procedimento (realizado|indicado)/i },
    { chave: 'prescricao', regex: /prescri|use|aplicar|aplique|produto|protetor solar|hidratante|posologia|tomar/i },
  ];

  for (const frase of frases) {
    let alocado = false;
    for (const { chave, regex } of padroes) {
      if (regex.test(frase)) {
        secoes[chave].push(frase);
        alocado = true;
        break;
      }
    }
    if (!alocado) {
      // Frases sem palavra-chave clara entram no histórico/observações gerais
      secoes.historico.push(frase);
    }
  }

  const juntar = (arr: string[], vazio: string) => (arr.length ? arr.join(' ') : vazio);

  return {
    queixaPrincipal: juntar(secoes.queixa, '(Não identificado automaticamente — revise a transcrição e preencha manualmente.)'),
    historico: juntar(secoes.historico, '(Sem histórico identificado automaticamente.)'),
    exame: juntar(secoes.exame, '(Nenhuma observação de exame identificada automaticamente.)'),
    conduta: juntar(secoes.conduta, '(Nenhuma conduta identificada automaticamente.)'),
    prescricao: juntar(secoes.prescricao, '(Nenhuma prescrição identificada automaticamente.)'),
    cid10Sugestoes: sugerirCID10(transcricao),
  };
}

/**
 * ÚNICO PONTO DE INTEGRAÇÃO com um LLM real (Claude API / GPT-4).
 *
 * Hoje retorna o resultado da heurística local — nenhum dado é enviado
 * a provedores externos (CA-05: "processamento ocorre em ambiente isolado,
 * sem retenção de dados"). Quando uma chave de API for configurada
 * (ex.: ANTHROPIC_API_KEY), substitua o corpo desta função por uma chamada
 * real, mantendo a mesma assinatura — nada mais no app precisa mudar.
 */
export async function chamarLLMEstruturacao(transcricao: string): Promise<EstruturaProntuario> {
  // TODO(integração futura): plugar Claude API / GPT-4 aqui.
  // const resp = await fetch('/api/ia/estruturar', { method: 'POST', body: JSON.stringify({ transcricao }) });
  // return await resp.json();
  return estruturarPorHeuristica(transcricao);
}

// ---------------------------------------------------------------------------
// 3) Resumo do histórico clínico (CA-03) — heurística local (mock do LLM)
// ---------------------------------------------------------------------------

export interface DadosResumoClinico {
  nomeCliente: string;
  idade: number | null;
  totalAtendimentos: number;
  primeiraVisita: string | null; // ISO date
  ultimaVisita: string | null;   // ISO date
  procedimentosFrequentes: string[]; // já ordenados por frequência desc.
}

function calcularIdade(dataNascimentoISO: string | null | undefined): number | null {
  if (!dataNascimentoISO) return null;
  const nascimento = new Date(dataNascimentoISO);
  if (isNaN(nascimento.getTime())) return null;
  const idadeMs = Date.now() - nascimento.getTime();
  return Math.floor(idadeMs / (365.25 * 24 * 3600 * 1000));
}

function formatarMesAno(dataISO: string): string {
  const d = new Date(dataISO);
  if (isNaN(d.getTime())) return dataISO;
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/**
 * Monta um resumo em linguagem natural do histórico clínico, no formato
 * exemplificado no card: "Paciente de 35 anos, 8 atendimentos desde
 * março/2025, tratamento de melasma com peeling e laser, boa resposta
 * após sessão 4...".
 */
function gerarResumoPorHeuristica(dados: DadosResumoClinico): string {
  const partes: string[] = [];

  if (dados.idade !== null) {
    partes.push(`Paciente de ${dados.idade} anos`);
  } else {
    partes.push(`Paciente ${dados.nomeCliente} (idade não informada)`);
  }

  if (dados.totalAtendimentos > 0) {
    const desde = dados.primeiraVisita ? `, desde ${formatarMesAno(dados.primeiraVisita)}` : '';
    partes.push(`${dados.totalAtendimentos} atendimento${dados.totalAtendimentos > 1 ? 's' : ''}${desde}`);
  } else {
    partes.push('ainda sem atendimentos registrados no prontuário');
  }

  if (dados.procedimentosFrequentes.length > 0) {
    const principais = dados.procedimentosFrequentes.slice(0, 3).join(', ');
    partes.push(`tratamento(s) recorrente(s): ${principais}`);
  }

  if (dados.ultimaVisita) {
    partes.push(`última atualização do prontuário em ${new Date(dados.ultimaVisita).toLocaleDateString('pt-BR')}`);
  }

  return partes.join(', ') + '.';
}

/**
 * ÚNICO PONTO DE INTEGRAÇÃO com um LLM real para o resumo clínico.
 * Mesma observação de `chamarLLMEstruturacao`: hoje 100% local/heurístico,
 * pronto para ser substituído por uma chamada real sem alterar o app.
 */
export async function chamarLLMResumoClinico(dados: DadosResumoClinico): Promise<string> {
  // TODO(integração futura): plugar Claude API / GPT-4 aqui.
  // const resp = await fetch('/api/ia/resumo', { method: 'POST', body: JSON.stringify({ dados }) });
  // return (await resp.json()).resumo;
  return gerarResumoPorHeuristica(dados);
}
