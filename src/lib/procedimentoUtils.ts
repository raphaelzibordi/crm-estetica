import type { Procedimento, ProcedimentoAgendado } from '../types';

export function buildProcedimentosAgendados(
  catalogo: Procedimento[],
  ids: string[],
): ProcedimentoAgendado[] {
  return ids
    .map((id) => catalogo.find((p) => p.id === id))
    .filter((p): p is Procedimento => !!p)
    .map((p) => ({
      procedimentoId: p.id,
      nome: p.nome,
      duracaoMinutos: p.duracaoMinutos ?? 60,
      preco: p.preco ?? 0,
      valorCobrado: p.preco ?? 0,
    }));
}

export function sumDuracao(itens: ProcedimentoAgendado[]): number {
  return itens.reduce((total, item) => total + (item.duracaoMinutos ?? 0), 0);
}

export function sumValor(itens: ProcedimentoAgendado[]): number {
  return itens.reduce((total, item) => total + (item.valorCobrado ?? item.preco ?? 0), 0);
}

export function joinNomes(itens: ProcedimentoAgendado[]): string {
  return itens.map((item) => item.nome).join(' + ');
}
