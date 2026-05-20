import type { Agendamento, StatusJornada } from '../types';

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
