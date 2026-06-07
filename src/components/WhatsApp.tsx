import React, { useCallback, useEffect, useState } from 'react';
import {
  MessageCircle,
  Send,
  Settings2,
  History,
  Users,
  Trash2,
  Search,
  CheckCircle2,
  X,
  Clock,
  CheckCheck,
  Zap,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  Cliente,
  TemplateMensagem,
  WhatsAppBatchResult,
  WhatsAppConfig,
  WhatsAppMensagem,
  WhatsAppOptOut,
} from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusIcon(s: WhatsAppMensagem['status']) {
  switch (s) {
    case 'enviando':  return <Clock size={13} style={{ color: '#9CA3AF' }} />;
    case 'enviado':   return <CheckCircle2 size={13} style={{ color: '#6B7280' }} />;
    case 'entregue':  return <CheckCheck size={13} style={{ color: '#2563EB' }} />;
    case 'lido':      return <CheckCheck size={13} style={{ color: '#16A34A' }} />;
    case 'falha':     return <X size={13} style={{ color: '#DC2626' }} />;
    case 'agendado':  return <Clock size={13} style={{ color: '#D97706' }} />;
    case 'cancelado': return <Ban size={13} style={{ color: '#9CA3AF' }} />;
    default: return null;
  }
}

const STATUS_LABELS: Record<string, string> = {
  enviando: 'Enviando...', enviado: 'Enviado', entregue: 'Entregue',
  lido: 'Lido', falha: 'Falha', agendado: 'Agendado', cancelado: 'Cancelado',
};

type TabId = 'enviar' | 'historico' | 'disparos' | 'configuracao';

const BATCH_LIMIT = 50;

// ── Componente ────────────────────────────────────────────────────────────

interface WhatsAppProps {
  userId: string;
  userName: string;
  permissoes?: import('../types').Permissoes | null;
}

