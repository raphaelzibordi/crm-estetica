import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle, Plus, Edit2, Trash2, X, Check, ChevronDown,
  DollarSign, Percent, Users, Lock, Download, TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  ComissaoRegra,
  ComissaoTipo,
  FechamentoComissao,
  MembroEquipe,
  Procedimento,
  RelatorioComissaoProfissional,
} from '../types';

interface ComissoesProps {
  userId: string;
  nomeGestor: string;
}

type SubTab = 'relatorio' | 'regras' | 'fechamentos';
type PresetPeriodo = 'hoje' | '7dias' | 'mes' | 'personalizado';

const fmtISO = (d: Date) => d.toISOString().split('T')[0];
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function getPeriodo(preset: PresetPeriodo, custom?: { start: string; end: string }) {
  const today = new Date();
  switch (preset) {
    case 'hoje':
      return { start: fmtISO(today), end: fmtISO(today) };
    case '7dias': {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { start: fmtISO(d), end: fmtISO(today) };
    }
    case 'mes': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmtISO(start), end: fmtISO(today) };
    }
    case 'personalizado':
      return { start: custom?.start ?? fmtISO(today), end: custom?.end ?? fmtISO(today) };
  }
}

const PRIORIDADE_LABEL: Record<string, string> = {
  especifica: 'Específica',
  por_profissional: 'Por Profissional',
  por_procedimento: 'Por Procedimento',
};

const PRIORIDADE_COLOR: Record<string, string> = {
  especifica: '#5D8A6E',
  por_profissional: '#D98E73',
  por_procedimento: '#8A8A9B',
};

