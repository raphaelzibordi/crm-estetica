import React, { useState, useEffect } from 'react';
import type { FechamentoFinanceiro, ItemEstoque, Procedimento } from '../types';
import {
  TrendingUp, AlertTriangle, DollarSign, Wallet, LayoutDashboard,
  FileSpreadsheet, Plus, Edit2, Trash2, X, Check, Package, Stethoscope
} from 'lucide-react';
import { api } from '../lib/api';

interface GestaoProps { userId: string; }

const EMPTY_FECHAMENTO: FechamentoFinanceiro = { faturamentoTotal: 0, comissoesPagas: 0, formasPagamento: [] };

type ActiveTab = 'dashboard' | 'financeiro' | 'estoque' | 'procedimentos';



export const Gestao: React.FC<GestaoProps> = ({ userId }) => {
  const [tab, setTab] = useState<ActiveTab>('dashboard');
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [financeiro, setFinanceiro] = useState<FechamentoFinanceiro>(EMPTY_FECHAMENTO);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [loadingProcs, setLoadingProcs] = useState(true);

  // ── Estoque form state ──
  const [showEstoqueModal, setShowEstoqueModal] = useState(false);
  const [editingEstoqueId, setEditingEstoqueId] = useState<string | null>(null);
  const [eProduto, setEProduto] = useState('');
  const [eQtd, setEQtd] = useState('');
  const [eQtdMin, setEQtdMin] = useState('');
  const [eUnidade, setEUnidade] = useState('un');

  // ── Procedimento form state ──
  const [showProcModal, setShowProcModal] = useState(false);
  const [editingProcId, setEditingProcId] = useState<string | null>(null);
  const [pNome, setPNome] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPreco, setPPreco] = useState('');
  const [pDuracao, setPDuracao] = useState('60');

  useEffect(() => { loadEstoque(); loadFinanceiro(); loadProcedimentos(); }, [userId]);

  const loadEstoque = async () => {
    try { setEstoque(await api.getEstoque(userId)); } catch (e) { console.error(e); }
  };
  const loadFinanceiro = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      setFinanceiro(await api.getFechamentoFinanceiro(userId, hoje));
    } catch { setFinanceiro(EMPTY_FECHAMENTO); }
  };

  const loadProcedimentos = async () => {
    try {
      setLoadingProcs(true);
      setProcedimentos(await api.getProcedimentos(userId));
    } catch (e) { console.error('Erro ao carregar procedimentos', e); }
    finally { setLoadingProcs(false); }
  };

  // ─── ESTOQUE HANDLERS ────────────────────────────────────────────────────
  const openEstoqueModal = (item?: ItemEstoque) => {
    if (item) {
      setEditingEstoqueId(item.id);
      setEProduto(item.produto); setEQtd(String(item.quantidade));
      setEQtdMin(String(item.quantidadeMinima)); setEUnidade(item.unidade);
    } else {
      setEditingEstoqueId(null);
      setEProduto(''); setEQtd(''); setEQtdMin('5'); setEUnidade('un');
    }
    setShowEstoqueModal(true);
  };

  const handleSaveEstoque = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(eQtd, 10) || 0;
    const min = parseInt(eQtdMin, 10) || 0;
    const status: 'normal' | 'critico' = qty <= min ? 'critico' : 'normal';
    try {
      if (editingEstoqueId) {
        await api.updateEstoque(editingEstoqueId, qty, status, new Date().toISOString().split('T')[0], userId);
        setEstoque(prev => prev.map(i => i.id === editingEstoqueId
          ? { ...i, produto: eProduto, quantidade: qty, quantidadeMinima: min, unidade: eUnidade, status }
          : i));
      } else {
        const created = await api.createItemEstoque({
          produto: eProduto, quantidade: qty, quantidadeMinima: min,
          unidade: eUnidade, status, ultimaReposicao: new Date().toISOString().split('T')[0],
        }, userId);
        setEstoque(prev => [...prev, created]);
      }
    } catch (err) { console.error(err); alert('Erro ao salvar insumo.'); await loadEstoque(); }
    setShowEstoqueModal(false);
  };

  const handleDeleteEstoque = async (id: string) => {
    if (!window.confirm('Remover este insumo do estoque?')) return;
    setEstoque(prev => prev.filter(i => i.id !== id));
    try { await api.deleteItemEstoque(id, userId); } catch { await loadEstoque(); }
  };

  const handleAdjustQty = async (id: string, delta: number) => {
    const item = estoque.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.quantidade + delta);
    const status: 'normal' | 'critico' = newQty <= item.quantidadeMinima ? 'critico' : 'normal';
    setEstoque(prev => prev.map(i => i.id === id ? { ...i, quantidade: newQty, status } : i));
    try {
      await api.updateEstoque(id, newQty, status, delta > 0 ? new Date().toISOString().split('T')[0] : undefined, userId);
    } catch { await loadEstoque(); }
  };

  // ─── PROCEDIMENTO HANDLERS ───────────────────────────────────────────────
  const openProcModal = (p?: Procedimento) => {
    if (p) {
      setEditingProcId(p.id); setPNome(p.nome); setPDesc((p as any).descricao || '');
      setPPreco(String(p.preco)); setPDuracao(String(p.duracaoMinutos));
    } else {
      setEditingProcId(null); setPNome(''); setPDesc(''); setPPreco(''); setPDuracao('60');
    }
    setShowProcModal(true);
  };

  const handleSaveProc = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: pNome,
      descricao: pDesc,
      preco: parseFloat(pPreco) || 0,
      duracaoMinutos: parseInt(pDuracao, 10) || 60,
      validadeDias: 90,
      salaRequerida: 'Cabine 01',
      profissionalResponsavel: '',
    };
    try {
      if (editingProcId) {
        const updated = await api.updateProcedimento(editingProcId, payload, userId);
        setProcedimentos(prev => prev.map(p => p.id === editingProcId ? { ...updated, descricao: pDesc } as any : p));
      } else {
        const created = await api.createProcedimento(payload, userId);
        setProcedimentos(prev => [...prev, { ...created, descricao: pDesc } as any]);
      }
    } catch (err) { console.error(err); alert('Erro ao salvar procedimento.'); }
    setShowProcModal(false);
  };

  const handleDeleteProc = async (id: string) => {
    if (!window.confirm('Excluir este procedimento?')) return;
    setProcedimentos(prev => prev.filter(p => p.id !== id));
    try { await api.deleteProcedimento(id, userId); } catch { await loadProcedimentos(); }
  };

  const faturamentoLiquido = financeiro.faturamentoTotal - financeiro.comissoesPagas;
  const criticos = estoque.filter(i => i.status === 'critico').length;

  const tabStyle = (t: ActiveTab): React.CSSProperties => ({
    padding: '10px 20px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
    borderRadius: '8px', transition: 'all 0.2s',
    background: tab === t ? 'var(--color-primary)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--color-text-muted)',
  });

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>Gestão & Back-Office</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Financeiro, estoque e catálogo de procedimentos da clínica.</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: '#f8f8f6', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '4px' }}>
          <button style={tabStyle('dashboard')} onClick={() => setTab('dashboard')}>
            <LayoutDashboard size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Dashboard
          </button>
          <button style={tabStyle('financeiro')} onClick={() => setTab('financeiro')}>
            <DollarSign size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Financeiro
          </button>
          <button style={tabStyle('estoque')} onClick={() => setTab('estoque')}>
            <Package size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Estoque
            {criticos > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>{criticos}</span>}
          </button>
          <button style={tabStyle('procedimentos')} onClick={() => setTab('procedimentos')}>
            <Stethoscope size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Procedimentos
          </button>
        </div>
      </div>

      {/* ── TAB: DASHBOARD ──────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <>
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
            <div className="card" style={{ padding: '22px', borderLeft: '4px solid var(--color-success)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Faturamento Hoje</span><DollarSign size={14} style={{ color: 'var(--color-success)' }} />
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                {financeiro.faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '4px' }}>Atendimentos finalizados</div>
            </div>

            <div className="card" style={{ padding: '22px', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Márgem Líquida</span><Wallet size={14} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-primary)' }}>
                {(financeiro.faturamentoTotal - financeiro.comissoesPagas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px' }}>Após comissões (70%)</div>
            </div>

            <div className="card" style={{ padding: '22px', borderLeft: criticos > 0 ? '4px solid #ef4444' : '4px solid #6b9e78' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Estoque</span>
                {criticos > 0 ? <AlertTriangle size={14} style={{ color: '#ef4444' }} /> : <Package size={14} style={{ color: '#6b9e78' }} />}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: criticos > 0 ? '#ef4444' : 'var(--color-text-main)' }}>
                {criticos > 0 ? criticos : estoque.length}
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: criticos > 0 ? '#ef4444' : 'var(--color-text-muted)' }}>
                {criticos > 0 ? `${criticos} iten(s) crítico(s)` : `${estoque.length} insumos cadastrados`}
              </div>
            </div>

            <div className="card" style={{ padding: '22px', borderLeft: '4px solid #8b7fc7' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Procedimentos</span><Stethoscope size={14} style={{ color: '#8b7fc7' }} />
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-main)' }}>{procedimentos.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {procedimentos.length > 0
                  ? `Ticket médio: ${(procedimentos.reduce((s, p) => s + p.preco, 0) / procedimentos.length).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                  : 'Nenhum cadastrado'}
              </div>
            </div>
          </div>

          {/* Second row: Estoque critico + Procedimentos recentes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Estoque Alerta */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={16} style={{ color: 'var(--color-primary)' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Alertas de Estoque</h3>
                </div>
                <button className="btn btn-outline" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setTab('estoque')}>Ver tudo</button>
              </div>
              {estoque.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '20px 0', textAlign: 'center' }}>Nenhum insumo cadastrado.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {estoque.slice(0, 5).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: item.status === 'critico' ? '#fef2f2' : '#f8faf8', border: `1px solid ${item.status === 'critico' ? '#fecaca' : 'var(--color-border)'}` }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.produto}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{item.quantidade} {item.unidade}s restantes</div>
                      </div>
                      <span className={`badge ${item.status === 'critico' ? 'badge-terracotta' : 'badge-success'}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Procedimentos */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Stethoscope size={16} style={{ color: 'var(--color-primary)' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Catálogo de Procedimentos</h3>
                </div>
                <button className="btn btn-outline" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setTab('procedimentos')}>Gerenciar</button>
              </div>
              {procedimentos.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '20px 0', textAlign: 'center' }}>Nenhum procedimento cadastrado ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {procedimentos.slice(0, 5).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: '#f8f8f6', border: '1px solid var(--color-border)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.nome}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{p.duracaoMinutos} min</div>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>{p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── TAB: FINANCEIRO ─────────────────────────────────────────────── */}
      {tab === 'financeiro' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
            {[
              { label: 'Faturamento Bruto de Hoje', value: financeiro.faturamentoTotal, icon: <DollarSign size={16} style={{ color: 'var(--color-success)' }} />, sub: 'Atendimentos finalizados hoje', color: 'var(--color-success)', border: '' },
              { label: 'Comissões Devidas', value: financeiro.comissoesPagas, icon: <TrendingUp size={16} style={{ color: 'var(--color-warning)' }} />, sub: 'Provisão de 30%', color: 'var(--color-text-muted)', border: '' },
              { label: 'Faturamento Líquido', value: faturamentoLiquido, icon: <Wallet size={16} style={{ color: 'var(--color-primary)' }} />, sub: '70% margem estimada', color: 'var(--color-primary)', border: '4px solid var(--color-primary)' },
            ].map(card => (
              <div key={card.label} className="card" style={{ padding: '24px', borderLeft: card.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}><span>{card.label}</span>{card.icon}</div>
                <h2 style={{ fontSize: '28px', fontWeight: 700, color: card.color }}>{card.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
                <span style={{ fontSize: '11px', color: card.color, fontWeight: 500 }}>{card.sub}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '24px', maxWidth: '420px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Métodos de Pagamento</h3>
            {financeiro.formasPagamento.length === 0
              ? <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>Nenhum atendimento finalizado hoje.</p>
              : financeiro.formasPagamento.map((p, i) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600 }}>{p.metodo}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({p.percentual}%)</span>
                  </div>
                  <div style={{ height: '6px', background: '#F0F0F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${p.percentual}%`, height: '100%', background: i === 0 ? 'var(--color-primary)' : '#BACBC5' }} />
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* ── TAB: ESTOQUE ────────────────────────────────────────────────── */}
      {tab === 'estoque' && (
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Controle de Estoque e Consumíveis</h3>
              {criticos > 0 && <span className="badge badge-terracotta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} />{criticos} críticos</span>}
            </div>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => openEstoqueModal()}>
              <Plus size={14} />Novo Insumo
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                {['Insumo', 'Qtd Atual', 'Qtd Mín', 'Unidade', 'Status', 'Última Compra', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', fontWeight: 500, textAlign: h === 'Ações' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estoque.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>Nenhum insumo cadastrado. Clique em "Novo Insumo" para começar.</td></tr>
              )}
              {estoque.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 600 }}>{item.produto}</td>
                  <td style={{ padding: '14px 8px', fontWeight: 700, color: item.status === 'critico' ? '#ef4444' : 'var(--color-text-main)' }}>{item.quantidade}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--color-text-muted)' }}>{item.quantidadeMinima}</td>
                  <td style={{ padding: '14px 8px', color: 'var(--color-text-muted)' }}>{item.unidade}</td>
                  <td style={{ padding: '14px 8px' }}><span className={`badge ${item.status === 'critico' ? 'badge-terracotta' : 'badge-success'}`}>{item.status}</span></td>
                  <td style={{ padding: '14px 8px', color: 'var(--color-text-muted)' }}>{item.ultimaReposicao ? new Date(item.ultimaReposicao).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleAdjustQty(item.id, -1)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px' }} title="Consumir 1">-1</button>
                      <button onClick={() => handleAdjustQty(item.id, 10)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} title="Repor +10">+10</button>
                      <button onClick={() => openEstoqueModal(item)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px' }} title="Editar"><Edit2 size={12} /></button>
                      <button onClick={() => handleDeleteEstoque(item.id)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px', borderColor: '#fca5a5', color: '#ef4444' }} title="Remover"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: PROCEDIMENTOS ──────────────────────────────────────────── */}
      {tab === 'procedimentos' && (
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Stethoscope size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Catálogo de Procedimentos</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>({procedimentos.length} cadastrados)</span>
            </div>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => openProcModal()}>
              <Plus size={14} />Novo Procedimento
            </button>
          </div>
          {procedimentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 40px', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-muted)' }}>
              <Stethoscope size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p style={{ marginBottom: '4px', fontWeight: 600 }}>Nenhum procedimento cadastrado</p>
              <p style={{ fontSize: '13px' }}>Clique em "Novo Procedimento" para montar o seu catálogo.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {procedimentos.map(p => (
                <div key={p.id} className="card" style={{ padding: '20px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-main)' }}>{p.nome}</h4>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => openProcModal(p)} className="btn btn-outline" style={{ padding: '4px 6px' }}><Edit2 size={12} /></button>
                      <button onClick={() => handleDeleteProc(p.id)} className="btn btn-outline" style={{ padding: '4px 6px', borderColor: '#fca5a5', color: '#ef4444' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {(p as any).descricao && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{(p as any).descricao}</p>}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>{p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>{p.duracaoMinutos} min</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ESTOQUE ──────────────────────────────────────────────── */}
      {showEstoqueModal && (
        <div onClick={() => setShowEstoqueModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '420px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{editingEstoqueId ? 'Editar Insumo' : 'Novo Insumo'}</h3>
              <button onClick={() => setShowEstoqueModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveEstoque} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nome do Insumo</label>
                <input className="form-input" value={eProduto} onChange={e => setEProduto(e.target.value)} placeholder="Ex: Toxina Botulínica 50U" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Qtd Atual</label>
                  <input className="form-input" type="number" min="0" value={eQtd} onChange={e => setEQtd(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Qtd Mínima</label>
                  <input className="form-input" type="number" min="0" value={eQtdMin} onChange={e => setEQtdMin(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unidade</label>
                  <select className="form-select" value={eUnidade} onChange={e => setEUnidade(e.target.value)}>
                    {['un', 'ml', 'g', 'cx', 'fr', 'amp'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowEstoqueModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} />Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PROCEDIMENTO ─────────────────────────────────────────── */}
      {showProcModal && (
        <div onClick={() => setShowProcModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '460px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{editingProcId ? 'Editar Procedimento' : 'Novo Procedimento'}</h3>
              <button onClick={() => setShowProcModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveProc} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nome do Procedimento</label>
                <input className="form-input" value={pNome} onChange={e => setPNome(e.target.value)} placeholder="Ex: Toxina Botulínica (Botox)" required />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-input" rows={3} value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="Descreva brevemente o procedimento..." style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={pPreco} onChange={e => setPPreco(e.target.value)} placeholder="1200.00" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Duração (min)</label>
                  <input className="form-input" type="number" min="15" step="15" value={pDuracao} onChange={e => setPDuracao(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowProcModal(false)} className="btn btn-outline">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} />Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
