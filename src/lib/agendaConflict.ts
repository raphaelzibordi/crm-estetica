import type { Agendamento, StatusJornada } from '../types';

export interface SalaStatus {
  sala: string;
  disponivel: boolean;
  ocupadaPor?: string; // "Profissional — HH:MM-HH:MM"
}

export interface ConflictCheckInput {
  clienteId: string;
  profissional: string;
  data: string;
  horaInicio: string;
  horaFim: string;
}

export type AgendaConflict =
  | { kind: 'cliente'; existente: Agendamento; mensagem: string }
  | { kind: 'profissional'; existente: Agendamento; mensagem: string };

const STATUS_OCUPADOS: ReadonlyArray<StatusJornada> = ['agendada', 'chegou', 'atendimento', 'checkout'];

function normalizeTime(t: string): string {
  return (t || '').length >= 5 ? t.substring(0, 5) : (t || '');
}

function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function sameNormalizedName(a: string, b: string): boolean {
  return (a || '').trim().toLocaleLowerCase('pt-BR') === (b || '').trim().toLocaleLowerCase('pt-BR');
}

/**
 * Regras de negócio:
 *   1. Mesmo paciente, mesmo profissional, mesmo horário → BLOQUEADO
 *   2. Mesmo paciente, profissionais diferentes, mesmo horário → BLOQUEADO
 *   3. Pacientes diferentes, profissionais diferentes, mesmo horário → PERMITIDO
 *
 * Agendamentos finalizados não bloqueiam (registro histórico).
 * Passe `ignoreId` ao editar para que o próprio agendamento não se conflite.
 */
export function findAgendamentoConflict(
  novo: ConflictCheckInput,
  existentes: Agendamento[],
  ignoreId?: string
): AgendaConflict | null {
  const novoStart = normalizeTime(novo.horaInicio);
  const novoEnd = normalizeTime(novo.horaFim);
  if (!novoStart || !novoEnd) return null;

  for (const a of existentes) {
    if (ignoreId && a.id === ignoreId) continue;
    if (a.data !== novo.data) continue;
    if (!STATUS_OCUPADOS.includes(a.status)) continue;

    const aStart = normalizeTime(a.horaInicio);
    const aEnd = normalizeTime(a.horaFim);
    if (!aStart || !aEnd) continue;

    if (!intervalsOverlap(novoStart, novoEnd, aStart, aEnd)) continue;

    if (novo.clienteId && a.clienteId === novo.clienteId) {
      return {
        kind: 'cliente',
        existente: a,
        mensagem: `Conflito de paciente: ${a.clienteNome} já possui um atendimento marcado das ${aStart} às ${aEnd} neste dia (com ${a.profissional}).`,
      };
    }

    if (sameNormalizedName(novo.profissional, a.profissional)) {
      return {
        kind: 'profissional',
        existente: a,
        mensagem: `Conflito de agenda: ${a.profissional} já está com outro atendimento das ${aStart} às ${aEnd} neste dia (paciente ${a.clienteNome}).`,
      };
    }
  }

  return null;
}

// ============================================================
// ENCAIXE INTELIGENTE — gap-finding algorithm
// ============================================================

const WORK_START_MIN = 8 * 60;
const WORK_END_MIN = 18 * 60;

