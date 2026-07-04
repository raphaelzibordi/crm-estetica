import type { Procedimento } from '../types';
import { buildProcedimentosAgendados, sumDuracao, sumValor } from '../lib/procedimentoUtils';

interface ProcedimentoMultiSelectProps {
  procedimentos: Procedimento[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function ProcedimentoMultiSelect({ procedimentos, selectedIds, onChange }: ProcedimentoMultiSelectProps) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const itens = buildProcedimentosAgendados(procedimentos, selectedIds);
  const duracaoTotal = sumDuracao(itens);
  const valorTotal = sumValor(itens);

  if (procedimentos.length === 0) {
    return (
      <div className="form-input" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
        Cadastre procedimentos primeiro
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          maxHeight: '160px',
          overflowY: 'auto',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)',
        }}
      >
        {procedimentos.map((p) => {
          const checked = selectedIds.includes(p.id);
          return (
            <label
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                background: checked ? 'var(--color-primary-light)' : 'transparent',
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} />
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-main)' }}>{p.nome}</span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                R$ {p.preco.toLocaleString('pt-BR')}
              </span>
            </label>
          );
        })}
      </div>
      {itens.length > 0 && (
        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
          {itens.length} procedimento{itens.length > 1 ? 's' : ''} · Duração total: {duracaoTotal} min · Valor total: R$ {valorTotal.toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
}
