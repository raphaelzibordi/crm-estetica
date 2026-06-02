import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle, Plus, Edit2, X, Check,
  Percent, Users, Lock, Download, FileText, ChevronDown, ChevronUp, ChevronRight,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  FechamentoRepasse,
  MembroEquipe,
  PreviewRepasse,
  RepasseModelo,
  RepasseRegra,
} from '../types';

interface RepassosProps {
  userId: string;
  nomeGestor: string;
  unidadeId?: string | null;
}

type SubTab = 'regras' | 'calcular' | 'fechamentos';

const fmtISO = (d: Date) => d.toISOString().split('T')[0];
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

const hoje = () => fmtISO(new Date());
const inicioMes = () => fmtISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const MODELO_LABEL: Record<RepasseModelo, string> = {
  percentual:   'Percentual do faturamento',
  fixo_periodo: 'Aluguel de sala (fixo mensal)',
  fixo_sessao:  'Fixo por sessão',
};

const MODELO_COR: Record<RepasseModelo, string> = {
  percentual:   '#5D8A6E',
  fixo_periodo: '#D98E73',
  fixo_sessao:  '#8A8A9B',
};

function modeloValorLabel(modelo: RepasseModelo, valor: number): string {
  if (modelo === 'percentual') return `${valor}% do faturamento → profissional`;
  if (modelo === 'fixo_periodo') return `${fmtBRL(valor)}/mês → clínica`;
  return `${fmtBRL(valor)}/sessão → clínica`;
}

