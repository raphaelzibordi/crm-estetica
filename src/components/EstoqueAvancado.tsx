import React, { useState, useEffect, useCallback } from 'react';
import type { ItemEstoque, EstoqueVinculo, EstoqueMovimento } from '../types';
import {
  Package, Plus, Edit2, Trash2, X, Check, AlertTriangle,
  ArrowUp, ArrowDown, RefreshCw,
  Link, History, BarChart3, FileDown,
} from 'lucide-react';
import { api } from '../lib/api';

interface Props {
  userId: string;
  onDataChange?: (items: ItemEstoque[]) => void;
}

type InnerTab = 'produtos' | 'vinculos' | 'historico' | 'relatorio';

const UNIDADES = ['un', 'ml', 'g', 'cx', 'fr', 'amp', 'kg', 'L'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');

function statusBadge(s: string) {
  const ok = s === 'normal';
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
      background: ok ? '#dcfce7' : '#fef2f2',
      color: ok ? '#15803d' : '#dc2626',
    }}>{ok ? 'Normal' : 'Crítico'}</span>
  );
}

function tipoBadge(tipo: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    entrada:    { bg: '#dcfce7', color: '#15803d', label: 'Entrada' },
    saida:      { bg: '#fef2f2', color: '#dc2626', label: 'Saída' },
    ajuste:     { bg: '#eff6ff', color: '#1d4ed8', label: 'Ajuste' },
    devolucao:  { bg: '#f0fdf4', color: '#166534', label: 'Devolução' },
    vencimento: { bg: '#fffbeb', color: '#b45309', label: 'Vencimento' },
  };
  const m = map[tipo] ?? { bg: '#f3f4f6', color: '#6b7280', label: tipo };
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

