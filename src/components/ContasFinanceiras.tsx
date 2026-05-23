import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle, Plus, Trash2, X, Check, DollarSign,
  TrendingUp, TrendingDown, Upload, FileText, BarChart3, Tag, Bell,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  ContaPagar,
  ContaPagarRecorrencia,
  ContaReceber,
  CategoriaDespesa,
  FluxoCaixaItem,
  ResumoFinanceiro,
} from '../types';

interface ContasFinanceirasProps {
  userId: string;
}

type SubTab = 'receber' | 'pagar' | 'fluxo' | 'categorias';
type HorizonteDias = 30 | 60 | 90;

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtISO = (d: Date) => d.toISOString().split('T')[0];

const STATUS_COLORS: Record<string, string> = {
  pendente: '#f59e0b',
  pago:     '#10b981',
  vencido:  '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  pago:     'Pago',
  vencido:  'Vencido',
};

const RECORRENCIA_LABELS: Record<ContaPagarRecorrencia, string> = {
  unica:   'Única',
  mensal:  'Mensal',
  anual:   'Anual',
};

const FORMAS_RECEBIMENTO = [
  { value: 'pix',     label: 'Pix' },
  { value: 'credito', label: 'Cartão de Crédito' },
  { value: 'debito',  label: 'Cartão de Débito' },
  { value: 'dinheiro',label: 'Dinheiro' },
  { value: 'outro',   label: 'Outro' },
];

// ─── Barra de abas interna ───────────────────────────────────────────────────
function SubTabBar({ active, onChange }: { active: SubTab; onChange: (t: SubTab) => void }) {
  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'receber',    label: 'A Receber',    icon: <TrendingUp size={14} /> },
    { key: 'pagar',      label: 'A Pagar',      icon: <TrendingDown size={14} /> },
    { key: 'fluxo',      label: 'Fluxo de Caixa', icon: <BarChart3 size={14} /> },
    { key: 'categorias', label: 'Categorias',   icon: <Tag size={14} /> },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
            background: active === t.key ? 'var(--color-primary)' : 'var(--color-card)',
            color: active === t.key ? '#fff' : 'var(--color-text-muted)',
            transition: 'background 0.15s',
          }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Cards de resumo ─────────────────────────────────────────────────────────
