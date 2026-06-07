import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  UserX,
  X,
  Clock,
  TrendingDown,
  Users,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  Cliente,
  ContaReceber,
  CrcAcaoContexto,
  CrcFalta,
  CrcSemReagendamento,
  MembroEquipe,
  TemplateMensagem,
} from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function openWhatsApp(telefone: string, mensagem: string) {
  const num = telefone.replace(/\D/g, '');
  const phone = num.startsWith('55') ? num : `55${num}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`, '_blank');
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

// ── Tipos locais ─────────────────────────────────────────────────────────

type TabId = 'faltas' | 'inadimplentes' | 'sem_retorno';

interface ContaForm {
  clienteId: string;
  clienteNome: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  observacoes: string;
}

const EMPTY_CONTA: ContaForm = {
  clienteId:       '',
  clienteNome:     '',
  descricao:       '',
  valor:           0,
  dataVencimento:  todayISO(),
  observacoes:     '',
};

const PERIODO_OPTIONS = [
  { label: 'Últimos 7 dias',  value: 7 },
  { label: 'Últimos 15 dias', value: 15 },
  { label: 'Últimos 30 dias', value: 30 },
];

const SEM_RETORNO_OPCOES = [
  { label: '30+ dias sem visita',  value: 30 },
  { label: '60+ dias sem visita',  value: 60 },
  { label: '90+ dias sem visita',  value: 90 },
  { label: '120+ dias sem visita', value: 120 },
];

// ── Componente ────────────────────────────────────────────────────────────

interface CRCCentralProps {
  userId: string;
  userName: string;
  onAgendar?: () => void;
  permissoes?: import('../types').Permissoes | null;
}