export const WhatsApp: React.FC<WhatsAppProps> = ({ userId, userName, permissoes }) => {
  const pode = (acao: 'ver' | 'criar') =>
    !permissoes || !!(permissoes['whatsapp']?.[acao]);
  const [tab, setTab]                               = useState<TabId>('enviar');
  const [config, setConfig]                         = useState<WhatsAppConfig | null>(null);
  const [mensagens, setMensagens]                   = useState<WhatsAppMensagem[]>([]);
  const [optOuts, setOptOuts]                       = useState<WhatsAppOptOut[]>([]);
  const [clientes, setClientes]                     = useState<Cliente[]>([]);
  const [templates, setTemplates]                   = useState<TemplateMensagem[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [saving, setSaving]                         = useState(false);

  // Aba Enviar
  const [_selectedClienteId, setSelectedClienteId]  = useState('');
  const [selectedCliente, setSelectedCliente]       = useState<Cliente | null>(null);
  const [clienteBusca, setClienteBusca]             = useState('');
  const [clienteSugestoes, setClienteSugestoes]     = useState<Cliente[]>([]);
  const [templateId, setTemplateId]                 = useState('');
  const [msgText, setMsgText]                       = useState('');
  const [lastSendResult, setLastSendResult]         = useState<string | null>(null);

  // Aba Histórico
  const [buscaHistorico, setBuscaHistorico]         = useState('');

  // Aba Disparos
  const [batchTemplateId, setBatchTemplateId]       = useState('');
  const [batchMsgText, setBatchMsgText]             = useState('');
  const [batchClientes, setBatchClientes]           = useState<Cliente[]>([]);
  const [batchBusca, setBatchBusca]                 = useState('');
  const [batchSelecionados, setBatchSelecionados]   = useState<Set<string>>(new Set());
  const [batchResult, setBatchResult]               = useState<WhatsAppBatchResult | null>(null);
  const [batchRunning, setBatchRunning]             = useState(false);

  // Aba Config
  const [configForm, setConfigForm]                 = useState<WhatsAppConfig>({
    id: null, provider: 'zapi', zapiInstance: '', zapiToken: '',
    zapiClientToken: '', numeroOficial: '', horaInicio: '08:00', horaFim: '20:00', ativo: false,
  });

  // ── Carga ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, msgs, outs, clis, tmpls] = await Promise.all([
        api.getWhatsAppConfig(userId),
        api.getWhatsAppMensagens(userId, undefined, 200),
        api.getWhatsAppOptOuts(userId),
        api.getClientes(userId),
        api.getTemplatesMensagens(userId),
      ]);
      setConfig(cfg);
      setConfigForm(cfg);
      setMensagens(msgs);
      setOptOuts(outs);
      setClientes(clis);
      setTemplates(tmpls);
      setBatchClientes(clis);
      if (tmpls.length) { setBatchTemplateId(tmpls[0].id); setBatchMsgText(tmpls[0].texto); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Sugestões de clientes ────────────────────────────────────────────

  useEffect(() => {
    if (!clienteBusca.trim()) { setClienteSugestoes([]); return; }
    const q = clienteBusca.toLowerCase();
    setClienteSugestoes(clientes.filter((c) => c.nome.toLowerCase().includes(q)).slice(0, 6));
  }, [clienteBusca, clientes]);

  // ── Enviar mensagem individual ───────────────────────────────────────

  const handleSend = async () => {
    if (!selectedCliente) { alert('Selecione um cliente.'); return; }
    if (!msgText.trim())  { alert('Digite uma mensagem.'); return; }
    setSaving(true);
    setLastSendResult(null);
    try {
      const result = await api.sendWhatsApp(
        { clienteId: selectedCliente.id, clienteNome: selectedCliente.nome, telefone: selectedCliente.telefone, mensagem: msgText },
        userId, userName
      );
      const modeMsg: Record<string, string> = {
        api:          'Mensagem enviada via API do WhatsApp Business.',
        link:         'WhatsApp aberto no navegador. Clique em Enviar para confirmar.',
        fora_horario: `Fora do horário de envio (${config?.horaInicio}–${config?.horaFim}). Mensagem agendada.`,
        opt_out:      'Este paciente optou por não receber mensagens.',
        sem_telefone: 'Paciente sem telefone cadastrado.',
      };
      setLastSendResult(modeMsg[result.mode] ?? 'Mensagem processada.');
      if (!['opt_out', 'sem_telefone'].includes(result.mode)) {
        const updated = await api.getWhatsAppMensagens(userId, undefined, 200);
        setMensagens(updated);
      }
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao enviar mensagem.');
    } finally {
      setSaving(false);
    }
  };

  // ── Batch ────────────────────────────────────────────────────────────

  const batchFiltrados = batchClientes.filter((c) =>
    (!batchBusca || c.nome.toLowerCase().includes(batchBusca.toLowerCase())) && c.telefone
  );

  const handleBatchSend = async () => {
    if (batchSelecionados.size === 0) { alert('Selecione ao menos um paciente.'); return; }
    if (!batchMsgText.trim())         { alert('Digite a mensagem do disparo.'); return; }
    if (batchSelecionados.size > BATCH_LIMIT) { alert(`Limite de ${BATCH_LIMIT} mensagens por disparo. Reduza a seleção.`); return; }

    setBatchRunning(true);
    setBatchResult(null);
    const batchId = crypto.randomUUID();
    let enviados = 0, falhas = 0, optOuts = 0, semTelefone = 0;

    for (const cid of Array.from(batchSelecionados)) {
      const c = batchClientes.find((x) => x.id === cid);
      if (!c) continue;
      const msg = interpolate(batchMsgText, { nome: c.nome, nome_paciente: c.nome, clinica: userName });
      const result = await api.sendWhatsApp(
        { clienteId: c.id, clienteNome: c.nome, telefone: c.telefone, mensagem: msg, batchId },
        userId, userName
      ).catch(() => ({ mode: 'falha' as const, mensagemId: '' }));

      if (result.mode === 'opt_out')      optOuts++;
      else if (result.mode === 'sem_telefone') semTelefone++;
      else if (result.mode === 'falha')   falhas++;
      else                                enviados++;

      // Pequena pausa entre envios para não sobrecarregar
      await new Promise((r) => setTimeout(r, 300));
    }

    setBatchResult({ batchId, total: batchSelecionados.size, enviados, falhas, optOuts, semTelefone });
    setBatchSelecionados(new Set());
    setBatchRunning(false);
    const updated = await api.getWhatsAppMensagens(userId, undefined, 200);
    setMensagens(updated);
  };

  // ── Config ───────────────────────────────────────────────────────────

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await api.saveWhatsAppConfig(configForm, userId);
      const updated = await api.getWhatsAppConfig(userId);
      setConfig(updated);
      setConfigForm(updated);
      alert('Configuração salva.');
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverOptOut = async (clienteId: string) => {
    try {
      await api.removerOptOut(clienteId, userId);
      setOptOuts((prev) => prev.filter((o) => o.clienteId !== clienteId));
    } catch (e: any) {
      alert(e?.message ?? 'Erro.');
    }
  };

  // ── Histórico filtrado ───────────────────────────────────────────────

  const mensagensFiltradas = mensagens.filter((m) =>
    !buscaHistorico || (m.clienteNome ?? '').toLowerCase().includes(buscaHistorico.toLowerCase()) || m.conteudo.toLowerCase().includes(buscaHistorico.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--color-text-muted)', fontSize: 14 }}>Carregando WhatsApp...</div>;
  }

  const isConfigured = config?.ativo && config.zapiInstance && config.zapiToken;

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={20} style={{ color: '#16A34A' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-main)' }}>WhatsApp</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            {isConfigured
              ? `Integrado via Z-API · ${config.numeroOficial || 'Número não configurado'}`
              : 'Configure sua integração para envio pelo número oficial da clínica.'}
          </p>
        </div>
        {!isConfigured && (
          <span style={{ marginLeft: 'auto', background: '#FEF9C3', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 100, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
            Modo Link — sem API configurada
          </span>
        )}
        {isConfigured && (
          <span style={{ marginLeft: 'auto', background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 100, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
            <Zap size={11} style={{ display: 'inline', marginRight: 4 }} />API Ativa
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 24, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', flexShrink: 0 }}>
        {([
          { id: 'enviar',       label: 'Enviar',        icon: Send },
          { id: 'historico',    label: 'Histórico',     icon: History,   count: mensagens.length },
          { id: 'disparos',     label: 'Disparos',      icon: Users },
          { id: 'configuracao', label: 'Configuração',  icon: Settings2 },
        ] as { id: TabId; label: string; icon: React.FC<any>; count?: number }[]).map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', background: 'transparent',
            fontSize: 14, fontWeight: tab === id ? 600 : 400,
            color: tab === id ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: tab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon size={15} /> {label}
            {count !== undefined && count > 0 && (
              <span style={{ background: tab === id ? 'var(--color-primary)' : '#e5e7eb', color: tab === id ? '#fff' : '#6b7280', borderRadius: 100, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: ENVIAR ── */}
      {tab === 'enviar' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {/* Composição */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Nova mensagem</h3>

            {/* Busca de cliente */}
            <div style={{ position: 'relative' }}>
              <Label>Paciente *</Label>
              <input
                value={clienteBusca || selectedCliente?.nome || ''}
                onChange={(e) => { setClienteBusca(e.target.value); setSelectedCliente(null); setSelectedClienteId(''); }}
                placeholder="Buscar paciente..."
                style={inputStyle}
              />
              {clienteSugestoes.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                  {clienteSugestoes.map((c) => (
                    <button key={c.id} onClick={() => { setSelectedCliente(c); setSelectedClienteId(c.id); setClienteBusca(''); setClienteSugestoes([]); if (templateId) { const t = templates.find((x) => x.id === templateId); if (t) setMsgText(interpolate(t.texto, { nome: c.nome, nome_paciente: c.nome, clinica: userName })); } }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}>
                      <strong>{c.nome}</strong>
                      <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: 12 }}>{c.telefone || 'Sem telefone'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Template */}
            {templates.length > 0 && (
              <div>
                <Label>Template</Label>
                <select value={templateId} onChange={(e) => {
                  setTemplateId(e.target.value);
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t && selectedCliente) setMsgText(interpolate(t.texto, { nome: selectedCliente.nome, nome_paciente: selectedCliente.nome, clinica: userName }));
                  else if (t) setMsgText(t.texto);
                }} style={inputStyle}>
                  <option value="">Escrever livremente...</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                </select>
              </div>
            )}

            {/* Mensagem */}
            <div>
              <Label>Mensagem *</Label>
              <textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} rows={5}
                placeholder={`Olá, {{nome}}! Mensagem da ${userName}...`}
                style={{ ...inputStyle, resize: 'vertical' }} />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                Variáveis: {'{{nome}}'}, {'{{nome_paciente}}'}, {'{{procedimento}}'}, {'{{data}}'}, {'{{valor}}'}
              </p>
            </div>

            {lastSendResult && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#15803D' }}>
                {lastSendResult}
              </div>
            )}

            {pode('criar') && (
              <button onClick={handleSend} disabled={saving || !selectedCliente} style={{
                ...btnPrimary, background: '#16A34A', display: 'flex', alignItems: 'center', gap: 8,
                opacity: (!selectedCliente) ? 0.5 : 1,
              }}>
                <Send size={15} /> {saving ? 'Enviando...' : 'Enviar mensagem'}
              </button>
            )}
          </div>

          {/* Últimas mensagens do cliente selecionado */}
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
              {selectedCliente ? `Histórico — ${selectedCliente.nome}` : 'Últimas mensagens enviadas'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {(selectedCliente
                ? mensagens.filter((m) => m.clienteId === selectedCliente.id)
                : mensagens.slice(0, 20)
              ).map((m) => (
                <MsgBubble key={m.id} msg={m} />
              ))}
              {mensagens.length === 0 && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                  Nenhuma mensagem enviada ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: HISTÓRICO ── */}
      {tab === 'historico' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input value={buscaHistorico} onChange={(e) => setBuscaHistorico(e.target.value)} placeholder="Buscar por cliente ou mensagem..." style={{ ...inputStyle, paddingLeft: 30 }} />
            </div>
            <button onClick={load} style={refreshBtn}><RefreshCw size={14} /></button>
          </div>

          {mensagensFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
              <History size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
              Nenhuma mensagem encontrada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mensagensFiltradas.map((m) => (
                <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: m.direcao === 'out' ? 'var(--color-primary-light)' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircle size={15} style={{ color: m.direcao === 'out' ? 'var(--color-primary)' : '#16A34A' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{m.clienteNome ?? 'Paciente'}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatDateTime(m.createdAt)}</span>
                      {m.usuarioNome && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>por {m.usuarioNome}</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-main)', wordBreak: 'break-word' }}>{m.conteudo}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {statusIcon(m.status)}
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{STATUS_LABELS[m.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: DISPAROS ── */}
      {tab === 'disparos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
          {/* Config do disparo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Configurar disparo</h3>

            <div>
              <Label>Template</Label>
              <select value={batchTemplateId} onChange={(e) => {
                setBatchTemplateId(e.target.value);
                const t = templates.find((x) => x.id === e.target.value);
                if (t) setBatchMsgText(t.texto);
              }} style={inputStyle}>
                <option value="">Selecionar template...</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
              </select>
            </div>

            <div>
              <Label>Mensagem</Label>
              <textarea value={batchMsgText} onChange={(e) => setBatchMsgText(e.target.value)} rows={5}
                placeholder={`Olá {{nome}}!`}
                style={{ ...inputStyle, resize: 'vertical' }} />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                {'{{nome}}'} será substituído pelo nome de cada paciente.
              </p>
            </div>

            <div style={{ background: batchSelecionados.size > BATCH_LIMIT ? '#FEF2F2' : 'var(--color-primary-light)', border: `1px solid ${batchSelecionados.size > BATCH_LIMIT ? '#FECACA' : 'var(--color-border-hover)'}`, borderRadius: 'var(--border-radius-md)', padding: '10px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: batchSelecionados.size > BATCH_LIMIT ? '#B91C1C' : 'var(--color-primary)' }}>
                {batchSelecionados.size} / {BATCH_LIMIT} selecionados
              </div>
              {batchSelecionados.size > BATCH_LIMIT && (
                <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 3 }}>Limite de {BATCH_LIMIT} por disparo excedido</div>
              )}
            </div>

            {pode('criar') && (
              <button
                onClick={handleBatchSend}
                disabled={batchRunning || batchSelecionados.size === 0 || batchSelecionados.size > BATCH_LIMIT}
                style={{ ...btnPrimary, background: '#16A34A', display: 'flex', alignItems: 'center', gap: 8, opacity: batchSelecionados.size === 0 ? 0.5 : 1 }}
              >
                <Send size={15} /> {batchRunning ? 'Disparando...' : `Disparar para ${batchSelecionados.size}`}
              </button>
            )}

            {/* Resultado do último disparo */}
            {batchResult && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '14px' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Último disparo</div>
                {[
                  { label: 'Total',       value: batchResult.total,       color: 'var(--color-text-main)' },
                  { label: 'Enviados',    value: batchResult.enviados,    color: '#15803D' },
                  { label: 'Falhas',      value: batchResult.falhas,      color: '#B91C1C' },
                  { label: 'Opt-outs',    value: batchResult.optOuts,     color: '#9CA3AF' },
                  { label: 'Sem telefone',value: batchResult.semTelefone, color: '#9CA3AF' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista de pacientes */}
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input value={batchBusca} onChange={(e) => setBatchBusca(e.target.value)} placeholder="Filtrar pacientes..." style={{ ...inputStyle, paddingLeft: 30 }} />
              </div>
              <button
                onClick={() => setBatchSelecionados(new Set(batchFiltrados.slice(0, BATCH_LIMIT).map((c) => c.id)))}
                style={btnSecondary}
              >
                Selecionar {Math.min(batchFiltrados.length, BATCH_LIMIT)}
              </button>
              <button onClick={() => setBatchSelecionados(new Set())} style={btnSecondary}>Limpar</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
              {batchFiltrados.map((c) => (
                <label key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  border: `1px solid ${batchSelecionados.has(c.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--border-radius-md)', cursor: 'pointer',
                  background: batchSelecionados.has(c.id) ? 'var(--color-primary-light)' : 'var(--bg-card)',
                }}>
                  <input type="checkbox" checked={batchSelecionados.has(c.id)}
                    onChange={() => setBatchSelecionados((prev) => { const s = new Set(prev); s.has(c.id) ? s.delete(c.id) : s.add(c.id); return s; })}
                    style={{ accentColor: 'var(--color-primary)', width: 15, height: 15 }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{c.nome}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.telefone}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CONFIGURAÇÃO ── */}
      {tab === 'configuracao' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
          {/* Formulário de configuração */}
          <div>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Integração Z-API</h3>

            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#B45309' }}>
              <strong>Como configurar:</strong> Crie uma instância em <a href="https://z-api.io" target="_blank" rel="noreferrer" style={{ color: '#B45309' }}>z-api.io</a>, copie o Instance ID e o Token e cole abaixo. Para ativar o envio direto, a instância precisa estar conectada via QR code.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Instance ID *</Label>
                  <input value={configForm.zapiInstance} onChange={(e) => setConfigForm((f) => ({ ...f, zapiInstance: e.target.value }))} placeholder="Ex: 3D123ABC..." style={inputStyle} />
                </div>
                <div>
                  <Label>Token *</Label>
                  <input value={configForm.zapiToken} onChange={(e) => setConfigForm((f) => ({ ...f, zapiToken: e.target.value }))} placeholder="Seu token Z-API" type="password" style={inputStyle} />
                </div>
              </div>
              <div>
                <Label>Client Token (se exigido)</Label>
                <input value={configForm.zapiClientToken} onChange={(e) => setConfigForm((f) => ({ ...f, zapiClientToken: e.target.value }))} placeholder="client-token do header" type="password" style={inputStyle} />
              </div>
              <div>
                <Label>Número oficial exibido</Label>
                <input value={configForm.numeroOficial} onChange={(e) => setConfigForm((f) => ({ ...f, numeroOficial: e.target.value }))} placeholder="Ex: (11) 99999-9999" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Início do horário de envio</Label>
                  <input type="time" value={configForm.horaInicio} onChange={(e) => setConfigForm((f) => ({ ...f, horaInicio: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <Label>Fim do horário de envio</Label>
                  <input type="time" value={configForm.horaFim} onChange={(e) => setConfigForm((f) => ({ ...f, horaFim: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 16px', border: `1px solid ${configForm.ativo ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 'var(--border-radius-md)', background: configForm.ativo ? 'var(--color-primary-light)' : 'transparent' }}>
                <input type="checkbox" checked={configForm.ativo} onChange={(e) => setConfigForm((f) => ({ ...f, ativo: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-main)' }}>Ativar envio via API</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Requer instância Z-API conectada. Sem API, as mensagens continuam sendo enviadas via link wa.me.</div>
                </div>
              </label>

              {pode('criar') && (
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button onClick={handleSaveConfig} disabled={saving} style={btnPrimary}>
                    {saving ? 'Salvando...' : 'Salvar configuração'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Opt-outs */}
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Opt-outs ({optOuts.length})</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>
              Pacientes que solicitaram não receber mensagens automáticas.
            </p>
            {optOuts.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                Nenhum opt-out registrado.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {optOuts.map((o) => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{o.clienteNome ?? o.clienteId}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{o.motivo}</div>
                    </div>
                    {pode('deletar') && (
                      <button title="Remover opt-out" onClick={() => handleRemoverOptOut(o.clienteId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-componentes ─────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: WhatsAppMensagem }) {
  return (
    <div style={{
      background: msg.direcao === 'out' ? 'var(--color-primary-light)' : '#F0FDF4',
      border: `1px solid ${msg.direcao === 'out' ? 'var(--color-border-hover)' : '#BBF7D0'}`,
      borderRadius: 'var(--border-radius-md)', padding: '10px 14px',
    }}>
      {msg.clienteNome && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 3 }}>{msg.clienteNome}</div>}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-main)', wordBreak: 'break-word' }}>{msg.conteudo}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{formatDateTime(msg.createdAt)}</span>
        {statusIcon(msg.status)}
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

const btnPrimary: React.CSSProperties = {
  background: 'var(--color-primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--border-radius-md)', padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: 'var(--color-text-main)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)', padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
};

const refreshBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
  background: 'transparent', border: '1px solid var(--color-border)',
  borderRadius: 'var(--border-radius-md)', cursor: 'pointer', color: 'var(--color-text-muted)',
};