export const EstoqueAvancado: React.FC<Props> = ({ userId, onDataChange }) => {
  const [tab, setTab] = useState<InnerTab>('produtos');

  // ── Data ──
  const [produtos, setProdutos] = useState<ItemEstoque[]>([]);
  const [vinculos, setVinculos] = useState<EstoqueVinculo[]>([]);
  const [historico, setHistorico] = useState<EstoqueMovimento[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Produto form ──
  const [showProdModal, setShowProdModal] = useState(false);
  const [editProdId, setEditProdId] = useState<string | null>(null);
  const [fProduto, setFProduto] = useState('');
  const [fQtd, setFQtd] = useState('');
  const [fQtdMin, setFQtdMin] = useState('5');
  const [fUnidade, setFUnidade] = useState('un');
  const [fCusto, setFCusto] = useState('0');
  const [fFornecedor, setFFornecedor] = useState('');
  const [fValidade, setFValidade] = useState('');
  const [fObs, setFObs] = useState('');

  // ── Entrada modal ──
  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [entradaProdId, setEntradaProdId] = useState('');
  const [entradaQtd, setEntradaQtd] = useState('');
  const [entradaCusto, setEntradaCusto] = useState('0');
  const [entradaFornecedor, setEntradaFornecedor] = useState('');

  // ── Ajuste modal ──
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [ajusteProdId, setAjusteProdId] = useState('');
  const [ajusteTipo, setAjusteTipo] = useState<'ajuste' | 'devolucao' | 'vencimento'>('ajuste');
  const [ajusteQtd, setAjusteQtd] = useState('');
  const [ajusteJust, setAjusteJust] = useState('');

  // ── Vínculo form ──
  const [showVinculoModal, setShowVinculoModal] = useState(false);
  const [vProdId, setVProdId] = useState('');
  const [vProc, setVProc] = useState('');
  const [vQtd, setVQtd] = useState('');

  // ── Historico filter ──
  const [histProdFilter, setHistProdFilter] = useState('');


  const loadProdutos = useCallback(async () => {
    try {
      const data = await api.getEstoque(userId);
      setProdutos(data);
      onDataChange?.(data);
    } catch (e) { console.error(e); }
  }, [userId, onDataChange]);

  const loadVinculos = useCallback(async () => {
    try { setVinculos(await api.getEstoqueVinculos(userId)); } catch (e) { console.error(e); }
  }, [userId]);

  const loadHistorico = useCallback(async () => {
    try { setHistorico(await api.getEstoqueMovimentos(userId, undefined, 200)); } catch (e) { console.error(e); }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProdutos(), loadVinculos(), loadHistorico()]).finally(() => setLoading(false));
  }, [loadProdutos, loadVinculos, loadHistorico]);

  // ── Derived — declarados antes dos effects que os consomem ──
  const criticos = produtos.filter(p => p.status === 'critico');
  const vencendoBreve = produtos.filter(p => {
    if (!p.validade) return false;
    const dias = Math.ceil((new Date(p.validade).getTime() - Date.now()) / 86400000);
    return dias >= 0 && dias <= 30;
  });


  // ── Produto CRUD ──
  const openProdModal = (item?: ItemEstoque) => {
    if (item) {
      setEditProdId(item.id);
      setFProduto(item.produto);
      setFQtd(fmtNum(item.quantidade));
      setFQtdMin(fmtNum(item.quantidadeMinima));
      setFUnidade(item.unidade);
      setFCusto(String(item.custoUnitario ?? 0));
      setFFornecedor(item.fornecedor ?? '');
      setFValidade(item.validade ?? '');
      setFObs(item.observacoes ?? '');
    } else {
      setEditProdId(null);
      setFProduto(''); setFQtd('0'); setFQtdMin('5'); setFUnidade('un');
      setFCusto('0'); setFFornecedor(''); setFValidade(''); setFObs('');
    }
    setShowProdModal(true);
  };

  const handleSaveProd = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(fQtd) || 0;
    const min = parseFloat(fQtdMin) || 0;
    const status: 'normal' | 'critico' = qty <= min ? 'critico' : 'normal';
    try {
      if (editProdId) {
        await api.updateEstoque(editProdId, qty, status, undefined, userId, {
          custoUnitario: parseFloat(fCusto) || 0,
          fornecedor: fFornecedor,
          validade: fValidade || null,
          observacoes: fObs,
          produto: fProduto,
          quantidadeMinima: min,
          unidade: fUnidade,
        });
      } else {
        await api.createItemEstoque({
          produto: fProduto, quantidade: qty, quantidadeMinima: min,
          unidade: fUnidade, status,
          ultimaReposicao: new Date().toISOString().split('T')[0],
          custoUnitario: parseFloat(fCusto) || 0,
          custoMedio: parseFloat(fCusto) || 0,
          fornecedor: fFornecedor,
          validade: fValidade || null,
          observacoes: fObs,
        }, userId);
      }
      await loadProdutos();
      setShowProdModal(false);
    } catch (err) { console.error(err); alert('Erro ao salvar insumo.'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remover este insumo?')) return;
    try { await api.deleteItemEstoque(id, userId); await loadProdutos(); } catch { alert('Erro ao remover.'); }
  };

  // ── Entrada ──
  const openEntrada = (prodId: string) => {
    const prod = produtos.find(p => p.id === prodId);
    setEntradaProdId(prodId);
    setEntradaQtd('');
    setEntradaCusto(String(prod?.custoUnitario ?? 0));
    setEntradaFornecedor(prod?.fornecedor ?? '');
    setShowEntradaModal(true);
  };

  const handleSaveEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(entradaQtd);
    if (!qty || qty <= 0) { alert('Quantidade inválida.'); return; }
    try {
      await api.registrarEntradaEstoque(
        entradaProdId,
        { quantidade: qty, custoUnitario: parseFloat(entradaCusto) || 0, fornecedor: entradaFornecedor, criadoPor: '' },
        userId,
      );
      await Promise.all([loadProdutos(), loadHistorico()]);
      setShowEntradaModal(false);
    } catch (err) { console.error(err); alert('Erro ao registrar entrada.'); }
  };

  // ── Ajuste ──
  const openAjuste = (prodId: string) => {
    setAjusteProdId(prodId);
    setAjusteTipo('ajuste');
    setAjusteQtd('');
    setAjusteJust('');
    setShowAjusteModal(true);
  };

  const handleSaveAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(ajusteQtd);
    if (!qty || qty <= 0) { alert('Quantidade inválida.'); return; }
    try {
      await api.registrarAjusteEstoque(
        ajusteProdId,
        { quantidade: -qty, tipo: ajusteTipo, justificativa: ajusteJust, criadoPor: '' },
        userId,
      );
      await Promise.all([loadProdutos(), loadHistorico()]);
      setShowAjusteModal(false);
    } catch (err) { console.error(err); alert('Erro ao registrar ajuste.'); }
  };

  // ── Vínculo ──
  const handleSaveVinculo = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(vQtd);
    if (!qty || qty <= 0 || !vProdId || !vProc.trim()) { alert('Preencha todos os campos.'); return; }
    try {
      await api.upsertEstoqueVinculo({ produtoId: vProdId, procedimentoNome: vProc.trim(), quantidade: qty }, userId);
      await loadVinculos();
      setVProdId(''); setVProc(''); setVQtd('');
      setShowVinculoModal(false);
    } catch (err) { console.error(err); alert('Erro ao salvar vínculo.'); }
  };

  const handleDeleteVinculo = async (id: string) => {
    if (!window.confirm('Remover este vínculo?')) return;
    try { await api.deleteEstoqueVinculo(id, userId); await loadVinculos(); } catch { alert('Erro ao remover.'); }
  };

  const histFiltrado = histProdFilter
    ? historico.filter(h => h.produtoId === histProdFilter)
    : historico;

  const innerTabStyle = (t: InnerTab): React.CSSProperties => ({
    padding: '8px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
    borderRadius: '6px', transition: 'all 0.15s',
    background: tab === t ? 'var(--color-primary)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--color-text-muted)',
  });

  const exportCSV = () => {
    const rows = [
      ['Produto', 'Qtd', 'Unidade', 'Qtd Mín', 'Status', 'Custo Médio', 'Fornecedor', 'Validade'],
      ...produtos.map(p => [
        p.produto, fmtNum(p.quantidade), p.unidade, fmtNum(p.quantidadeMinima),
        p.status, String(p.custoMedio ?? 0), p.fornecedor ?? '', p.validade ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'estoque.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <RefreshCw size={24} style={{ marginBottom: '8px', opacity: 0.4 }} />
        <p>Carregando estoque…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header + inner tabs */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Gestão de Estoque</h3>
            {criticos.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={11} />{criticos.length} crítico(s)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button style={innerTabStyle('produtos')} onClick={() => setTab('produtos')}><Package size={12} style={{ marginRight: '4px', display: 'inline' }} />Produtos</button>
            <button style={innerTabStyle('vinculos')} onClick={() => setTab('vinculos')}><Link size={12} style={{ marginRight: '4px', display: 'inline' }} />Vínculos</button>
            <button style={innerTabStyle('historico')} onClick={() => setTab('historico')}><History size={12} style={{ marginRight: '4px', display: 'inline' }} />Histórico</button>
            <button style={innerTabStyle('relatorio')} onClick={() => setTab('relatorio')}><BarChart3 size={12} style={{ marginRight: '4px', display: 'inline' }} />Relatório</button>
          </div>
        </div>
      </div>

      {/* ── US-045: Banner de alerta de estoque mínimo ─────────── */}
      {!loading && (criticos.length > 0 || vencendoBreve.length > 0) && (
        <div className="card" style={{ padding: '16px 24px', borderLeft: '4px solid #dc2626', background: '#fff9f9' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#dc2626', marginBottom: '8px' }}>
                {criticos.length > 0 && vencendoBreve.length > 0
                  ? `${criticos.length} insumo(s) crítico(s) e ${vencendoBreve.length} com validade próxima`
                  : criticos.length > 0
                    ? `${criticos.length} insumo(s) abaixo do estoque mínimo`
                    : `${vencendoBreve.length} insumo(s) com validade nos próximos 30 dias`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {criticos.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', flexWrap: 'wrap', gap: '6px' }}>
                    <span>
                      <strong>{p.produto}</strong>
                      <span style={{ color: '#dc2626' }}> — {fmtNum(p.quantidade)} {p.unidade} restantes</span>
                      <span style={{ color: '#9ca3af' }}> (mín: {fmtNum(p.quantidadeMinima)})</span>
                    </span>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '11px', padding: '3px 10px' }}
                      onClick={() => { setTab('produtos'); openEntrada(p.id); }}
                    >
                      Repor
                    </button>
                  </div>
                ))}
                {vencendoBreve.map(p => {
                  const dias = Math.ceil((new Date(p.validade!).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={p.id} style={{ fontSize: '13px', color: '#b45309' }}>
                      <strong>{p.produto}</strong>
                      {' — vence em '}
                      <strong>{dias} dia(s)</strong>
                      {' (' + new Date(p.validade! + 'T00:00:00').toLocaleDateString('pt-BR') + ')'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PRODUTOS ───────────────────────────────────────── */}
      {tab === 'produtos' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Insumos cadastrados ({produtos.length})</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }} onClick={exportCSV}>
                <FileDown size={13} />Exportar CSV
              </button>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => openProdModal()}>
                <Plus size={14} />Novo Insumo
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                  {['Insumo', 'Qtd Atual', 'Qtd Mín', 'Un.', 'C. Médio', 'Fornecedor', 'Validade', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', fontWeight: 500, textAlign: h === 'Ações' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {produtos.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    Nenhum insumo. Clique em "Novo Insumo" para começar.
                  </td></tr>
                )}
                {produtos.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{item.produto}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: item.status === 'critico' ? '#dc2626' : 'var(--color-text-main)' }}>
                      {fmtNum(item.quantidade)} {item.unidade}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>{fmtNum(item.quantidadeMinima)}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>{item.unidade}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>{fmtBRL(item.custoMedio ?? 0)}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.fornecedor || '—'}
                    </td>
                    <td style={{ padding: '12px 8px', color: item.validade ? 'var(--color-text-muted)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {item.validade ? new Date(item.validade + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td style={{ padding: '12px 8px' }}>{statusBadge(item.status)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button onClick={() => openEntrada(item.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }} title="Registrar entrada">
                          <ArrowUp size={11} />Entrada
                        </button>
                        <button onClick={() => openAjuste(item.id)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }} title="Ajuste manual">
                          <ArrowDown size={11} />Ajuste
                        </button>
                        <button onClick={() => openProdModal(item)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px' }} title="Editar"><Edit2 size={11} /></button>
                        <button onClick={() => handleDelete(item.id)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#ef4444' }} title="Remover"><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: VÍNCULOS ───────────────────────────────────────── */}
      {tab === 'vinculos' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Vínculos Insumo ↔ Procedimento</h4>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Configure o consumo fracionado de cada insumo por procedimento. A baixa acontece automaticamente no checkout.
              </p>
            </div>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowVinculoModal(true)}>
              <Plus size={14} />Novo Vínculo
            </button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                  {['Insumo', 'Procedimento', 'Qtd consumida', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', fontWeight: 500, textAlign: h === 'Ações' ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vinculos.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    Nenhum vínculo configurado. Clique em "Novo Vínculo" para começar.
                  </td></tr>
                )}
                {vinculos.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{v.produtoNome}</td>
                    <td style={{ padding: '12px 8px' }}>{v.procedimentoNome}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--color-text-muted)' }}>
                      {fmtNum(v.quantidade)} {produtos.find(p => p.id === v.produtoId)?.unidade ?? ''}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button onClick={() => handleDeleteVinculo(v.id)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#ef4444' }}><Trash2 size={11} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: HISTÓRICO ──────────────────────────────────────── */}
      {tab === 'historico' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Histórico de Movimentos ({historico.length})</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ fontSize: '12px', padding: '6px 10px', minWidth: '180px' }}
                value={histProdFilter}
                onChange={e => setHistProdFilter(e.target.value)}
              >
                <option value="">Todos os insumos</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.produto}</option>)}
              </select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                  {['Data', 'Insumo', 'Tipo', 'Qtd', 'Custo Unit.', 'Referência', 'Profissional', 'Justificativa'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {histFiltrado.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    Nenhum movimento registrado.
                  </td></tr>
                )}
                {histFiltrado.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                      {new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{m.produtoNome}</td>
                    <td style={{ padding: '10px 8px' }}>{tipoBadge(m.tipo)}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: m.quantidade > 0 ? '#15803d' : '#dc2626' }}>
                      {m.quantidade > 0 ? '+' : ''}{fmtNum(m.quantidade)}
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--color-text-muted)' }}>{fmtBRL(m.custoUnitario)}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--color-text-muted)' }}>{m.referencia || '—'}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--color-text-muted)' }}>{m.profissional || '—'}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--color-text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.justificativa || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: RELATÓRIO ──────────────────────────────────────── */}
      {tab === 'relatorio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Total de Insumos</div>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{produtos.length}</div>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: `4px solid ${criticos.length > 0 ? '#dc2626' : '#22c55e'}` }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Itens Críticos</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: criticos.length > 0 ? '#dc2626' : '#22c55e' }}>{criticos.length}</div>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: `4px solid ${vencendoBreve.length > 0 ? '#f59e0b' : '#22c55e'}` }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Vencendo em 30d</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: vencendoBreve.length > 0 ? '#f59e0b' : '#22c55e' }}>{vencendoBreve.length}</div>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Vínculos Ativos</div>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{vinculos.filter(v => v.ativo).length}</div>
            </div>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #0ea5e9' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Valor Estoque (CMP)</div>
              <div style={{ fontSize: '22px', fontWeight: 700 }}>
                {fmtBRL(produtos.reduce((s, p) => s + (p.custoMedio ?? 0) * p.quantidade, 0))}
              </div>
            </div>
          </div>

          {/* Críticos */}
          {criticos.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} style={{ color: '#dc2626' }} />Insumos em Estado Crítico
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {criticos.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.produto}</div>
                      <div style={{ fontSize: '11px', color: '#dc2626' }}>{fmtNum(p.quantidade)} {p.unidade} — mín: {fmtNum(p.quantidadeMinima)}</div>
                    </div>
                    <button className="btn btn-primary" style={{ fontSize: '11px', padding: '4px 12px' }} onClick={() => openEntrada(p.id)}>Repor</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vencimento */}
          {vencendoBreve.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} style={{ color: '#f59e0b' }} />Vencendo nos Próximos 30 Dias
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {vencendoBreve.map(p => {
                  const dias = Math.ceil((new Date(p.validade!).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.produto}</div>
                        <div style={{ fontSize: '11px', color: '#b45309' }}>Vence em {dias} dia(s) — {new Date(p.validade! + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: '#fde68a', color: '#b45309' }}>{dias}d</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Consumo recente */}
          <div className="card" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>Últimas Saídas (checkout automático)</h4>
            {historico.filter(h => h.tipo === 'saida').length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>Nenhuma saída registrada ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {historico.filter(h => h.tipo === 'saida').slice(0, 10).map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{m.produtoNome}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>{m.referencia || 'Saída manual'}</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>{fmtNum(m.quantidade)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: PRODUTO ──────────────────────────────────────── */}
      {showProdModal && (
        <div className="modal-overlay" onClick={() => setShowProdModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: '520px', width: '92%', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>{editProdId ? 'Editar Insumo' : 'Novo Insumo'}</h3>
              <button onClick={() => setShowProdModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveProd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Nome do Insumo *</label>
                <input className="form-input" value={fProduto} onChange={e => setFProduto(e.target.value)} placeholder="Ex: Toxina Botulínica 50U" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Qtd Atual</label>
                  <input className="form-input" type="number" step="0.001" min="0" value={fQtd} onChange={e => setFQtd(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Qtd Mínima</label>
                  <input className="form-input" type="number" step="0.001" min="0" value={fQtdMin} onChange={e => setFQtdMin(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unidade</label>
                  <select className="form-select" value={fUnidade} onChange={e => setFUnidade(e.target.value)}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Custo Unitário (R$)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={fCusto} onChange={e => setFCusto(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Validade</label>
                  <input className="form-input" type="date" value={fValidade} onChange={e => setFValidade(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Fornecedor</label>
                <input className="form-input" value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
              </div>
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea className="form-input" rows={2} value={fObs} onChange={e => setFObs(e.target.value)} placeholder="Notas internas…" style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowProdModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} />Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ENTRADA ──────────────────────────────────────── */}
      {showEntradaModal && (
        <div className="modal-overlay" onClick={() => setShowEntradaModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: '400px', width: '92%', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Registrar Entrada</h3>
              <button onClick={() => setShowEntradaModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              {produtos.find(p => p.id === entradaProdId)?.produto}
            </p>
            <form onSubmit={handleSaveEntrada} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Quantidade recebida *</label>
                <input className="form-input" type="number" step="0.001" min="0.001" value={entradaQtd} onChange={e => setEntradaQtd(e.target.value)} placeholder="Ex: 5.5" required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Custo unitário (R$)</label>
                <input className="form-input" type="number" step="0.01" min="0" value={entradaCusto} onChange={e => setEntradaCusto(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fornecedor</label>
                <input className="form-input" value={entradaFornecedor} onChange={e => setEntradaFornecedor(e.target.value)} placeholder="Fornecedor desta nota" />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowEntradaModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ArrowUp size={14} />Confirmar Entrada</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: AJUSTE ───────────────────────────────────────── */}
      {showAjusteModal && (
        <div className="modal-overlay" onClick={() => setShowAjusteModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: '400px', width: '92%', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Ajuste Manual</h3>
              <button onClick={() => setShowAjusteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              {produtos.find(p => p.id === ajusteProdId)?.produto}
            </p>
            <form onSubmit={handleSaveAjuste} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Tipo de movimentação</label>
                <select className="form-select" value={ajusteTipo} onChange={e => setAjusteTipo(e.target.value as typeof ajusteTipo)}>
                  <option value="ajuste">Ajuste de inventário</option>
                  <option value="devolucao">Devolução ao fornecedor</option>
                  <option value="vencimento">Descarte por vencimento</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantidade a baixar *</label>
                <input className="form-input" type="number" step="0.001" min="0.001" value={ajusteQtd} onChange={e => setAjusteQtd(e.target.value)} placeholder="Ex: 2" required />
              </div>
              <div className="form-group">
                <label className="form-label">Justificativa</label>
                <textarea className="form-input" rows={2} value={ajusteJust} onChange={e => setAjusteJust(e.target.value)} placeholder="Motivo do ajuste…" style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowAjusteModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ArrowDown size={14} />Confirmar Ajuste</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VÍNCULO ──────────────────────────────────────── */}
      {showVinculoModal && (
        <div className="modal-overlay" onClick={() => setShowVinculoModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: '440px', width: '92%', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Novo Vínculo</h3>
              <button onClick={() => setShowVinculoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveVinculo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Insumo *</label>
                <select className="form-select" value={vProdId} onChange={e => setVProdId(e.target.value)} required>
                  <option value="">Selecione…</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.produto}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Procedimento *</label>
                <input className="form-input" value={vProc} onChange={e => setVProc(e.target.value)} placeholder="Ex: Toxina Botulínica 50U" required />
              </div>
              <div className="form-group">
                <label className="form-label">Quantidade consumida por sessão *</label>
                <input className="form-input" type="number" step="0.001" min="0.001" value={vQtd} onChange={e => setVQtd(e.target.value)} placeholder="Ex: 0.5" required />
                {vProdId && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Unidade: {produtos.find(p => p.id === vProdId)?.unidade}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowVinculoModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} />Salvar Vínculo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoqueAvancado;