function ResumoCards({ resumo }: { resumo: ResumoFinanceiro | null }) {
  if (!resumo) return null;
  const cards = [
    { label: 'Total a Receber', value: fmtBRL(resumo.totalAReceber), color: '#10b981', icon: <TrendingUp size={18} /> },
    { label: 'Total a Pagar',   value: fmtBRL(resumo.totalAPagar),   color: '#ef4444', icon: <TrendingDown size={18} /> },
    { label: 'Saldo Projetado', value: fmtBRL(resumo.saldoProjetado),
      color: resumo.saldoProjetado >= 0 ? '#10b981' : '#ef4444',
      icon: <DollarSign size={18} /> },
    { label: 'Vencendo em 3 dias', value: resumo.vencendoEm3Dias.toString(),
      color: resumo.vencendoEm3Dias > 0 ? '#f59e0b' : 'var(--color-text-muted)',
      icon: <Bell size={18} /> },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
      {cards.map(c => (
        <div key={c.label} className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.color, marginBottom: 6 }}>
            {c.icon}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>{c.label}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Alerta de vencimento ────────────────────────────────────────────────────
function AlertaVencimento({ resumo }: { resumo: ResumoFinanceiro | null }) {
  if (!resumo || (resumo.vencendoEm3Dias === 0 && resumo.vencidos === 0)) return null;
  return (
    <div style={{
      background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10,
      padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <AlertTriangle size={18} color="#92400e" />
      <span style={{ fontSize: 13, color: '#92400e', fontWeight: 500 }}>
        {resumo.vencidos > 0 && `${resumo.vencidos} conta(s) vencida(s). `}
        {resumo.vencendoEm3Dias > 0 && `${resumo.vencendoEm3Dias} conta(s) a pagar vencendo nos próximos 3 dias.`}
      </span>
    </div>
  );
}

// ─── Aba: Contas a Receber ───────────────────────────────────────────────────
function AbaReceber({ userId, onReload }: { userId: string; onReload: () => void }) {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'' | 'pendente' | 'pago' | 'vencido'>('');
  const [receberModal, setReceberModal] = useState<ContaReceber | null>(null);
  const [dataPagamento, setDataPagamento] = useState(fmtISO(new Date()));
  const [formaRecebimento, setFormaRecebimento] = useState('pix');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getContasReceber(userId);
      setContas(data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const filtradas = filtroStatus ? contas.filter(c => c.status === filtroStatus) : contas;

  const handleReceber = async () => {
    if (!receberModal) return;
    setSaving(true);
    try {
      await api.receberContaReceber(userId, receberModal.id, dataPagamento, formaRecebimento);
      setReceberModal(null);
      await load();
      onReload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Filtro de status */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['', 'pendente', 'vencido', 'pago'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            style={{
              padding: '5px 12px', borderRadius: 20, border: '1px solid var(--color-border)',
              fontSize: 12, cursor: 'pointer',
              background: filtroStatus === s ? 'var(--color-primary)' : 'var(--color-card)',
              color: filtroStatus === s ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {s === '' ? 'Todos' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Carregando...</p>
      ) : filtradas.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Nenhuma conta a receber.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map(c => (
            <div key={c.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.clienteNome}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.descricao}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 100 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtBRL(c.valor)}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Venc. {fmtDate(c.dataVencimento)}</div>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                background: STATUS_COLORS[c.status] + '22',
                color: STATUS_COLORS[c.status],
              }}>
                {STATUS_LABELS[c.status]}
              </span>
              {c.status !== 'pago' && (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => { setReceberModal(c); setDataPagamento(fmtISO(new Date())); setFormaRecebimento('pix'); }}
                >
                  <Check size={13} /> Receber
                </button>
              )}
              {c.status === 'pago' && c.dataPagamento && (
                <span style={{ fontSize: 11, color: '#10b981' }}>Pago em {fmtDate(c.dataPagamento)}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: registrar recebimento */}
      {receberModal && (
        <div className="modal-overlay" onClick={() => setReceberModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>Registrar Recebimento</h3>
              <button className="btn-icon" onClick={() => setReceberModal(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{receberModal.clienteNome}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{receberModal.descricao}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmtBRL(receberModal.valor)}</div>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Data do recebimento
                <input type="date" className="input" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Forma de recebimento
                <select className="input" value={formaRecebimento} onChange={e => setFormaRecebimento(e.target.value)}>
                  {FORMAS_RECEBIMENTO.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setReceberModal(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={saving} onClick={handleReceber}>
                  {saving ? 'Salvando...' : 'Confirmar Recebimento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Aba: Contas a Pagar ─────────────────────────────────────────────────────
function AbaPagar({ userId, categorias, onReload }: {
  userId: string;
  categorias: CategoriaDespesa[];
  onReload: () => void;
}) {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'' | 'pendente' | 'pago' | 'vencido'>('');
  const [showForm, setShowForm] = useState(false);
  const [pagarModal, setPagarModal] = useState<ContaPagar | null>(null);
  const [dataPagamento, setDataPagamento] = useState(fmtISO(new Date()));
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // form state
  const [fFornecedor, setFFornecedor] = useState('');
  const [fDescricao, setFDescricao] = useState('');
  const [fValor, setFValor] = useState('');
  const [fVencimento, setFVencimento] = useState(fmtISO(new Date()));
  const [fCategoria, setFCategoria] = useState('');
  const [fRecorrencia, setFRecorrencia] = useState<ContaPagarRecorrencia>('unica');
  const [fObs, setFObs] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getContasPagar(userId);
      setContas(data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const filtradas = filtroStatus ? contas.filter(c => c.status === filtroStatus) : contas;

  const resetForm = () => {
    setFFornecedor(''); setFDescricao(''); setFValor('');
    setFVencimento(fmtISO(new Date())); setFCategoria('');
    setFRecorrencia('unica'); setFObs('');
  };

  const handleCreate = async () => {
    if (!fFornecedor.trim() || !fValor || !fVencimento) return;
    setSaving(true);
    try {
      await api.createContaPagar(userId, {
        fornecedor:     fFornecedor,
        descricao:      fDescricao || undefined,
        valor:          parseFloat(fValor.replace(',', '.')),
        dataVencimento: fVencimento,
        categoriaId:    fCategoria || null,
        recorrencia:    fRecorrencia,
        observacoes:    fObs || undefined,
      });
      resetForm();
      setShowForm(false);
      await load();
      onReload();
    } finally {
      setSaving(false);
    }
  };

  const handlePagar = async () => {
    if (!pagarModal) return;
    setSaving(true);
    try {
      let comprovanteUrl: string | undefined;
      if (comprovante) {
        comprovanteUrl = await api.uploadComprovante(userId, pagarModal.id, comprovante);
      }
      await api.pagarConta(userId, pagarModal.id, dataPagamento, comprovanteUrl);
      setPagarModal(null);
      setComprovante(null);
      await load();
      onReload();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta conta a pagar?')) return;
    await api.deleteContaPagar(userId, id);
    await load();
    onReload();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['', 'pendente', 'vencido', 'pago'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: '1px solid var(--color-border)',
                fontSize: 12, cursor: 'pointer',
                background: filtroStatus === s ? 'var(--color-primary)' : 'var(--color-card)',
                color: filtroStatus === s ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {s === '' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowForm(true)}>
          <Plus size={14} /> Nova Conta
        </button>
      </div>

      {/* Formulário de nova conta */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Nova Conta a Pagar</span>
            <button className="btn-icon" onClick={() => { setShowForm(false); resetForm(); }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Fornecedor *
              <input className="input" value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} placeholder="Ex: Locatário, Salário..." />
            </label>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Descrição
              <input className="input" value={fDescricao} onChange={e => setFDescricao(e.target.value)} placeholder="Detalhe opcional" />
            </label>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Valor (R$) *
              <input className="input" type="number" step="0.01" min="0.01" value={fValor} onChange={e => setFValor(e.target.value)} placeholder="0,00" />
            </label>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Vencimento *
              <input className="input" type="date" value={fVencimento} onChange={e => setFVencimento(e.target.value)} />
            </label>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Categoria
              <select className="input" value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Recorrência
              <select className="input" value={fRecorrencia} onChange={e => setFRecorrencia(e.target.value as ContaPagarRecorrencia)}>
                {Object.entries(RECORRENCIA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1/-1' }}>
              Observações
              <input className="input" value={fObs} onChange={e => setFObs(e.target.value)} placeholder="Opcional" />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</button>
            <button className="btn btn-primary" disabled={saving || !fFornecedor || !fValor || !fVencimento} onClick={handleCreate}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Carregando...</p>
      ) : filtradas.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Nenhuma conta a pagar.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtradas.map(c => (
            <div key={c.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {c.categoriaCor && (
                <div style={{ width: 4, height: 40, borderRadius: 4, background: c.categoriaCor, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.fornecedor}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {c.descricao && `${c.descricao} · `}
                  {c.categoriaNome ?? 'Sem categoria'} · {RECORRENCIA_LABELS[c.recorrencia]}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 100 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtBRL(c.valor)}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Venc. {fmtDate(c.dataVencimento)}</div>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                background: STATUS_COLORS[c.status] + '22',
                color: STATUS_COLORS[c.status],
              }}>
                {STATUS_LABELS[c.status]}
              </span>
              {c.comprovanteUrl && (
                <a href={c.comprovanteUrl} target="_blank" rel="noreferrer" title="Ver comprovante" style={{ color: 'var(--color-primary)' }}>
                  <FileText size={16} />
                </a>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                {c.status !== 'pago' && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => { setPagarModal(c); setDataPagamento(fmtISO(new Date())); setComprovante(null); }}
                  >
                    <Check size={13} /> Pagar
                  </button>
                )}
                {c.status === 'pendente' && (
                  <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => handleDelete(c.id)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {c.status === 'pago' && c.dataPagamento && (
                <span style={{ fontSize: 11, color: '#10b981' }}>Pago em {fmtDate(c.dataPagamento)}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: registrar pagamento */}
      {pagarModal && (
        <div className="modal-overlay" onClick={() => setPagarModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>Registrar Pagamento</h3>
              <button className="btn-icon" onClick={() => setPagarModal(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{pagarModal.fornecedor}</div>
                {pagarModal.descricao && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{pagarModal.descricao}</div>}
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmtBRL(pagarModal.valor)}</div>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Data do pagamento
                <input type="date" className="input" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                Comprovante (opcional)
                <input
                  ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                  onChange={e => setComprovante(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button" className="btn btn-outline" style={{ fontSize: 12, justifyContent: 'center' }}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={13} /> {comprovante ? comprovante.name : 'Anexar comprovante'}
                </button>
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setPagarModal(null); setComprovante(null); }}>Cancelar</button>
                <button className="btn btn-primary" disabled={saving} onClick={handlePagar}>
                  {saving ? 'Salvando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Aba: Fluxo de Caixa ────────────────────────────────────────────────────
function AbaFluxo({ userId }: { userId: string }) {
  const [horizonte, setHorizonte] = useState<HorizonteDias>(30);
  const [itens, setItens] = useState<FluxoCaixaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getFluxoCaixa(userId, horizonte)
      .then(setItens)
      .finally(() => setLoading(false));
  }, [userId, horizonte]);

  const maxAbsoluto = itens.reduce((m, i) => Math.max(m, Math.abs(i.saldoAcumulado), i.entradasPrevistas, i.saidasPrevistas), 1);
  const saldoFinal = itens.length > 0 ? itens[itens.length - 1].saldoAcumulado : 0;
  const totalEntradas = itens.reduce((s, i) => s + i.entradasPrevistas, 0);
  const totalSaidas   = itens.reduce((s, i) => s + i.saidasPrevistas, 0);

  // Agrupa por semana para exibição compacta
  const semanas: { label: string; entradas: number; saidas: number; saldo: number }[] = [];
  for (let i = 0; i < itens.length; i += 7) {
    const slice = itens.slice(i, i + 7);
    const inicio = new Date(slice[0].data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const fim    = new Date(slice[slice.length - 1].data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    semanas.push({
      label:   `${inicio} – ${fim}`,
      entradas: slice.reduce((s, d) => s + d.entradasPrevistas, 0),
      saidas:   slice.reduce((s, d) => s + d.saidasPrevistas, 0),
      saldo:    slice[slice.length - 1].saldoAcumulado,
    });
  }

  return (
    <div>
      {/* Seletor de horizonte */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([30, 60, 90] as HorizonteDias[]).map(h => (
          <button
            key={h}
            onClick={() => setHorizonte(h)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid var(--color-border)',
              fontSize: 13, cursor: 'pointer',
              background: horizonte === h ? 'var(--color-primary)' : 'var(--color-card)',
              color: horizonte === h ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {h} dias
          </button>
        ))}
      </div>

      {/* Cards de totais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Entradas previstas', value: fmtBRL(totalEntradas), color: '#10b981' },
          { label: 'Saídas previstas',   value: fmtBRL(totalSaidas),   color: '#ef4444' },
          { label: `Saldo ao fim de ${horizonte} dias`, value: fmtBRL(saldoFinal),
            color: saldoFinal >= 0 ? '#10b981' : '#ef4444' },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {saldoFinal < 0 && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10,
          padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <AlertTriangle size={18} color="#991b1b" />
          <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 500 }}>
            Atenção: o saldo projetado fica negativo neste período. Revise suas despesas ou busque antecipar recebimentos.
          </span>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Carregando projeção...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {semanas.map((s, idx) => {
            const pctEntradas = maxAbsoluto > 0 ? (s.entradas / maxAbsoluto) * 100 : 0;
            const pctSaidas   = maxAbsoluto > 0 ? (s.saidas   / maxAbsoluto) * 100 : 0;
            return (
              <div key={idx} className="card" style={{ padding: '12px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: s.saldo >= 0 ? '#10b981' : '#ef4444' }}>
                    Saldo acum.: {fmtBRL(s.saldo)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ width: 70, color: '#10b981', fontWeight: 500 }}>Entradas</span>
                    <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${pctEntradas}%`, background: '#10b981', height: 8, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ width: 80, textAlign: 'right', color: '#10b981' }}>{fmtBRL(s.entradas)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ width: 70, color: '#ef4444', fontWeight: 500 }}>Saídas</span>
                    <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${pctSaidas}%`, background: '#ef4444', height: 8, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ width: 80, textAlign: 'right', color: '#ef4444' }}>{fmtBRL(s.saidas)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Aba: Categorias ─────────────────────────────────────────────────────────
function AbaCategorias({ userId, categorias, onReload }: {
  userId: string;
  categorias: CategoriaDespesa[];
  onReload: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      await api.createCategoriaDespesa(userId, nome, cor);
      setNome(''); setCor('#6366f1'); setShowForm(false);
      onReload();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    await api.deleteCategoriaDespesa(userId, id);
    onReload();
  };

  const CORES_SUGERIDAS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {categorias.length} categoria(s) configurada(s)
        </span>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowForm(true)}>
          <Plus size={14} /> Nova Categoria
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
              Nome da categoria
              <input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Higiene, Equipamentos..." />
            </label>
            <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Cor
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CORES_SUGERIDAS.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setCor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                      outline: cor === c ? '3px solid #000' : 'none', outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !nome.trim()} onClick={handleCreate}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {categorias.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Nenhuma categoria ainda.</p>
        )}
        {categorias.map(c => (
          <div key={c.id} className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.cor, flexShrink: 0 }} />
            <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>{c.nome}</span>
            {c.sistema && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 8 }}>
                Sistema
              </span>
            )}
            {!c.sistema && (
              <button className="btn-icon" style={{ color: '#ef4444' }} onClick={() => handleDelete(c.id)}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export const ContasFinanceiras: React.FC<ContasFinanceirasProps> = ({ userId }) => {
  const [subTab, setSubTab] = useState<SubTab>('receber');
  const [categorias, setCategorias] = useState<CategoriaDespesa[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);

  const loadCategorias = useCallback(async () => {
    try { setCategorias(await api.getCategoriasDespesa(userId)); } catch { /* silent */ }
  }, [userId]);

  const loadResumo = useCallback(async () => {
    try { setResumo(await api.getResumoFinanceiro(userId)); } catch { /* silent */ }
  }, [userId]);

  useEffect(() => {
    loadCategorias();
    loadResumo();
  }, [loadCategorias, loadResumo]);

  const handleReload = () => {
    loadResumo();
  };

  return (
    <div>
      <ResumoCards resumo={resumo} />
      <AlertaVencimento resumo={resumo} />
      <SubTabBar active={subTab} onChange={setSubTab} />

      {subTab === 'receber' && <AbaReceber userId={userId} onReload={handleReload} />}
      {subTab === 'pagar'   && <AbaPagar userId={userId} categorias={categorias} onReload={handleReload} />}
      {subTab === 'fluxo'   && <AbaFluxo userId={userId} />}
      {subTab === 'categorias' && (
        <AbaCategorias userId={userId} categorias={categorias} onReload={() => { loadCategorias(); handleReload(); }} />
      )}
    </div>
  );
};