// ─────────────────────────────────────────────────────────────────────────────
export const Comissoes: React.FC<ComissoesProps> = ({ userId, nomeGestor }) => {
  const [subTab, setSubTab] = useState<SubTab>('relatorio');

  // ── Período ──
  const [preset, setPreset] = useState<PresetPeriodo>('mes');
  const [customStart, setCustomStart] = useState(fmtISO(new Date()));
  const [customEnd, setCustomEnd] = useState(fmtISO(new Date()));
  const [showCustom, setShowCustom] = useState(false);
  const [draftStart, setDraftStart] = useState(fmtISO(new Date()));
  const [draftEnd, setDraftEnd] = useState(fmtISO(new Date()));

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getPeriodo(preset, { start: customStart, end: customEnd }),
    [preset, customStart, customEnd]
  );

  // ── Dados ──
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [regras, setRegras] = useState<ComissaoRegra[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioComissaoProfissional[]>([]);
  const [alertasSemRegra, setAlertasSemRegra] = useState<number>(0);
  const [fechamentos, setFechamentos] = useState<FechamentoComissao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Filtro profissional ──
  const [filtroProfId, setFiltroProfId] = useState<string>('');

  // ── Modal Regra ──
  const [showRegraModal, setShowRegraModal] = useState(false);
  const [editingRegra, setEditingRegra] = useState<ComissaoRegra | null>(null);
  const [rProfId, setRProfId] = useState('');
  const [rProcId, setRProcId] = useState('');
  const [rTipo, setRTipo] = useState<ComissaoTipo>('percentual');
  const [rValor, setRValor] = useState('');
  const [rAtivo, setRAtivo] = useState(true);
  const [rSaving, setRSaving] = useState(false);

  // ── Modal Fechamento ──
  const [showFechamentoModal, setShowFechamentoModal] = useState(false);
  const [fProfId, setFProfId] = useState('');
  const [fObs, setFObs] = useState('');
  const [fSaving, setFSaving] = useState(false);

  // ─── Loaders ─────────────────────────────────────────────────────────────

  const loadBase = useCallback(async () => {
    try {
      const [eq, procs, regs] = await Promise.all([
        api.getEquipe(userId, { somenteAtivos: true }),
        api.getProcedimentos(userId),
        api.getComissaoRegras(userId),
      ]);
      setEquipe(eq);
      setProcedimentos(procs);
      setRegras(regs);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar dados.');
    }
  }, [userId]);

  const loadRelatorio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rel, alertas] = await Promise.all([
        api.getRelatorioComissoes(userId, {
          inicio: rangeStart,
          fim: rangeEnd,
          profissionalId: filtroProfId || null,
        }),
        api.getAlertasSemRegra(userId, { inicio: rangeStart, fim: rangeEnd }),
      ]);
      setRelatorio(rel);
      setAlertasSemRegra(alertas.length);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar relatório.');
    } finally {
      setLoading(false);
    }
  }, [userId, rangeStart, rangeEnd, filtroProfId]);

  const loadFechamentos = useCallback(async () => {
    try {
      setFechamentos(await api.getFechamentosComissao(userId));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar fechamentos.');
    }
  }, [userId]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { if (subTab === 'relatorio') loadRelatorio(); }, [subTab, loadRelatorio]);
  useEffect(() => { if (subTab === 'fechamentos') loadFechamentos(); }, [subTab, loadFechamentos]);

  // ─── Totais consolidados ──────────────────────────────────────────────────

  const totalGeral = useMemo(() => ({
    atendimentos: relatorio.reduce((s, g) => s + g.totalAtendimentos, 0),
    base: relatorio.reduce((s, g) => s + g.totalBase, 0),
    comissao: relatorio.reduce((s, g) => s + g.totalComissao, 0),
  }), [relatorio]);

  // ─── Regra Modal ─────────────────────────────────────────────────────────

  const openNovaRegra = () => {
    setEditingRegra(null);
    setRProfId('');
    setRProcId('');
    setRTipo('percentual');
    setRValor('');
    setRAtivo(true);
    setShowRegraModal(true);
  };

  const openEditRegra = (r: ComissaoRegra) => {
    setEditingRegra(r);
    setRProfId(r.profissionalId ?? '');
    setRProcId(r.procedimentoId ?? '');
    setRTipo(r.tipo);
    setRValor(String(r.valor));
    setRAtivo(r.ativo);
    setShowRegraModal(true);
  };

  const handleSaveRegra = async () => {
    const valor = parseFloat(rValor.replace(',', '.'));
    if (isNaN(valor) || valor < 0) { setError('Informe um valor válido.'); return; }
    if (!rProfId && !rProcId) { setError('Selecione pelo menos um profissional ou procedimento.'); return; }
    setRSaving(true);
    try {
      const payload = {
        profissionalId: rProfId || null,
        procedimentoId: rProcId || null,
        tipo: rTipo,
        valor,
        ativo: rAtivo,
      };
      if (editingRegra) {
        await api.updateComissaoRegra(editingRegra.id, payload, userId);
      } else {
        await api.createComissaoRegra(payload, userId);
      }
      setShowRegraModal(false);
      loadBase();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar regra.');
    } finally {
      setRSaving(false);
    }
  };

  const handleDeleteRegra = async (id: string) => {
    if (!confirm('Excluir esta regra de comissão?')) return;
    try {
      await api.deleteComissaoRegra(id, userId);
      loadBase();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao excluir regra.');
    }
  };

  // ─── Fechamento Modal ─────────────────────────────────────────────────────

  const handleFecharPeriodo = async () => {
    setFSaving(true);
    try {
      const profissional = equipe.find(e => e.id === fProfId);
      await api.fecharPeriodoComissoes(userId, {
        profissionalId: fProfId || null,
        profissionalNome: profissional?.nome ?? null,
        dataInicio: rangeStart,
        dataFim: rangeEnd,
        fechadoPor: nomeGestor,
        observacoes: fObs || undefined,
      });
      setShowFechamentoModal(false);
      setFProfId('');
      setFObs('');
      loadRelatorio();
      loadFechamentos();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao fechar período.');
    } finally {
      setFSaving(false);
    }
  };

  // ─── Export CSV ──────────────────────────────────────────────────────────

  const exportarCSV = () => {
    const linhas = [
      ['Data', 'Profissional', 'Procedimento', 'Valor Base (R$)', 'Tipo', '%', 'Comissão (R$)', 'Fechado'],
    ];
    for (const grupo of relatorio) {
      for (const item of grupo.itens) {
        linhas.push([
          fmtDate(item.dataAtendimento),
          item.profissionalNome,
          item.procedimentoNome,
          item.valorBase.toFixed(2),
          item.tipo ?? 'sem regra',
          item.percentualAplicado !== null ? `${item.percentualAplicado}%` : '-',
          item.valorComissao.toFixed(2),
          item.fechamentoId ? 'Sim' : 'Não',
        ]);
      }
    }
    const csv = linhas.map(l => l.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissoes_${rangeStart}_${rangeEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1A1A2E' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #F0EDE8' }}>
        {(['relatorio', 'regras', 'fechamentos'] as SubTab[]).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            style={{
              padding: '8px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: subTab === t ? 700 : 400,
              color: subTab === t ? '#D98E73' : '#6B6B7E',
              borderBottom: subTab === t ? '2px solid #D98E73' : '2px solid transparent',
              marginBottom: -2,
              fontSize: 14,
              letterSpacing: '0.02em',
              transition: 'all 0.15s',
            }}
          >
            {t === 'relatorio' && 'Relatório'}
            {t === 'regras' && 'Regras'}
            {t === 'fechamentos' && 'Fechamentos'}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: '#FFF1EE', border: '1px solid #F5C5B8', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={16} color="#C0392B" />
          <span style={{ color: '#C0392B', fontSize: 13, flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={14} color="#C0392B" />
          </button>
        </div>
      )}

      {/* ── TAB: RELATÓRIO ─────────────────────────────────────────── */}
      {subTab === 'relatorio' && (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
            {/* Período */}
            <div>
              <div style={{ fontSize: 11, color: '#8A8A9B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['hoje', '7dias', 'mes', 'personalizado'] as PresetPeriodo[]).map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      if (p === 'personalizado') {
                        setDraftStart(customStart); setDraftEnd(customEnd);
                        setShowCustom(true);
                      } else {
                        setPreset(p); setShowCustom(false);
                      }
                    }}
                    style={{
                      padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${preset === p ? '#D98E73' : '#DDD8D0'}`,
                      background: preset === p ? '#FFF4EF' : '#FFF',
                      color: preset === p ? '#D98E73' : '#6B6B7E',
                      fontWeight: preset === p ? 600 : 400,
                    }}
                  >
                    {p === 'hoje' && 'Hoje'}
                    {p === '7dias' && '7 dias'}
                    {p === 'mes' && 'Mês'}
                    {p === 'personalizado' && 'Personalizado'}
                  </button>
                ))}
              </div>
              {showCustom && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', background: '#FFF', border: '1px solid #DDD8D0', borderRadius: 8, padding: '10px 14px' }}>
                  <input type="date" value={draftStart} onChange={e => setDraftStart(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #DDD8D0', fontSize: 13 }} />
                  <span style={{ color: '#8A8A9B' }}>→</span>
                  <input type="date" value={draftEnd} onChange={e => setDraftEnd(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #DDD8D0', fontSize: 13 }} />
                  <button onClick={() => { setCustomStart(draftStart); setCustomEnd(draftEnd); setPreset('personalizado'); setShowCustom(false); }}
                    style={{ padding: '6px 14px', background: '#D98E73', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Aplicar
                  </button>
                  <button onClick={() => setShowCustom(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={14} color="#8A8A9B" />
                  </button>
                </div>
              )}
            </div>

            {/* Filtro Profissional */}
            <div>
              <div style={{ fontSize: 11, color: '#8A8A9B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profissional</div>
              <select
                value={filtroProfId}
                onChange={e => setFiltroProfId(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #DDD8D0', fontSize: 13, background: '#FFF', color: '#1A1A2E' }}
              >
                <option value="">Todos</option>
                {equipe.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>

            {/* Ações */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={exportarCSV}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F5F3F0', border: '1px solid #DDD8D0', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#4A4A5E', fontWeight: 500 }}>
                <Download size={14} />
                CSV
              </button>
              <button onClick={() => setShowFechamentoModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#D98E73', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#FFF', fontWeight: 600 }}>
                <Lock size={14} />
                Fechar Período
              </button>
            </div>
          </div>

          {/* Alerta sem regra */}
          {alertasSemRegra > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #F7C948', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={16} color="#B7791F" />
              <span style={{ fontSize: 13, color: '#744210' }}>
                <strong>{alertasSemRegra}</strong> atendimento{alertasSemRegra > 1 ? 's' : ''} sem regra de comissão no período.
                {' '}<button onClick={() => setSubTab('regras')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D98E73', fontWeight: 600, fontSize: 13, padding: 0 }}>Configurar regras →</button>
              </span>
            </div>
          )}

          {/* Cards por profissional */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8A8A9B' }}>Carregando...</div>
          ) : relatorio.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8A8A9B' }}>
              <TrendingUp size={32} color="#DDD8D0" style={{ marginBottom: 12 }} />
              <p>Nenhuma comissão encontrada no período selecionado.</p>
            </div>
          ) : (
            <>
              {relatorio.map(grupo => (
                <GrupoComissao key={grupo.profissionalNome} grupo={grupo} />
              ))}

              {/* Total geral */}
              <div style={{
                background: '#1A1A2E', color: '#FFF', borderRadius: 10, padding: '16px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Total Geral</div>
                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>Atendimentos</div>
                    <div style={{ fontWeight: 700 }}>{totalGeral.atendimentos}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>Faturado (base)</div>
                    <div style={{ fontWeight: 700 }}>{fmtBRL(totalGeral.base)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>Total Comissões</div>
                    <div style={{ fontWeight: 700, color: '#D98E73' }}>{fmtBRL(totalGeral.comissao)}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: REGRAS ────────────────────────────────────────────── */}
      {subTab === 'regras' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: '#6B6B7E', maxWidth: 560 }}>
                Defina quanto cada profissional recebe por procedimento.
                Regras mais específicas (profissional + procedimento) têm prioridade sobre as gerais.
              </p>
            </div>
            <button onClick={openNovaRegra}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#D98E73', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#FFF', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Plus size={15} />
              Nova Regra
            </button>
          </div>

          {/* Legenda de prioridade */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {Object.entries(PRIORIDADE_LABEL).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B6B7E' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: PRIORIDADE_COLOR[k] }} />
                {v}
              </div>
            ))}
          </div>

          {regras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8A8A9B' }}>
              <DollarSign size={32} color="#DDD8D0" style={{ marginBottom: 12 }} />
              <p>Nenhuma regra de comissão cadastrada.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {regras.map(r => (
                <div key={r.id} style={{
                  background: '#FFF', border: '1px solid #EDE8E1', borderRadius: 10,
                  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
                  opacity: r.ativo ? 1 : 0.5,
                }}>
                  {/* Prioridade badge */}
                  <div style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    color: '#FFF', background: PRIORIDADE_COLOR[r.prioridade], whiteSpace: 'nowrap',
                  }}>
                    {PRIORIDADE_LABEL[r.prioridade]}
                  </div>

                  {/* Profissional */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#8A8A9B', marginBottom: 2 }}>Profissional</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>
                      {r.profissionalNome ?? <span style={{ color: '#8A8A9B', fontWeight: 400 }}>Todos</span>}
                    </div>
                  </div>

                  {/* Procedimento */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#8A8A9B', marginBottom: 2 }}>Procedimento</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>
                      {r.procedimentoNome ?? <span style={{ color: '#8A8A9B', fontWeight: 400 }}>Todos</span>}
                    </div>
                  </div>

                  {/* Comissão */}
                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontSize: 12, color: '#8A8A9B', marginBottom: 2 }}>Comissão</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#D98E73' }}>
                      {r.tipo === 'percentual' ? `${r.valor}%` : fmtBRL(r.valor)}
                    </div>
                  </div>

                  {/* Ativo toggle */}
                  <button
                    onClick={() => api.updateComissaoRegra(r.id, { ativo: !r.ativo }, userId).then(loadBase)}
                    title={r.ativo ? 'Desativar' : 'Ativar'}
                    style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: r.ativo ? '#5D8A6E' : '#DDD8D0', position: 'relative', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%', background: '#FFF',
                      left: r.ativo ? 19 : 3, transition: 'left 0.2s',
                    }} />
                  </button>

                  {/* Ações */}
                  <button onClick={() => openEditRegra(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Edit2 size={15} color="#8A8A9B" />
                  </button>
                  <button onClick={() => handleDeleteRegra(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Trash2 size={15} color="#C0392B" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: FECHAMENTOS ───────────────────────────────────────── */}
      {subTab === 'fechamentos' && (
        <div>
          {fechamentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8A8A9B' }}>
              <Lock size={32} color="#DDD8D0" style={{ marginBottom: 12 }} />
              <p>Nenhum período foi fechado ainda.</p>
              <p style={{ fontSize: 13 }}>Vá ao <button onClick={() => setSubTab('relatorio')} style={{ background: 'none', border: 'none', color: '#D98E73', cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: 0 }}>Relatório</button> e clique em "Fechar Período".</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fechamentos.map(f => (
                <div key={f.id} style={{
                  background: '#FFF', border: '1px solid #EDE8E1', borderRadius: 10,
                  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <Lock size={16} color="#5D8A6E" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>
                      {f.profissionalNome ?? 'Todos os profissionais'}
                    </div>
                    <div style={{ fontSize: 12, color: '#8A8A9B', marginTop: 2 }}>
                      {fmtDate(f.dataInicio)} → {fmtDate(f.dataFim)}
                      {' · '}{f.quantidadeAtendimentos} atendimento{f.quantidadeAtendimentos !== 1 ? 's' : ''}
                      {' · '}Fechado por {f.fechadoPor}
                    </div>
                    {f.observacoes && (
                      <div style={{ fontSize: 12, color: '#6B6B7E', marginTop: 4, fontStyle: 'italic' }}>
                        {f.observacoes}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#5D8A6E' }}>{fmtBRL(f.totalComissao)}</div>
                    <div style={{ fontSize: 11, color: '#8A8A9B' }}>
                      {new Date(f.fechadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: REGRA ─────────────────────────────────────────────── */}
      {showRegraModal && (
        <ModalOverlay onClose={() => setShowRegraModal(false)}>
          <div style={{ padding: 24, minWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {editingRegra ? 'Editar Regra' : 'Nova Regra de Comissão'}
              </h3>
              <button onClick={() => setShowRegraModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#6B6B7E" />
              </button>
            </div>

            <FieldGroup label="Profissional (opcional — deixe em branco para todos)">
              <select value={rProfId} onChange={e => setRProfId(e.target.value)} style={selectStyle}>
                <option value="">Todos os profissionais</option>
                {equipe.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </FieldGroup>

            <FieldGroup label="Procedimento (opcional — deixe em branco para todos)">
              <select value={rProcId} onChange={e => setRProcId(e.target.value)} style={selectStyle}>
                <option value="">Todos os procedimentos</option>
                {procedimentos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </FieldGroup>

            {!rProfId && !rProcId && (
              <div style={{ background: '#FFFBEB', border: '1px solid #F7C948', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#744210' }}>
                Selecione ao menos um profissional ou procedimento.
              </div>
            )}

            <FieldGroup label="Tipo de comissão">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['percentual', 'fixo'] as ComissaoTipo[]).map(t => (
                  <button key={t} onClick={() => setRTipo(t)} style={{
                    flex: 1, padding: '8px 0', border: `1px solid ${rTipo === t ? '#D98E73' : '#DDD8D0'}`,
                    borderRadius: 6, cursor: 'pointer', fontWeight: rTipo === t ? 700 : 400,
                    background: rTipo === t ? '#FFF4EF' : '#FFF', color: rTipo === t ? '#D98E73' : '#6B6B7E', fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {t === 'percentual' ? <><Percent size={13} /> Percentual</> : <><DollarSign size={13} /> Valor Fixo</>}
                  </button>
                ))}
              </div>
            </FieldGroup>

            <FieldGroup label={rTipo === 'percentual' ? 'Percentual (%)' : 'Valor fixo (R$)'}>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="0"
                  step={rTipo === 'percentual' ? '1' : '0.01'}
                  max={rTipo === 'percentual' ? '100' : undefined}
                  value={rValor}
                  onChange={e => setRValor(e.target.value)}
                  placeholder={rTipo === 'percentual' ? 'Ex: 35' : 'Ex: 50.00'}
                  style={{ ...inputStyle, paddingLeft: rTipo === 'percentual' ? 12 : 28 }}
                />
                {rTipo !== 'percentual' && (
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8A8A9B', fontSize: 13 }}>R$</span>
                )}
              </div>
            </FieldGroup>

            <FieldGroup label="">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={rAtivo} onChange={e => setRAtivo(e.target.checked)} style={{ width: 16, height: 16 }} />
                Regra ativa
              </label>
            </FieldGroup>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setShowRegraModal(false)} style={{ flex: 1, padding: '10px 0', background: '#F5F3F0', border: '1px solid #DDD8D0', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                Cancelar
              </button>
              <button
                onClick={handleSaveRegra}
                disabled={rSaving || (!rProfId && !rProcId) || !rValor}
                style={{ flex: 1, padding: '10px 0', background: '#D98E73', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#FFF', opacity: rSaving ? 0.7 : 1 }}
              >
                {rSaving ? 'Salvando...' : <><Check size={14} style={{ marginRight: 6 }} />{editingRegra ? 'Salvar' : 'Criar Regra'}</>}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── MODAL: FECHAR PERÍODO ─────────────────────────────────────── */}
      {showFechamentoModal && (
        <ModalOverlay onClose={() => setShowFechamentoModal(false)}>
          <div style={{ padding: 24, minWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Fechar Período de Comissões</h3>
              <button onClick={() => setShowFechamentoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#6B6B7E" />
              </button>
            </div>

            <div style={{ background: '#F0EDE8', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#4A4A5E' }}>
              <strong>Período:</strong> {fmtDate(rangeStart)} → {fmtDate(rangeEnd)}
            </div>

            <FieldGroup label="Profissional (fechar para todos ou individual)">
              <select value={fProfId} onChange={e => setFProfId(e.target.value)} style={selectStyle}>
                <option value="">Todos os profissionais</option>
                {equipe.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </FieldGroup>

            <FieldGroup label="Observações (opcional)">
              <textarea
                value={fObs}
                onChange={e => setFObs(e.target.value)}
                placeholder="Ex: Pagamento via transferência em 30/05"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </FieldGroup>

            <div style={{ background: '#FFF4EF', border: '1px solid #F5C5B8', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#7C3D22' }}>
              <Lock size={12} style={{ marginRight: 6 }} />
              Após o fechamento, os registros do período ficam imutáveis.
            </div>

            {/* Prévia dos totais */}
            {relatorio.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {relatorio
                  .filter(g => !fProfId || g.profissionalId === fProfId)
                  .map(g => (
                    <div key={g.profissionalNome} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0EDE8', fontSize: 13 }}>
                      <span>{g.profissionalNome}</span>
                      <span style={{ fontWeight: 700, color: '#D98E73' }}>{fmtBRL(g.totalComissao)}</span>
                    </div>
                  ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowFechamentoModal(false)} style={{ flex: 1, padding: '10px 0', background: '#F5F3F0', border: '1px solid #DDD8D0', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                Cancelar
              </button>
              <button
                onClick={handleFecharPeriodo}
                disabled={fSaving}
                style={{ flex: 1, padding: '10px 0', background: '#1A1A2E', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#FFF', opacity: fSaving ? 0.7 : 1 }}
              >
                {fSaving ? 'Fechando...' : <><Lock size={14} style={{ marginRight: 6 }} />Confirmar Fechamento</>}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};

// ─── Sub-componente: grupo por profissional ───────────────────────────────────

const GrupoComissao: React.FC<{ grupo: RelatorioComissaoProfissional }> = ({ grupo }) => {
  const [expanded, setExpanded] = useState(false);
  const percentMedio = grupo.totalBase > 0
    ? Math.round((grupo.totalComissao / grupo.totalBase) * 100 * 10) / 10
    : 0;

  return (
    <div style={{ border: '1px solid #EDE8E1', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header do grupo */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', background: '#FAFAF8', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#D98E73', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={16} color="#FFF" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E' }}>{grupo.profissionalNome}</div>
          <div style={{ fontSize: 12, color: '#8A8A9B', marginTop: 2 }}>
            {grupo.totalAtendimentos} atendimento{grupo.totalAtendimentos !== 1 ? 's' : ''}
            {' · '}{percentMedio}% médio
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#D98E73' }}>{fmtBRL(grupo.totalComissao)}</div>
          <div style={{ fontSize: 11, color: '#8A8A9B' }}>de {fmtBRL(grupo.totalBase)}</div>
        </div>
        <ChevronDown size={16} color="#8A8A9B" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {/* Tabela de itens */}
      {expanded && (
        <div style={{ borderTop: '1px solid #F0EDE8', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F5F3F0' }}>
                {['Data', 'Procedimento', 'Base', 'Regra', 'Comissão', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#6B6B7E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupo.itens.map(item => (
                <tr key={item.id} style={{ borderTop: '1px solid #F0EDE8' }}>
                  <td style={{ padding: '10px 14px', color: '#4A4A5E' }}>{fmtDate(item.dataAtendimento)}</td>
                  <td style={{ padding: '10px 14px', color: '#1A1A2E', fontWeight: 500 }}>{item.procedimentoNome}</td>
                  <td style={{ padding: '10px 14px', color: '#4A4A5E' }}>{fmtBRL(item.valorBase)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {item.semRegra ? (
                      <span style={{ padding: '2px 8px', background: '#FFF1EE', color: '#C0392B', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Sem regra</span>
                    ) : item.tipo === 'percentual' ? (
                      <span style={{ color: '#6B6B7E' }}>{item.percentualAplicado}%</span>
                    ) : (
                      <span style={{ color: '#6B6B7E' }}>Fixo</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#D98E73' }}>{fmtBRL(item.valorComissao)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {item.fechamentoId ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5D8A6E', fontWeight: 600 }}>
                        <Lock size={11} />Fechado
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#8A8A9B' }}>Aberto</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Helpers de estilo ────────────────────────────────────────────────────────

const ModalOverlay: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <div
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <div style={{ background: '#FFF', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', maxWidth: '95vw' }}>
      {children}
    </div>
  </div>
);

const FieldGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 12, color: '#6B6B7E', marginBottom: 6, fontWeight: 500 }}>{label}</div>}
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #DDD8D0', fontSize: 13, color: '#1A1A2E',
  boxSizing: 'border-box', background: '#FFF',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'auto',
};
