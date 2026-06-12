// Utilitários de formatação compartilhados.
// Centraliza máscara de telefone, moeda BRL e formatação de data PT-BR
// para eliminar duplicações nos componentes.

export function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

/** Máscara de telefone BR: (11) 91234-5678 ou (11) 1234-5678. */
export function formatTelefone(value: string): string {
  const n = onlyDigits(value).slice(0, 11);
  if (n.length <= 2)  return n.length ? `(${n}` : '';
  if (n.length <= 6)  return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

/** Moeda em Reais (BRL). */
export function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Data ISO → dd/mm/aaaa. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

/** Data ISO → dd/mm hh:mm (curto). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