function timeToMin(t: string): number {
  const parts = (t || '00:00').split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface EncaixeSugestao {
  hora: string;
  horaFim: string;
  profissional: string;
  profissionalId: string;
  sala: string;
  motivo: string;
  gapMinutos: number;
}

/**
 * Scan the day's appointments for each professional and return time windows
 * that are free for at least `duracaoMinutos`. Optionally filter to one
 * professional via `profissionalIdFiltro`.
 */
export function calcularEncaixeSugestoes(
  agendamentos: Agendamento[],
  profissionais: ReadonlyArray<{ id: string; nome: string }>,
  duracaoMinutos: number,
  salaRequerida: string,
  profissionalIdFiltro?: string,
): EncaixeSugestao[] {
  const targets = profissionalIdFiltro
    ? profissionais.filter((p) => p.id === profissionalIdFiltro)
    : profissionais;

  const sugestoes: EncaixeSugestao[] = [];

  for (const prof of targets) {
    const profNomeLower = (prof.nome ?? '').trim().toLocaleLowerCase('pt-BR');

    const ocupados = agendamentos
      .filter(
        (a) =>
          STATUS_OCUPADOS.includes(a.status) &&
          (a.profissional ?? '').trim().toLocaleLowerCase('pt-BR') === profNomeLower,
      )
      .map((a) => ({ start: timeToMin(a.horaInicio), end: timeToMin(a.horaFim) }))
      .sort((a, b) => a.start - b.start);

    let cursor = WORK_START_MIN;
    for (const { start, end } of ocupados) {
      if (start > cursor) {
        const gap = start - cursor;
        if (gap >= duracaoMinutos) {
          sugestoes.push(buildSugestao(cursor, duracaoMinutos, gap, prof, salaRequerida));
        }
      }
      cursor = Math.max(cursor, end);
    }

    if (cursor < WORK_END_MIN) {
      const gap = WORK_END_MIN - cursor;
      if (gap >= duracaoMinutos) {
        sugestoes.push(buildSugestao(cursor, duracaoMinutos, gap, prof, salaRequerida));
      }
    }
  }

  sugestoes.sort((a, b) => a.hora.localeCompare(b.hora));
  return sugestoes;
}

/**
 * Returns availability status for each sala at the given date/time window.
 * Uses the same STATUS_OCUPADOS guard as the profissional conflict check.
 */
export function getSalasStatus(
  salas: string[],
  data: string,
  horaInicio: string,
  horaFim: string,
  agendamentos: Agendamento[],
  ignoreId?: string,
): SalaStatus[] {
  const start = normalizeTime(horaInicio);
  const end = normalizeTime(horaFim);
  return salas.map((sala) => {
    if (!sala || !start || !end) return { sala, disponivel: true };
    const ocupante = agendamentos.find((a) => {
      if (ignoreId && a.id === ignoreId) return false;
      if (a.data !== data) return false;
      if (!STATUS_OCUPADOS.includes(a.status)) return false;
      if (!a.sala || a.sala.trim().toLocaleLowerCase('pt-BR') !== sala.trim().toLocaleLowerCase('pt-BR')) return false;
      return intervalsOverlap(start, end, normalizeTime(a.horaInicio), normalizeTime(a.horaFim));
    });
    return {
      sala,
      disponivel: !ocupante,
      ocupadaPor: ocupante
        ? `${ocupante.profissional} — ${normalizeTime(ocupante.horaInicio)}-${normalizeTime(ocupante.horaFim)}`
        : undefined,
    };
  });
}

function buildSugestao(
  startMin: number,
  duracaoMinutos: number,
  gapMinutos: number,
  prof: { id: string; nome: string },
  salaRequerida: string,
): EncaixeSugestao {
  const extra = gapMinutos - duracaoMinutos;
  let motivo: string;
  if (extra >= 30) {
    motivo = `Janela de ${gapMinutos} min — ${extra} min de margem para higienização da cabine.`;
  } else if (startMin >= 12 * 60 && startMin < 14 * 60) {
    motivo = `Início do turno da tarde. Cabine recém-higienizada e disponível.`;
  } else if (extra > 0) {
    motivo = `Janela de ${gapMinutos} min — tempo ideal para um procedimento de ${duracaoMinutos} min.`;
  } else {
    motivo = `Janela exata de ${gapMinutos} min para este procedimento.`;
  }
  return {
    hora: minToTime(startMin),
    horaFim: minToTime(startMin + duracaoMinutos),
    profissional: prof.nome,
    profissionalId: prof.id,
    sala: salaRequerida,
    motivo,
    gapMinutos,
  };
}