function downloadCSV(fechamento: FechamentoRepasse) {
  const rows = [
    ['Data', 'Procedimento', 'Valor Líquido', 'Valor Repasse'],
    ...fechamento.itensSnapshot.map((i) => [
      fmtDate(i.data),
      i.procedimento,
      i.valorLiquido.toFixed(2).replace('.', ','),
      i.valorRepasse.toFixed(2).replace('.', ','),
    ]),
    [],
    ['Total Atendimentos', fechamento.totalAtendimentos.toString()],
    ['Faturamento Bruto', fechamento.faturamentoBruto.toFixed(2).replace('.', ',')],
    fechamento.modelo === 'percentual'
      ? ['Repasse ao Profissional', fechamento.valorRepasseProfissional.toFixed(2).replace('.', ',')]
      : ['A Receber da Clínica', fechamento.valorRetencaoClinica.toFixed(2).replace('.', ',')],
  ];
  const csv = rows.map((r) => r.join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `repasse_${fechamento.profissionalNome.replace(/\s+/g, '_')}_${fechamento.dataInicio}_${fechamento.dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printDemonstrativo(fechamento: FechamentoRepasse) {
  const periodoStr = `${fmtDate(fechamento.dataInicio)} a ${fmtDate(fechamento.dataFim)}`;
  const rows = fechamento.itensSnapshot
    .map(
      (i) =>
        `<tr>
          <td>${fmtDate(i.data)}</td>
          <td>${i.procedimento}</td>
          <td>${fmtBRL(i.valorLiquido)}</td>
          <td>${fmtBRL(i.valorRepasse)}</td>
        </tr>`
    )
    .join('');

  const valorFinalLabel =
    fechamento.modelo === 'percentual'
      ? `Repasse ao profissional: ${fmtBRL(fechamento.valorRepasseProfissional)}`
      : `A receber da clínica: ${fmtBRL(fechamento.valorRetencaoClinica)}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Demonstrativo de Repasse</title>
<style>
  body { font-family: Arial, sans-serif; padding: 32px; color: #1a1a1a; }
  h2 { font-size: 20px; margin-bottom: 4px; }
  p { color: #666; font-size: 14px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
  th { background: #f0f0f0; padding: 8px 12px; text-align: left; border-bottom: 2px solid #ccc; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  .totals { margin-top: 24px; font-size: 15px; }
  .totals div { margin: 4px 0; }
  .highlight { font-weight: bold; font-size: 17px; color: #1a472a; }
  .footer { margin-top: 48px; font-size: 12px; color: #999; }
</style>
</head><body>
<h2>Demonstrativo de Repasse</h2>
<p><strong>Profissional:</strong> ${fechamento.profissionalNome}</p>
<p><strong>Período:</strong> ${periodoStr}</p>
<p><strong>Modelo:</strong> ${MODELO_LABEL[fechamento.modelo]}</p>
<p><strong>Emitido por:</strong> ${fechamento.fechadoPor} em ${new Date(fechamento.fechadoEm).toLocaleString('pt-BR')}</p>
<table>
  <thead><tr><th>Data</th><th>Procedimento</th><th>Valor Líquido</th><th>Repasse / Taxa</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div>Total de atendimentos: <strong>${fechamento.totalAtendimentos}</strong></div>
  <div>Faturamento bruto do profissional: <strong>${fmtBRL(fechamento.faturamentoBruto)}</strong></div>
  <div class="highlight">${valorFinalLabel}</div>
  ${fechamento.observacoes ? `<div style="margin-top:12px;color:#666;font-size:13px;">Obs: ${fechamento.observacoes}</div>` : ''}
</div>
<div class="footer">Documento gerado pelo Lumina CRM. ID do fechamento: ${fechamento.id}</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.print();
}

// ─────────────────────────────────────────────────────────────────────────────
export const Repassos: React.FC<RepassosProps> = ({ userId, nomeGestor, unidadeId }) => {
  const [subTab, setSubTab] = useState<SubTab>('regras');

  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [regras, setRegras] = useState<RepasseRegra[]>([]);
  const [fechamentos, setFechamentos] = useState<FechamentoRepasse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Calcular tab ──
  const [calcProfId, setCalcProfId] = useState('');
  const [calcStart, setCalcStart] = useState(inicioMes());
  const [calcEnd, setCalcEnd] = useState(hoje());
  const [preview, setPreview] = useState<PreviewRepasse | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [fechLoading, setFechLoading] = useState(false);
  const [obsText, setObsText] = useState('');
  const [expandedPreview, setExpandedPreview] = useState(false);

  // ── Regra modal ──
  const [showRegraModal, setShowRegraModal] = useState(false);
  const [editingRegra, setEditingRegra] = useState<RepasseRegra | null>(null);
  const [rProfId, setRProfId] = useState('');
  const [rModelo, setRModelo] = useState<RepasseModelo>('percentual');
  const [rValor, setRValor] = useState('');
  const [rDataInicio, setRDataInicio] = useState(hoje());
  const [rDataFim, setRDataFim] = useState('');
  const [rSaving, setRSaving] = useState(false);

  // ── Fechamentos tab ──
  const [expandedFechId, setExpandedFechId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [equipeData, regrasData, fechamentosData] = await Promise.all([
        api.getEquipe(userId, { somenteAtivos: true }, unidadeId ?? undefined),
        api.getRepasseRegras(userId),
        api.getFechamentosRepasse(userId),
      ]);
      setEquipe(equipeData);
      setRegras(regrasData);
      setFechamentos(fechamentosData);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Handlers Regras ──
  const openNewRegraModal = () => {
    setEditingRegra(null);
    setRProfId('');
    setRModelo('percentual');
    setRValor('');
    setRDataInicio(hoje());
    setRDataFim('');
    setShowRegraModal(true);
  };

  const openEditRegraModal = (r: RepasseRegra) => {
    setEditingRegra(r);
    setRProfId(r.profissionalId);
    setRModelo(r.modelo);
    setRValor(String(r.valor));
    setRDataInicio(r.dataInicio);
    setRDataFim(r.dataFim ?? '');
    setShowRegraModal(true);
  };

  const handleSaveRegra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rProfId || !rValor) return;
    const valorNum = parseFloat(rValor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) return;
    const profMembro = equipe.find((m) => m.id === rProfId);
    if (!profMembro) return;

    // Regra de negócio: um profissional só pode ter um modelo ativo por vez
    if (!editingRegra) {
      const regraExistente = regras.find(
        (r) => r.profissionalId === rProfId && r.ativo
      );
      if (regraExistente) {
        const ok = confirm(
          `${profMembro.nome} já tem uma regra ativa (${MODELO_LABEL[regraExistente.modelo]}).\n\nA regra existente será desativada e substituída pela nova. Confirma?`
        );
        if (!ok) return;
        try {
          const updated = await api.updateRepasseRegra(regraExistente.id, { ativo: false }, userId);
          setRegras((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        } catch {
          // continua — a regra nova vai sobrepor na lógica de cálculo
        }
      }
    }

    setRSaving(true);
    try {
      if (editingRegra) {
        const updated = await api.updateRepasseRegra(
          editingRegra.id,
          { modelo: rModelo, valor: valorNum, dataInicio: rDataInicio, dataFim: rDataFim || null },
          userId
        );
        setRegras((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const nova = await api.createRepasseRegra(
          {
            profissionalId: rProfId,
            profissionalNome: profMembro.nome,
            modelo: rModelo,
            valor: valorNum,
            dataInicio: rDataInicio,
            dataFim: rDataFim || null,
            ativo: true,
          },
          userId
        );
        setRegras((prev) => [nova, ...prev]);
      }
      setShowRegraModal(false);
    } catch (err: any) {
      alert(err.message ?? 'Erro ao salvar regra');
    } finally {
      setRSaving(false);
    }
  };

  const handleDesativarRegra = async (r: RepasseRegra) => {
    if (!confirm(`Desativar regra de ${r.profissionalNome}? Fechamentos futuros não usarão esta regra.`)) return;
    try {
      const updated = await api.updateRepasseRegra(r.id, { ativo: false }, userId);
      setRegras((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err: any) {
      alert(err.message ?? 'Erro ao desativar regra');
    }
  };

  // ── Handlers Calcular ──
  const handleCalcular = async () => {
    if (!calcProfId) return;
    setCalcLoading(true);
    setPreview(null);
    try {
      const prev = await api.calcularPreviewRepasse(userId, {
        profissionalId: calcProfId,
        dataInicio: calcStart,
        dataFim: calcEnd,
      });
      setPreview(prev);
      setExpandedPreview(false);
    } catch (err: any) {
      alert(err.message ?? 'Erro ao calcular');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleFecharPeriodo = async () => {
    if (!preview || !calcProfId) return;
    const profMembro = equipe.find((m) => m.id === calcProfId);
    if (!profMembro) return;

    if (!confirm(
      `Fechar período de repasse de ${profMembro.nome} (${fmtDate(calcStart)} – ${fmtDate(calcEnd)})?\n\nEsta ação é irreversível após a confirmação.`
    )) return;

    setFechLoading(true);
    try {
      const fechamento = await api.fecharPeriodoRepasse(userId, {
        profissionalId: calcProfId,
        profissionalNome: profMembro.nome,
        dataInicio: calcStart,
        dataFim: calcEnd,
        fechadoPor: nomeGestor,
        observacoes: obsText || undefined,
      });
      setFechamentos((prev) => [fechamento, ...prev]);
      setPreview(null);
      setObsText('');
      setSubTab('fechamentos');
    } catch (err: any) {
      alert(err.message ?? 'Erro ao fechar período');
    } finally {
      setFechLoading(false);
    }
  };

  // ── Estilos compartilhados ──
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    background: active ? 'var(--color-accent)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-muted)',
    transition: 'all 0.15s',
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
        Carregando repassos...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-alt)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        <button style={tabBtnStyle(subTab === 'regras')} onClick={() => setSubTab('regras')}>
          <Users size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />Regras
        </button>
        <button style={tabBtnStyle(subTab === 'calcular')} onClick={() => setSubTab('calcular')}>
          <Percent size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />Calcular
        </button>
        <button style={tabBtnStyle(subTab === 'fechamentos')} onClick={() => setSubTab('fechamentos')}>
          <Lock size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />Fechamentos
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: '10px', color: '#dc2626', fontSize: '14px' }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ── TAB: REGRAS ─────────────────────────────────────────────────── */}
      {subTab === 'regras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: 0 }}>
                Configure o modelo de repasse para cada profissional autônomo/parceiro.
              </p>
            </div>
            <button
              onClick={openNewRegraModal}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              <Plus size={14} />Nova Regra
            </button>
          </div>

          {regras.length === 0 ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Users size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ margin: 0 }}>Nenhuma regra configurada. Clique em "Nova Regra" para começar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {regras.map((r) => (
                <div key={r.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', opacity: r.ativo ? 1 : 0.5 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.ativo ? MODELO_COR[r.modelo] : '#ccc', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-main)' }}>{r.profissionalNome}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {MODELO_LABEL[r.modelo]} · {modeloValorLabel(r.modelo, r.valor)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Vigência: {fmtDate(r.dataInicio)}{r.dataFim ? ` até ${fmtDate(r.dataFim)}` : ' (indeterminada)'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {r.ativo && (
                      <>
                        <button
                          onClick={() => openEditRegraModal(r)}
                          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDesativarRegra(r)}
                          title="Desativar"
                          style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#ef4444' }}
                        >
                          <X size={13} />
                        </button>
                      </>
                    )}
                    {!r.ativo && (
                      <span style={{ fontSize: '11px', color: '#999', padding: '4px 8px', border: '1px solid #eee', borderRadius: '6px' }}>Inativa</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CALCULAR ───────────────────────────────────────────────── */}
      {subTab === 'calcular' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Parâmetros do cálculo</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Profissional</label>
                <select
                  value={calcProfId}
                  onChange={(e) => { setCalcProfId(e.target.value); setPreview(null); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-main)' }}
                >
                  <option value="">Selecione...</option>
                  {equipe.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Início do período</label>
                <input
                  type="date"
                  value={calcStart}
                  onChange={(e) => { setCalcStart(e.target.value); setPreview(null); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-main)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Fim do período</label>
                <input
                  type="date"
                  value={calcEnd}
                  onChange={(e) => { setCalcEnd(e.target.value); setPreview(null); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-main)', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button
              onClick={handleCalcular}
              disabled={!calcProfId || calcLoading}
              style={{ alignSelf: 'flex-start', padding: '10px 20px', borderRadius: '8px', border: 'none', background: calcProfId ? 'var(--color-accent)' : '#ccc', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: calcProfId ? 'pointer' : 'not-allowed' }}
            >
              {calcLoading ? 'Calculando...' : 'Calcular'}
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {!preview.regra && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef9c3', border: '1px solid #fde047', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#78350f' }}>
                  <AlertTriangle size={14} />
                  Nenhuma regra de repasse ativa para este profissional. Cadastre uma regra na aba <strong>Regras</strong>.
                </div>
              )}

              {preview.regra && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #86efac', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: '#166534' }}>
                  <Check size={14} />
                  Regra ativa: <strong>{MODELO_LABEL[preview.regra.modelo]}</strong> — {modeloValorLabel(preview.regra.modelo, preview.regra.valor)}
                </div>
              )}

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Total de Atendimentos', value: String(preview.totalAtendimentos), accent: false },
                  { label: 'Faturamento Bruto', value: fmtBRL(preview.faturamentoBruto), accent: false },
                  {
                    label: preview.regra?.modelo === 'percentual' ? 'Repasse ao Profissional' : 'Receita para a Clínica',
                    value: preview.regra?.modelo === 'percentual'
                      ? fmtBRL(preview.valorRepasseProfissional)
                      : fmtBRL(preview.valorRetencaoClinica),
                    accent: true,
                  },
                  {
                    label: preview.regra?.modelo === 'percentual' ? 'Retenção da Clínica' : 'Faturamento Líquido',
                    value: preview.regra?.modelo === 'percentual'
                      ? fmtBRL(preview.valorRetencaoClinica)
                      : fmtBRL(preview.faturamentoBruto),
                    accent: false,
                  },
                ].map((kpi) => (
                  <div key={kpi.label} style={{ padding: '16px', background: 'var(--color-bg-alt)', borderRadius: '10px', borderLeft: kpi.accent ? '3px solid var(--color-accent)' : undefined }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>{kpi.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Lista de atendimentos (expansível) */}
              {preview.itens.length > 0 && (
                <div>
                  <button
                    onClick={() => setExpandedPreview((v) => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', padding: 0, marginBottom: '8px' }}
                  >
                    {expandedPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {expandedPreview ? 'Ocultar' : 'Ver'} {preview.itens.length} atendimentos
                  </button>
                  {expandedPreview && (
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <ScrollTableWrapper>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: 'var(--color-bg-alt)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--color-bg-alt)', zIndex: 1 }}>Data</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>Procedimento</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>Valor Líquido</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>Repasse / Taxa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.itens.map((item, idx) => (
                            <tr key={item.agendamentoId} style={{ borderTop: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-alt)' }}>
                              <td style={{ padding: '8px 12px', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{fmtDate(item.data)}</td>
                              <td style={{ padding: '8px 12px' }}>{item.procedimento}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtBRL(item.valorLiquido)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: item.valorRepasse > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{item.valorRepasse > 0 ? fmtBRL(item.valorRepasse) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </ScrollTableWrapper>
                    </div>
                  )}
                </div>
              )}

              {/* Fechar período */}
              {preview.regra && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Observações (opcional)</label>
                  <textarea
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    rows={2}
                    placeholder="Ex: Mês de maio — inclui feriado ajustado..."
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px', background: 'var(--color-bg)', color: 'var(--color-text-main)', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={handleFecharPeriodo}
                      disabled={fechLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: fechLoading ? 'not-allowed' : 'pointer' }}
                    >
                      <Lock size={14} />
                      {fechLoading ? 'Fechando...' : 'Fechar Período (imutável)'}
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Esta ação não pode ser desfeita. O profissional será notificado.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: FECHAMENTOS ────────────────────────────────────────────── */}
      {subTab === 'fechamentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {fechamentos.length === 0 ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Lock size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ margin: 0 }}>Nenhum fechamento realizado ainda.</p>
            </div>
          ) : (
            fechamentos.map((f) => (
              <div key={f.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {/* Header clicável */}
                <div
                  onClick={() => setExpandedFechId(expandedFechId === f.id ? null : f.id)}
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                >
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: MODELO_COR[f.modelo], flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-main)' }}>
                      {f.profissionalNome}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {MODELO_LABEL[f.modelo]} · {fmtDate(f.dataInicio)} – {fmtDate(f.dataFim)} · {f.totalAtendimentos} atend.
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text-main)' }}>
                      {f.modelo === 'percentual'
                        ? fmtBRL(f.valorRepasseProfissional)
                        : fmtBRL(f.valorRetencaoClinica)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {f.modelo === 'percentual' ? 'repasse prof.' : 'receita clínica'}
                    </div>
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {expandedFechId === f.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded content */}
                {expandedFechId === f.id && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '20px' }}>
                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                      {[
                        { label: 'Atendimentos', value: String(f.totalAtendimentos) },
                        { label: 'Faturamento Bruto', value: fmtBRL(f.faturamentoBruto) },
                        {
                          label: f.modelo === 'percentual' ? 'Repasse ao Prof.' : 'A Receber da Clínica',
                          value: f.modelo === 'percentual' ? fmtBRL(f.valorRepasseProfissional) : fmtBRL(f.valorRetencaoClinica),
                        },
                        {
                          label: f.modelo === 'percentual' ? 'Retenção Clínica' : 'Fat. Líquido Prof.',
                          value: f.modelo === 'percentual' ? fmtBRL(f.valorRetencaoClinica) : fmtBRL(f.faturamentoBruto),
                        },
                      ].map((kpi) => (
                        <div key={kpi.label} style={{ background: 'var(--color-bg-alt)', borderRadius: '8px', padding: '12px 14px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{kpi.label}</div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{kpi.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tabela de itens */}
                    {f.itensSnapshot.length > 0 && (
                      <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                        <ScrollTableWrapper>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'var(--color-bg-alt)' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--color-bg-alt)', zIndex: 1 }}>Data</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>Procedimento</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>Valor Líquido</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>Repasse / Taxa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.itensSnapshot.map((item, idx) => (
                              <tr key={item.agendamentoId} style={{ borderTop: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-alt)' }}>
                                <td style={{ padding: '7px 12px', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{fmtDate(item.data)}</td>
                                <td style={{ padding: '7px 12px' }}>{item.procedimento}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right' }}>{fmtBRL(item.valorLiquido)}</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: item.valorRepasse > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                                  {item.valorRepasse > 0 ? fmtBRL(item.valorRepasse) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </ScrollTableWrapper>
                      </div>
                    )}

                    {/* Metadados */}
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                      Fechado por <strong>{f.fechadoPor}</strong> em {new Date(f.fechadoEm).toLocaleString('pt-BR')}
                      {f.observacoes && <> · {f.observacoes}</>}
                    </div>

                    {/* Ações de exportação */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => downloadCSV(f)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-main)', cursor: 'pointer', fontSize: '13px' }}
                      >
                        <Download size={13} />Exportar CSV
                      </button>
                      <button
                        onClick={() => printDemonstrativo(f)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '7px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-main)', cursor: 'pointer', fontSize: '13px' }}
                      >
                        <FileText size={13} />Imprimir / PDF
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#999', marginLeft: '4px' }}>
                        <Lock size={11} />Registro imutável
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MODAL: REGRA ────────────────────────────────────────────────── */}
      {showRegraModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
          onClick={() => setShowRegraModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ maxWidth: '460px', width: '92%', padding: '32px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>
                {editingRegra ? 'Editar Regra de Repasse' : 'Nova Regra de Repasse'}
              </h3>
              <button onClick={() => setShowRegraModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRegra} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!editingRegra && (
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Profissional *</label>
                  <select
                    required
                    value={rProfId}
                    onChange={(e) => setRProfId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-main)' }}
                  >
                    <option value="">Selecione o profissional</option>
                    {equipe.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Modelo de repasse *</label>
                <select
                  value={rModelo}
                  onChange={(e) => setRModelo(e.target.value as RepasseModelo)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-main)' }}
                >
                  <option value="percentual">Percentual — profissional recebe X% do faturamento</option>
                  <option value="fixo_periodo">Aluguel de sala — profissional paga R$/mês à clínica</option>
                  <option value="fixo_sessao">Fixo por sessão — profissional paga R$/sessão à clínica</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>
                  {rModelo === 'percentual' ? 'Percentual para o profissional (%) *' : 'Valor (R$) *'}
                </label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={rModelo === 'percentual' ? '100' : undefined}
                  value={rValor}
                  onChange={(e) => setRValor(e.target.value)}
                  placeholder={rModelo === 'percentual' ? 'Ex: 60' : 'Ex: 800'}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-main)', boxSizing: 'border-box' }}
                />
                {rModelo === 'percentual' && rValor && (
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Profissional recebe {rValor}% · Clínica retém {(100 - parseFloat(rValor || '0')).toFixed(0)}%
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Vigência — início *</label>
                  <input
                    required
                    type="date"
                    value={rDataInicio}
                    onChange={(e) => setRDataInicio(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-main)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Vigência — fim (opcional)</label>
                  <input
                    type="date"
                    value={rDataFim}
                    min={rDataInicio}
                    onChange={(e) => setRDataFim(e.target.value)}
                    placeholder="Indeterminado"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', background: 'var(--color-bg)', color: 'var(--color-text-main)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowRegraModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-muted)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={rSaving}
                  style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: rSaving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600 }}
                >
                  {rSaving ? 'Salvando...' : editingRegra ? 'Salvar Alterações' : 'Criar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ScrollTableWrapper ───────────────────────────────────────────────────────

const ScrollTableWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setShowFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, []);
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={{ overflowX: 'auto' }}>
        {children}
      </div>
      {showFade && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 56,
          background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.92))',
          pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10,
        }}>
          <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', opacity: 0.7 }} />
        </div>
      )}
    </div>
  );
};