export const CRCCentral: React.FC<CRCCentralProps> = ({ userId, userName, onAgendar, permissoes }) => {
  const pode = (acao: 'ver' | 'criar' | 'editar' | 'deletar') =>
    !permissoes || !!(permissoes['crc']?.[acao]);
  const [tab, setTab] = useState<TabId>('faltas');

  // Dados
  const [faltas, setFaltas]           = useState<CrcFalta[]>([]);
  const [inadimplentes, setInadimpl]  = useState<ContaReceber[]>([]);
  const [semRetorno, setSemRetorno]   = useState<CrcSemReagendamento[]>([]);
  const [clientes, setClientes]       = useState<Cliente[]>([]);
  const [equipe, setEquipe]           = useState<MembroEquipe[]>([]);
  const [templates, setTemplates]     = useState<TemplateMensagem[]>([]);

  // Filtros
  const [periodoFaltas, setPeriodoFaltas]     = useState(15);
  const [profFiltro, setProfFiltro]           = useState('');
  const [buscaFaltas, setBuscaFaltas]         = useState('');
  const [periodoSemRetorno, setPeriodoSemRetorno] = useState(60);
  const [buscaSemRetorno, setBuscaSemRetorno] = useState('');
  const [buscaInadimpl, setBuscaInadimpl]     = useState('');

  // Loading / saving
  const [loadingFaltas, setLoadingFaltas]         = useState(true);
  const [loadingInadimpl, setLoadingInadimpl]     = useState(true);
  const [loadingSemRetorno, setLoadingSemRetorno] = useState(true);
  const [saving, setSaving]                       = useState(false);

  // Seleção múltipla
  const [selectedFaltas, setSelectedFaltas]       = useState<Set<string>>(new Set());
  const [selectedInadimpl, setSelectedInadimpl]   = useState<Set<string>>(new Set());
  const [selectedSemRet, setSelectedSemRet]       = useState<Set<string>>(new Set());

  // Modal de mensagem
  const [showMsgModal, setShowMsgModal]           = useState(false);
  const [msgRecipients, setMsgRecipients]         = useState<{ clienteId: string; nome: string; telefone: string }[]>([]);
  const [msgContexto, setMsgContexto]             = useState<CrcAcaoContexto>('falta');
  const [templateId, setTemplateId]               = useState('');
  const [msgText, setMsgText]                     = useState('');
  const [msgVars, setMsgVars]                     = useState<Record<string, string>>({});

  // Modal de nova conta a receber
  const [showContaModal, setShowContaModal]       = useState(false);
  const [contaForm, setContaForm]                 = useState<ContaForm>(EMPTY_CONTA);
  const [clienteBusca, setClienteBusca]           = useState('');
  const [clienteSugestoes, setClienteSugestoes]   = useState<Cliente[]>([]);

  // ── Carga ────────────────────────────────────────────────────────────

  const loadFaltas = useCallback(async () => {
    setLoadingFaltas(true);
    try {
      const data = await api.getFaltasRecentes(userId, periodoFaltas);
      setFaltas(data);
    } catch (e) { console.error(e); }
    finally { setLoadingFaltas(false); }
  }, [userId, periodoFaltas]);

  const loadInadimpl = useCallback(async () => {
    setLoadingInadimpl(true);
    try {
      const data = await api.getInadimplentes(userId);
      setInadimpl(data);
    } catch (e) { console.error(e); }
    finally { setLoadingInadimpl(false); }
  }, [userId]);

  const loadSemRetorno = useCallback(async () => {
    setLoadingSemRetorno(true);
    try {
      const data = await api.getPacientesSemReagendamento(userId, periodoSemRetorno);
      setSemRetorno(data);
    } catch (e) { console.error(e); }
    finally { setLoadingSemRetorno(false); }
  }, [userId, periodoSemRetorno]);

  useEffect(() => {
    api.getClientes(userId).then(setClientes).catch(console.error);
    api.getEquipe(userId).then(setEquipe).catch(console.error);
    api.getTemplatesMensagens(userId).then(setTemplates).catch(console.error);
  }, [userId]);

  useEffect(() => { if (tab === 'faltas')        loadFaltas();     }, [tab, loadFaltas]);
  useEffect(() => { if (tab === 'inadimplentes') loadInadimpl();   }, [tab, loadInadimpl]);
  useEffect(() => { if (tab === 'sem_retorno')   loadSemRetorno(); }, [tab, loadSemRetorno]);

  // ── Sugestões de clientes ────────────────────────────────────────────

  useEffect(() => {
    if (!clienteBusca.trim()) { setClienteSugestoes([]); return; }
    const q = clienteBusca.toLowerCase();
    setClienteSugestoes(clientes.filter((c) => c.nome.toLowerCase().includes(q)).slice(0, 6));
  }, [clienteBusca, clientes]);

  // ── Filtros aplicados ────────────────────────────────────────────────

  const faltasFiltradas = faltas.filter((f) => {
    const matchProf  = !profFiltro || f.profissional === profFiltro;
    const matchBusca = !buscaFaltas || f.clienteNome.toLowerCase().includes(buscaFaltas.toLowerCase());
    return matchProf && matchBusca;
  });

  const inadimplFiltrados = inadimplentes.filter((c) =>
    !buscaInadimpl || c.clienteNome.toLowerCase().includes(buscaInadimpl.toLowerCase())
  );

  const semRetornoFiltrados = semRetorno.filter((s) =>
    !buscaSemRetorno || s.clienteNome.toLowerCase().includes(buscaSemRetorno.toLowerCase())
  );

  // ── Helpers de seleção ───────────────────────────────────────────────

  function toggleFalta(id: string) {
    setSelectedFaltas((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleInadimpl(id: string) {
    setSelectedInadimpl((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleSemRet(id: string) {
    setSelectedSemRet((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  // ── Abrir modal de mensagem ──────────────────────────────────────────

  function openMsgModal(
    recipients: { clienteId: string; nome: string; telefone: string }[],
    contexto: CrcAcaoContexto,
    extraVars?: Record<string, string>
  ) {
    setMsgRecipients(recipients);
    setMsgContexto(contexto);
    setMsgVars(extraVars ?? {});
    const firstTemplate = templates[0];
    if (firstTemplate) {
      setTemplateId(firstTemplate.id);
      const vars = { nome: recipients[0]?.nome ?? '', clinica: userName, ...(extraVars ?? {}) };
      setMsgText(interpolate(firstTemplate.texto, vars));
    } else {
      setTemplateId('');
      setMsgText('');
    }
    setShowMsgModal(true);
  }

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const t = templates.find((t) => t.id === id);
    if (t && msgRecipients.length === 1) {
      const vars = { nome: msgRecipients[0].nome, clinica: userName, ...msgVars };
      setMsgText(interpolate(t.texto, vars));
    } else if (t) {
      setMsgText(t.texto);
    }
  }

  async function handleEnviarMensagem() {
    if (!msgText.trim()) { alert('Digite uma mensagem.'); return; }
    setSaving(true);
    try {
      for (const rec of msgRecipients) {
        if (!rec.telefone) continue;
        const personalizado = interpolate(msgText, { nome: rec.nome, clinica: userName, ...msgVars });
        openWhatsApp(rec.telefone, personalizado);
        await api.registrarCrcAcao(
          { clienteId: rec.clienteId, tipo: 'mensagem_whatsapp', contexto: msgContexto, observacao: personalizado.slice(0, 200), usuarioNome: userName },
          userId
        );
      }
      setShowMsgModal(false);
      setSelectedFaltas(new Set());
      setSelectedInadimpl(new Set());
      setSelectedSemRet(new Set());
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao registrar ação.');
    } finally {
      setSaving(false);
    }
  }

  // ── Ações individuais ────────────────────────────────────────────────

  async function handleMarcarPago(conta: ContaReceber) {
    setSaving(true);
    try {
      await api.marcarContaPaga(conta.id, todayISO(), userId);
      await api.registrarCrcAcao(
        { clienteId: conta.clienteId, tipo: 'cobranca', contexto: 'inadimplente', observacao: `Pagamento registrado: ${formatCurrency(conta.valor)}`, usuarioNome: userName },
        userId
      );
      await loadInadimpl();
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao marcar como pago.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConta(id: string) {
    if (!confirm('Excluir esta conta?')) return;
    try {
      await api.deleteContaReceber(id, userId);
      await loadInadimpl();
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao excluir conta.');
    }
  }

  async function handleNaoRetorna(s: CrcSemReagendamento) {
    if (!confirm(`Marcar ${s.clienteNome} como "Não retorna mais"? Ele sairá desta lista permanentemente.`)) return;
    try {
      await api.marcarClienteNaoRetorna(s.clienteId, true, userId);
      await api.registrarCrcAcao(
        { clienteId: s.clienteId, tipo: 'nao_retorna', contexto: 'sem_reagendamento', usuarioNome: userName },
        userId
      );
      await loadSemRetorno();
    } catch (e: any) {
      alert(e?.message ?? 'Erro.');
    }
  }

  async function handleSaveConta() {
    if (!contaForm.clienteId) { alert('Selecione um cliente.'); return; }
    if (!contaForm.descricao.trim()) { alert('Informe a descrição.'); return; }
    if (contaForm.valor <= 0) { alert('Informe um valor válido.'); return; }
    setSaving(true);
    try {
      await api.createContaReceber(
        { clienteId: contaForm.clienteId, descricao: contaForm.descricao, valor: contaForm.valor, dataVencimento: contaForm.dataVencimento, observacoes: contaForm.observacoes || null },
        userId
      );
      setShowContaModal(false);
      setContaForm(EMPTY_CONTA);
      setClienteBusca('');
      await loadInadimpl();
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao salvar conta.');
    } finally {
      setSaving(false);
    }
  }

  // ── Ação em lote ────────────────────────────────────────────────────

  function handleBulkFaltas() {
    const recipients = faltasFiltradas
      .filter((f) => selectedFaltas.has(f.agendamentoId))
      .map((f) => ({ clienteId: f.clienteId, nome: f.clienteNome, telefone: f.telefone }));
    if (!recipients.length) return;
    openMsgModal(recipients, 'falta');
  }

  function handleBulkInadimpl() {
    const recipients = inadimplFiltrados
      .filter((c) => selectedInadimpl.has(c.id))
      .map((c) => ({ clienteId: c.clienteId, nome: c.clienteNome, telefone: c.telefone }));
    if (!recipients.length) return;
    openMsgModal(recipients, 'inadimplente');
  }

  function handleBulkSemRetorno() {
    const recipients = semRetornoFiltrados
      .filter((s) => selectedSemRet.has(s.clienteId))
      .map((s) => ({ clienteId: s.clienteId, nome: s.clienteNome, telefone: s.telefone }));
    if (!recipients.length) return;
    openMsgModal(recipients, 'sem_reagendamento');
  }

  // ── Estatísticas header ──────────────────────────────────────────────

  const statsFaltas      = faltas.length;
  const statsInadimpl    = inadimplentes.length;
  const statsSemRetorno  = semRetorno.length;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-main)' }}>Central de Relacionamento</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Faltas, inadimplentes e pacientes sem retorno — em um único lugar.
        </p>
      </div>

      {/* Chips de resumo */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryChip icon={<AlertTriangle size={14} />} label="Faltas recentes" value={statsFaltas} color="#C2410C" bg="#FFF7ED" border="#FED7AA" onClick={() => setTab('faltas')} />
        <SummaryChip icon={<TrendingDown size={14} />} label="Inadimplentes"   value={statsInadimpl} color="#B91C1C" bg="#FEF2F2" border="#FECACA" onClick={() => setTab('inadimplentes')} />
        <SummaryChip icon={<Clock size={14} />}         label="Sem retorno"      value={statsSemRetorno} color="#1D4ED8" bg="#EFF6FF" border="#BFDBFE" onClick={() => setTab('sem_retorno')} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 24 }}>
        {([
          { id: 'faltas',         label: 'Faltas Recentes',    count: statsFaltas },
          { id: 'inadimplentes',  label: 'Inadimplentes',      count: statsInadimpl },
          { id: 'sem_retorno',    label: 'Sem Reagendamento',  count: statsSemRetorno },
        ] as { id: TabId; label: string; count: number }[]).map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer', background: 'transparent',
              fontSize: 14, fontWeight: tab === id ? 600 : 400,
              color: tab === id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: tab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {label}
            {count > 0 && (
              <span style={{
                background: tab === id ? 'var(--color-primary)' : '#e5e7eb',
                color: tab === id ? '#fff' : '#6b7280',
                borderRadius: '100px', padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: FALTAS ── */}
      {tab === 'faltas' && (
        <div>
          <FilterBar>
            <select
              value={periodoFaltas}
              onChange={(e) => setPeriodoFaltas(Number(e.target.value))}
              style={selectStyle}
            >
              {PERIODO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={profFiltro}
              onChange={(e) => setProfFiltro(e.target.value)}
              style={selectStyle}
            >
              <option value="">Todos os profissionais</option>
              {equipe.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
            <SearchInput value={buscaFaltas} onChange={setBuscaFaltas} placeholder="Buscar cliente..." />
            <button onClick={loadFaltas} style={refreshBtn}><RefreshCw size={14} /></button>
          </FilterBar>

          {selectedFaltas.size > 0 && (
            <BulkBar count={selectedFaltas.size} onSend={handleBulkFaltas} onClear={() => setSelectedFaltas(new Set())} />
          )}

          {loadingFaltas ? (
            <EmptyState icon={<AlertTriangle size={32} />} text="Carregando faltas..." />
          ) : faltasFiltradas.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={32} />} text={`Nenhuma falta nos últimos ${periodoFaltas} dias.`} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {faltasFiltradas.map((f) => (
                <CRCCard
                  key={f.agendamentoId}
                  selected={selectedFaltas.has(f.agendamentoId)}
                  onToggleSelect={() => toggleFalta(f.agendamentoId)}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-main)' }}>{f.clienteNome}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {f.procedimento} · {f.profissional}
                      {f.faltaMotivo && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>({f.faltaMotivo})</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', minWidth: 90, textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#C2410C' }}>{formatDate(f.data)}</div>
                    <div style={{ fontSize: 11 }}>{f.telefone || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {f.telefone && (
                      <>
                        <ActionBtn title="WhatsApp" color="#15803D" onClick={() => openMsgModal([{ clienteId: f.clienteId, nome: f.clienteNome, telefone: f.telefone }], 'falta', { procedimento: f.procedimento, data: formatDate(f.data) })}>
                          <MessageCircle size={15} />
                        </ActionBtn>
                        <ActionBtn title="Ligar" onClick={async () => {
                          window.open(`tel:${f.telefone}`);
                          await api.registrarCrcAcao({ clienteId: f.clienteId, tipo: 'ligacao', contexto: 'falta', usuarioNome: userName }, userId).catch(() => {});
                        }}>
                          <Phone size={15} />
                        </ActionBtn>
                      </>
                    )}
                    {onAgendar && (
                      <ActionBtn title="Reagendar" color="#1D4ED8" onClick={async () => {
                        await api.registrarCrcAcao({ clienteId: f.clienteId, tipo: 'reagendamento', contexto: 'falta', usuarioNome: userName }, userId).catch(() => {});
                        onAgendar();
                      }}>
                        <CalendarRange size={15} />
                      </ActionBtn>
                    )}
                  </div>
                </CRCCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: INADIMPLENTES ── */}
      {tab === 'inadimplentes' && (
        <div>
          <FilterBar>
            <SearchInput value={buscaInadimpl} onChange={setBuscaInadimpl} placeholder="Buscar cliente..." />
            <button onClick={loadInadimpl} style={refreshBtn}><RefreshCw size={14} /></button>
            {pode('criar') && (
              <button
                onClick={() => { setContaForm(EMPTY_CONTA); setClienteBusca(''); setShowContaModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--border-radius-md)', padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={14} /> Registrar conta
              </button>
            )}
          </FilterBar>

          {selectedInadimpl.size > 0 && (
            <BulkBar count={selectedInadimpl.size} onSend={handleBulkInadimpl} onClear={() => setSelectedInadimpl(new Set())} label="Cobrar" />
          )}

          {loadingInadimpl ? (
            <EmptyState icon={<TrendingDown size={32} />} text="Carregando inadimplentes..." />
          ) : inadimplFiltrados.length === 0 ? (
            <EmptyState icon={<TrendingDown size={32} />} text="Nenhum inadimplente encontrado." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {inadimplFiltrados.map((c) => (
                <CRCCard
                  key={c.id}
                  selected={selectedInadimpl.has(c.id)}
                  onToggleSelect={() => toggleInadimpl(c.id)}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-main)' }}>{c.clienteNome}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{c.descricao}</div>
                  </div>
                  <div style={{ minWidth: 100, textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#B91C1C' }}>{formatCurrency(c.valor)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Venceu {formatDate(c.dataVencimento)}</div>
                    {c.diasAtraso > 0 && (
                      <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600 }}>{c.diasAtraso}d em atraso</div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 80 }}>{c.telefone || '—'}</div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {c.telefone && (
                      <ActionBtn title="Lembrete WhatsApp" color="#15803D" onClick={() => openMsgModal([{ clienteId: c.clienteId, nome: c.clienteNome, telefone: c.telefone }], 'inadimplente', { valor: formatCurrency(c.valor), vencimento: formatDate(c.dataVencimento) })}>
                        <MessageCircle size={15} />
                      </ActionBtn>
                    )}
                    {pode('editar') && (
                      <ActionBtn title="Marcar como pago" color="#15803D" onClick={() => handleMarcarPago(c)}>
                        <CheckCircle2 size={15} />
                      </ActionBtn>
                    )}
                    {pode('deletar') && (
                      <ActionBtn title="Excluir" color="#B91C1C" onClick={() => handleDeleteConta(c.id)}>
                        <Trash2 size={15} />
                      </ActionBtn>
                    )}
                  </div>
                </CRCCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: SEM REAGENDAMENTO ── */}
      {tab === 'sem_retorno' && (
        <div>
          <FilterBar>
            <select
              value={periodoSemRetorno}
              onChange={(e) => setPeriodoSemRetorno(Number(e.target.value))}
              style={selectStyle}
            >
              {SEM_RETORNO_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <SearchInput value={buscaSemRetorno} onChange={setBuscaSemRetorno} placeholder="Buscar cliente..." />
            <button onClick={loadSemRetorno} style={refreshBtn}><RefreshCw size={14} /></button>
          </FilterBar>

          {selectedSemRet.size > 0 && (
            <BulkBar count={selectedSemRet.size} onSend={handleBulkSemRetorno} onClear={() => setSelectedSemRet(new Set())} label="Contatar" />
          )}

          {loadingSemRetorno ? (
            <EmptyState icon={<Users size={32} />} text="Carregando pacientes..." />
          ) : semRetornoFiltrados.length === 0 ? (
            <EmptyState icon={<Users size={32} />} text={`Nenhum paciente sem retorno há ${periodoSemRetorno}+ dias.`} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {semRetornoFiltrados.map((s) => (
                <CRCCard
                  key={s.clienteId}
                  selected={selectedSemRet.has(s.clienteId)}
                  onToggleSelect={() => toggleSemRet(s.clienteId)}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-main)' }}>{s.clienteNome}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {s.ultimoProcedimento || 'Procedimento desconhecido'}
                      {s.profissional && ` · ${s.profissional}`}
                    </div>
                  </div>
                  <div style={{ minWidth: 110, textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#1D4ED8', fontSize: 15 }}>{s.diasSemVisita}d sem visita</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Última: {formatDate(s.dataUltimaVisita)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.telefone || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {s.telefone && (
                      <>
                        <ActionBtn title="WhatsApp" color="#15803D" onClick={() => openMsgModal([{ clienteId: s.clienteId, nome: s.clienteNome, telefone: s.telefone }], 'sem_reagendamento', { procedimento: s.ultimoProcedimento })}>
                          <MessageCircle size={15} />
                        </ActionBtn>
                        <ActionBtn title="Ligar" onClick={async () => {
                          window.open(`tel:${s.telefone}`);
                          await api.registrarCrcAcao({ clienteId: s.clienteId, tipo: 'ligacao', contexto: 'sem_reagendamento', usuarioNome: userName }, userId).catch(() => {});
                        }}>
                          <Phone size={15} />
                        </ActionBtn>
                      </>
                    )}
                    {onAgendar && (
                      <ActionBtn title="Reagendar" color="#1D4ED8" onClick={async () => {
                        await api.registrarCrcAcao({ clienteId: s.clienteId, tipo: 'reagendamento', contexto: 'sem_reagendamento', usuarioNome: userName }, userId).catch(() => {});
                        onAgendar();
                      }}>
                        <CalendarRange size={15} />
                      </ActionBtn>
                    )}
                    {pode('editar') && (
                      <ActionBtn title="Não retorna mais" color="#6B7280" onClick={() => handleNaoRetorna(s)}>
                        <UserX size={15} />
                      </ActionBtn>
                    )}
                  </div>
                </CRCCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: MENSAGEM ── */}
      {showMsgModal && (
        <Modal
          title={msgRecipients.length === 1 ? `Mensagem para ${msgRecipients[0].nome}` : `Mensagem em lote (${msgRecipients.length} pacientes)`}
          onClose={() => setShowMsgModal(false)}
          width={520}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {templates.length > 0 && (
              <div>
                <Label>Template</Label>
                <select value={templateId} onChange={(e) => handleTemplateChange(e.target.value)} style={inputStyle}>
                  <option value="">Selecionar template...</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                </select>
              </div>
            )}
            <div>
              <Label>Mensagem</Label>
              <textarea
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                rows={5}
                placeholder="Digite a mensagem..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              {msgRecipients.length > 1 && (
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                  A mensagem será personalizada com o nome de cada paciente se usar {'{{nome}}'}.
                </p>
              )}
            </div>

            {msgRecipients.length > 0 && !msgRecipients[0].telefone && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C' }}>
                Atenção: alguns pacientes não têm telefone cadastrado e não receberão a mensagem.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button onClick={() => setShowMsgModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={handleEnviarMensagem} disabled={saving} style={btnPrimary}>
                {saving ? 'Abrindo...' : `Abrir WhatsApp${msgRecipients.length > 1 ? ` (${msgRecipients.length})` : ''}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: NOVA CONTA ── */}
      {showContaModal && (
        <Modal title="Registrar Conta a Receber" onClose={() => setShowContaModal(false)} width={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <Label>Cliente *</Label>
              <input
                value={clienteBusca || contaForm.clienteNome}
                onChange={(e) => {
                  setClienteBusca(e.target.value);
                  setContaForm((f) => ({ ...f, clienteNome: e.target.value, clienteId: '' }));
                }}
                placeholder="Buscar cliente..."
                style={inputStyle}
              />
              {clienteSugestoes.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                  {clienteSugestoes.map((c) => (
                    <button key={c.id} onClick={() => { setContaForm((f) => ({ ...f, clienteId: c.id, clienteNome: c.nome })); setClienteBusca(''); setClienteSugestoes([]); }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}>
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Descrição *</Label>
              <input value={contaForm.descricao} onChange={(e) => setContaForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Botox sessão 2" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Valor (R$) *</Label>
                <input type="number" min={0} step={0.01} value={contaForm.valor || ''} onChange={(e) => setContaForm((f) => ({ ...f, valor: Number(e.target.value) }))} placeholder="0,00" style={inputStyle} />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <input type="date" value={contaForm.dataVencimento} onChange={(e) => setContaForm((f) => ({ ...f, dataVencimento: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <input value={contaForm.observacoes} onChange={(e) => setContaForm((f) => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional..." style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button onClick={() => setShowContaModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={handleSaveConta} disabled={saving} style={btnPrimary}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Sub-componentes ────────────────────────────────────────────────────────

function SummaryChip({ icon, label, value, color, bg, border, onClick }: {
  icon: React.ReactNode; label: string; value: number;
  color: string; bg: string; border: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        background: bg, border: `1px solid ${border}`, borderRadius: 'var(--border-radius-md)',
        cursor: 'pointer', color,
      }}
    >
      {icon}
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      </div>
    </button>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
      {children}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 160, maxWidth: 280 }}>
      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: 30, width: '100%', boxSizing: 'border-box' }} />
    </div>
  );
}

function BulkBar({ count, onSend, onClear, label = 'Enviar mensagem' }: {
  count: number; onSend: () => void; onClear: () => void; label?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 12,
      background: 'var(--color-primary-light)', border: '1px solid var(--color-border-hover)',
      borderRadius: 'var(--border-radius-md)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{count} selecionado{count > 1 ? 's' : ''}</span>
      <button onClick={onSend} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--border-radius-sm)', padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <MessageCircle size={14} /> {label} ({count})
      </button>
      <button onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}>
        <X size={14} />
      </button>
    </div>
  );
}

function CRCCard({ children, selected, onToggleSelect }: {
  children: React.ReactNode; selected: boolean; onToggleSelect: () => void;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 'var(--border-radius-md)', padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      transition: 'var(--transition-smooth)',
    }}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect}
        style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', flexShrink: 0, cursor: 'pointer' }} />
      {children}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
      <div style={{ opacity: 0.3, marginBottom: 12 }}>{icon}</div>
      {text}
    </div>
  );
}

function ActionBtn({ children, title, color, onClick }: {
  children: React.ReactNode; title?: string; color?: string; onClick: () => void;
}) {
  return (
    <button title={title} onClick={onClick} style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: '1px solid var(--color-border)',
      borderRadius: 'var(--border-radius-sm)', cursor: 'pointer', color: color ?? 'var(--color-text-muted)',
      transition: 'var(--transition-smooth)',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, width = 500 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-inner" style={{ background: 'var(--bg-card)', borderRadius: 'var(--border-radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,.15)', width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 4 }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)', fontSize: 14, background: 'var(--bg-card)',
  color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, width: 'auto', minWidth: 140,
};

const refreshBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 34, height: 34, background: 'transparent', border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-muted)',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--color-primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--border-radius-md)', padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: 'var(--color-text-main)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)', padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
};
