import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardList, Plus, ChevronDown, ChevronUp, Pencil, Trash2,
  CheckCircle2, Clock, AlertCircle, X, GripVertical, Copy, Check,
  FileSignature, ArrowLeftRight,
} from 'lucide-react';
import type { AnamneseCampo, AnamneseCampoTipo, AnamneseFormulario, AnamneseResposta } from '../types';
import { api } from '../lib/api';

// ── Canvas de Assinatura Digital ────────────────────────────────────────────

interface SignatureCanvasProps {
  value: string;
  onChange: (dataUrl: string) => void;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ value, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPos.current = getPos(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !lastPos.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a2e2b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const onPointerUp = () => {
    drawing.current = false;
    lastPos.current = null;
    onChange(canvasRef.current!.toDataURL('image/png'));
  };

  const handleClear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <canvas
        ref={canvasRef}
        width={480}
        height={120}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)',
          cursor: 'crosshair',
          touchAction: 'none',
          background: '#fff',
          width: '100%',
          maxWidth: 480,
          height: 120,
        }}
      />
      <button
        type="button"
        onClick={handleClear}
        className="btn btn-outline"
        style={{ padding: '4px 10px', fontSize: '11px', width: 'fit-content' }}
      >
        Limpar assinatura
      </button>
    </div>
  );
};

// ── Renderização dinâmica de campo ───────────────────────────────────────────

interface CampoRendererProps {
  campo: AnamneseCampo;
  value: string | string[] | number | boolean | undefined;
  onChange: (val: string | string[] | number | boolean) => void;
  readonly?: boolean;
}

const CampoRenderer: React.FC<CampoRendererProps> = ({ campo, value, onChange, readonly }) => {
  const inputStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '8px 12px',
    opacity: readonly ? 0.8 : 1,
    pointerEvents: readonly ? 'none' : 'auto',
  };

  switch (campo.tipo) {
    case 'texto_livre':
      return (
        <textarea
          className="form-input"
          rows={3}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readonly}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      );

    case 'multipla_escolha':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(campo.opcoes ?? []).map((opt) => {
            const selected = Array.isArray(value) ? value.includes(opt) : value === opt;
            return (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: readonly ? 'default' : 'pointer',
                  fontSize: '13px',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={readonly}
                  onChange={(e) => {
                    if (readonly) return;
                    const cur = Array.isArray(value) ? [...value] : value ? [value as string] : [];
                    onChange(e.target.checked ? [...cur, opt] : cur.filter((v) => v !== opt));
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      );

    case 'sim_nao':
      return (
        <div style={{ display: 'flex', gap: '12px' }}>
          {['Sim', 'Não'].map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={readonly}
              onClick={() => !readonly && onChange(opt)}
              className={value === opt ? 'btn btn-primary' : 'btn btn-outline'}
              style={{ padding: '6px 20px', fontSize: '13px' }}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case 'escala_numerica': {
      const num = typeof value === 'number' ? value : Number(value ?? 0);
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={num}
            disabled={readonly}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--color-primary)', pointerEvents: readonly ? 'none' : 'auto' }}
          />
          <span style={{
            minWidth: '32px',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--color-primary)',
          }}>
            {num}
          </span>
        </div>
      );
    }

    case 'assinatura_consentimento':
      if (readonly && value) {
        return (
          <img
            src={value as string}
            alt="Assinatura"
            style={{ border: '1px solid var(--color-border)', borderRadius: 8, maxHeight: 120, objectFit: 'contain' }}
          />
        );
      }
      return (
        <SignatureCanvas
          value={(value as string) ?? ''}
          onChange={onChange as (v: string) => void}
        />
      );

    default:
      return null;
  }
};

// ── Badge de status ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: AnamneseResposta['status'] }> = ({ status }) => {
  const map = {
    pendente:   { label: 'Pendente',   color: '#f59e0b', bg: '#fef3c7', icon: <Clock size={11} /> },
    preenchido: { label: 'Preenchido', color: '#3b82f6', bg: '#eff6ff', icon: <AlertCircle size={11} /> },
    assinado:   { label: 'Assinado',   color: '#10b981', bg: '#d1fae5', icon: <CheckCircle2 size={11} /> },
  };
  const s = map[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: 20,
      fontSize: '11px',
      fontWeight: 600,
      color: s.color,
      background: s.bg,
    }}>
      {s.icon}
      {s.label}
    </span>
  );
};

// ── Tipos de campo disponíveis ───────────────────────────────────────────────

const TIPOS_CAMPO: { tipo: AnamneseCampoTipo; label: string }[] = [
  { tipo: 'texto_livre',             label: 'Texto livre' },
  { tipo: 'multipla_escolha',        label: 'Múltipla escolha' },
  { tipo: 'sim_nao',                 label: 'Sim / Não' },
  { tipo: 'escala_numerica',         label: 'Escala numérica (0–10)' },
  { tipo: 'assinatura_consentimento', label: 'Assinatura de consentimento' },
];

// ── Componente principal ─────────────────────────────────────────────────────

interface AnamneseDigitalProps {
  clienteId: string;
  clienteNome: string;
  userId: string;
  procedimentos: { id: string; nome: string }[];
  userName?: string;
}

export const AnamneseDigital: React.FC<AnamneseDigitalProps> = ({
  clienteId, clienteNome, userId, procedimentos, userName,
}) => {
  const [activeTab, setActiveTab] = useState<'historico' | 'formularios'>('historico');
  const [formularios, setFormularios] = useState<AnamneseFormulario[]>([]);
  const [respostas, setRespostas] = useState<AnamneseResposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal de preenchimento presencial
  const [showPreencher, setShowPreencher] = useState(false);
  const [formularioSelecionado, setFormularioSelecionado] = useState<AnamneseFormulario | null>(null);
  const [respostaAtual, setRespostaAtual] = useState<AnamneseResposta | null>(null);
  const [drafRespostas, setDraftRespostas] = useState<Record<string, string | string[] | number | boolean>>({});
  const [salvando, setSalvando] = useState(false);

  // Modal de criação/edição de formulário
  const [showFormEditor, setShowFormEditor] = useState(false);
  const [editingFormulario, setEditingFormulario] = useState<AnamneseFormulario | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formProcedimentoId, setFormProcedimentoId] = useState<string>('');
  const [formCampos, setFormCampos] = useState<AnamneseCampo[]>([]);
  const [savingForm, setSavingForm] = useState(false);

  // Comparação
  const [comparandoIds, setComparandoIds] = useState<[string, string] | null>(null);

  // Copiar link
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);

  // Seleção de formulário para nova anamnese
  const [showSelecionarForm, setShowSelecionarForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [forms, resps] = await Promise.all([
        api.getAnamneseFormularios(userId),
        api.getAnamneseRespostas(clienteId, userId),
      ]);
      setFormularios(forms);
      setRespostas(resps);
    } catch {
      // silencioso — tabelas podem não existir ainda
    } finally {
      setLoading(false);
    }
  }, [clienteId, userId]);

  useEffect(() => { load(); }, [load]);

  // ── Abrir preenchimento ────────────────────────────────────────

  const abrirPreencher = async (formulario: AnamneseFormulario, respostaExistente?: AnamneseResposta) => {
    setFormularioSelecionado(formulario);
    if (respostaExistente) {
      setRespostaAtual(respostaExistente);
      setDraftRespostas({ ...respostaExistente.respostas });
    } else {
      try {
        const nova = await api.createAnamneseResposta({ clienteId, formularioId: formulario.id }, userId);
        setRespostaAtual(nova);
        setDraftRespostas({});
        setRespostas((prev) => [nova, ...prev]);
      } catch (e: any) {
        alert(e.message ?? 'Erro ao iniciar anamnese.');
        return;
      }
    }
    setShowSelecionarForm(false);
    setShowPreencher(true);
  };

  // ── Salvar rascunho ────────────────────────────────────────────

  const salvarRascunho = async () => {
    if (!respostaAtual) return;
    setSalvando(true);
    try {
      const updated = await api.updateAnamneseResposta(
        respostaAtual.id,
        { respostas: drafRespostas, status: 'preenchido' },
        userId
      );
      setRespostas((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setRespostaAtual(updated);
      alert('Rascunho salvo com sucesso.');
    } catch (e: any) {
      alert(e.message ?? 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Assinar e finalizar ────────────────────────────────────────

  const assinarEFinalizar = async () => {
    if (!respostaAtual || !formularioSelecionado) return;

    // Validar campos obrigatórios
    const camposFaltando = formularioSelecionado.campos.filter((c) => {
      if (!c.obrigatorio) return false;
      const v = drafRespostas[c.id];
      if (v === undefined || v === '' || v === null) return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    });
    if (camposFaltando.length > 0) {
      alert(`Preencha os campos obrigatórios: ${camposFaltando.map((c) => c.label).join(', ')}`);
      return;
    }

    // Obter assinatura — prioriza campo do formulário, depois campo global
    const campoAssinatura = formularioSelecionado.campos.find((c) => c.tipo === 'assinatura_consentimento');
    const assinaturaData = campoAssinatura
      ? (drafRespostas[campoAssinatura.id] as string) ?? null
      : (drafRespostas['__assinatura__'] as string) ?? null;

    if (!assinaturaData) {
      alert('Assinatura digital obrigatória para finalizar.');
      return;
    }

    setSalvando(true);
    try {
      const updated = await api.updateAnamneseResposta(
        respostaAtual.id,
        {
          respostas: drafRespostas,
          status: 'assinado',
          revisadoPor: userName ?? 'Profissional',
          assinaturaData,
        },
        userId
      );
      setRespostas((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setShowPreencher(false);
      setRespostaAtual(null);
    } catch (e: any) {
      alert(e.message ?? 'Erro ao assinar.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Enviar link pré-consulta ───────────────────────────────────

  const enviarLink = async (resposta: AnamneseResposta) => {
    const expira = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    try {
      const updated = await api.updateAnamneseResposta(resposta.id, { tokenExpiraEm: expira }, userId);
      setRespostas((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      const link = `${window.location.origin}/anamnese/${updated.tokenPublico}`;
      await navigator.clipboard.writeText(link);
      setLinkCopiado(updated.id);
      setTimeout(() => setLinkCopiado(null), 3000);
    } catch {
      alert('Erro ao gerar link.');
    }
  };

  // ── Editor de formulário ───────────────────────────────────────

  const abrirEditor = (formulario?: AnamneseFormulario) => {
    if (formulario) {
      setEditingFormulario(formulario);
      setFormNome(formulario.nome);
      setFormProcedimentoId(formulario.procedimentoId ?? '');
      setFormCampos(formulario.campos.map((c) => ({ ...c })));
    } else {
      setEditingFormulario(null);
      setFormNome('');
      setFormProcedimentoId('');
      setFormCampos([]);
    }
    setShowFormEditor(true);
  };

  const adicionarCampo = () => {
    const novo: AnamneseCampo = {
      id: crypto.randomUUID(),
      tipo: 'texto_livre',
      label: '',
      obrigatorio: false,
    };
    setFormCampos((prev) => [...prev, novo]);
  };

  const atualizarCampo = (idx: number, patch: Partial<AnamneseCampo>) => {
    setFormCampos((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removerCampo = (idx: number) => {
    setFormCampos((prev) => prev.filter((_, i) => i !== idx));
  };

  const salvarFormulario = async () => {
    if (!formNome.trim()) { alert('Dê um nome ao formulário.'); return; }
    if (formCampos.some((c) => !c.label.trim())) { alert('Todos os campos precisam de um título.'); return; }
    setSavingForm(true);
    try {
      if (editingFormulario) {
        const updated = await api.updateAnamneseFormulario(
          editingFormulario.id,
          { nome: formNome, campos: formCampos, procedimentoId: formProcedimentoId || null },
          userId
        );
        setFormularios((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      } else {
        const novo = await api.createAnamneseFormulario(
          { nome: formNome, procedimentoId: formProcedimentoId || null, campos: formCampos, ativo: true },
          userId
        );
        setFormularios((prev) => [novo, ...prev]);
      }
      setShowFormEditor(false);
    } catch (e: any) {
      alert(e.message ?? 'Erro ao salvar formulário.');
    } finally {
      setSavingForm(false);
    }
  };

  const desativarFormulario = async (id: string) => {
    if (!confirm('Desativar este formulário? Anamneses já aplicadas são mantidas.')) return;
    try {
      await api.deleteAnamneseFormulario(id, userId);
      setFormularios((prev) => prev.filter((f) => f.id !== id));
    } catch (e: any) {
      alert(e.message ?? 'Erro ao desativar.');
    }
  };

  // ── Comparação ────────────────────────────────────────────────

  const assinadas = respostas.filter((r) => r.status === 'assinado');
  const aComparar = comparandoIds
    ? [respostas.find((r) => r.id === comparandoIds[0]), respostas.find((r) => r.id === comparandoIds[1])]
    : null;

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
        Carregando anamneses…
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={18} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Anamnese Digital</h3>
        </div>
        <button
          onClick={() => setShowSelecionarForm(true)}
          className="btn btn-primary"
          style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={14} />
          Nova Anamnese
        </button>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {(['historico', 'formularios'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
              background: 'none',
              border: 'none',
              borderBottomStyle: 'solid',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {tab === 'historico' ? `Anamneses de ${clienteNome.split(' ')[0]}` : 'Modelos de Formulário'}
          </button>
        ))}
      </div>

      {/* ── ABA: HISTÓRICO ────────────────────────────────────────── */}
      {activeTab === 'historico' && (
        <>
          {/* Botão comparar (visível quando há 2+ assinadas) */}
          {assinadas.length >= 2 && (
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setComparandoIds(comparandoIds ? null : [assinadas[0].id, assinadas[1].id])}
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeftRight size={13} />
                {comparandoIds ? 'Fechar comparação' : 'Comparar anamneses'}
              </button>
            </div>
          )}

          {/* Comparação lado a lado */}
          {comparandoIds && aComparar && aComparar[0] && aComparar[1] && (() => {
            const [r1, r2] = aComparar as AnamneseResposta[];
            const f1 = formularios.find((f) => f.id === r1.formularioId);
            const campos = f1?.campos ?? [];
            return (
              <div style={{ marginBottom: '24px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out' }}>
                {/* Seletor de anamneses a comparar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--color-primary-light)' }}>
                  {[r1, r2].map((r, idx) => (
                    <div key={r.id} style={{ padding: '12px 16px', borderRight: idx === 0 ? '1px solid var(--color-border)' : undefined }}>
                      <select
                        value={r.id}
                        onChange={(e) => {
                          const newIds: [string, string] = [...(comparandoIds ?? [r1.id, r2.id])] as [string, string];
                          newIds[idx] = e.target.value;
                          setComparandoIds(newIds);
                        }}
                        className="form-input"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        {assinadas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {new Date(a.createdAt).toLocaleDateString('pt-BR')} — {a.formularioNome ?? 'Anamnese'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {campos.map((campo) => (
                  <div key={campo.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--color-border)' }}>
                    {[r1, r2].map((r, idx) => {
                      const val = r.respostas[campo.id];
                      const displayVal = Array.isArray(val) ? val.join(', ') : String(val ?? '—');
                      const r2Val = [r1, r2][1 - idx]?.respostas[campo.id];
                      const diferente = idx === 1 && JSON.stringify(val) !== JSON.stringify(r2Val);
                      return (
                        <div key={r.id} style={{
                          padding: '10px 16px',
                          borderRight: idx === 0 ? '1px solid var(--color-border)' : undefined,
                          background: diferente ? '#fef9c3' : undefined,
                        }}>
                          {idx === 0 && (
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>{campo.label}</div>
                          )}
                          <div style={{ fontSize: '13px', color: 'var(--color-text-main)' }}>{displayVal}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}

          {respostas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
              <ClipboardList size={28} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '13px' }}>Nenhuma anamnese registrada para esta paciente.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Clique em "Nova Anamnese" para iniciar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {respostas.map((resp) => {
                const form = formularios.find((f) => f.id === resp.formularioId);
                const expanded = expandedId === resp.id;
                return (
                  <div key={resp.id} className="card" style={{ padding: '16px', border: '1px solid var(--color-border)' }}>
                    {/* Card header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileSignature size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {resp.formularioNome ?? form?.nome ?? 'Anamnese'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {new Date(resp.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            {resp.revisadoPor && ` · Revisado por ${resp.revisadoPor}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StatusBadge status={resp.status} />
                        {/* Ações */}
                        {resp.status !== 'assinado' && form && (
                          <button
                            onClick={() => abrirPreencher(form, resp)}
                            className="btn btn-outline"
                            style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Pencil size={11} />
                            Preencher
                          </button>
                        )}
                        {resp.status === 'pendente' && (
                          <button
                            onClick={() => enviarLink(resp)}
                            className="btn btn-outline"
                            style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                            title="Copiar link para envio ao paciente"
                          >
                            {linkCopiado === resp.id ? <Check size={11} /> : <Copy size={11} />}
                            {linkCopiado === resp.id ? 'Copiado!' : 'Copiar link'}
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(expanded ? null : resp.id)}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Respostas expandidas */}
                    {expanded && form && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                        {form.campos.map((campo) => {
                          const val = resp.respostas[campo.id];
                          return (
                            <div key={campo.id}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                                {campo.label}
                                {campo.obrigatorio && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                              </div>
                              <CampoRenderer campo={campo} value={val} onChange={() => {}} readonly />
                            </div>
                          );
                        })}
                        {resp.assinaturaData && (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Assinatura digital</div>
                            <img src={resp.assinaturaData} alt="Assinatura" style={{ maxHeight: 80, border: '1px solid var(--color-border)', borderRadius: 8 }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── ABA: MODELOS DE FORMULÁRIO ─────────────────────────────── */}
      {activeTab === 'formularios' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              onClick={() => abrirEditor()}
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              Novo Formulário
            </button>
          </div>

          {formularios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: '13px' }}>Nenhum modelo criado ainda.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Crie formulários personalizados para cada procedimento.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {formularios.map((form) => (
                <div key={form.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', background: '#FAFBFB' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>{form.nome}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {form.procedimentoNome ? `Procedimento: ${form.procedimentoNome}` : 'Formulário genérico'}
                      {' · '}{form.campos.length} campo{form.campos.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => abrirEditor(form)}
                      className="btn btn-outline"
                      style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Pencil size={11} />
                      Editar
                    </button>
                    <button
                      onClick={() => desativarFormulario(form.id)}
                      className="btn btn-outline"
                      style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', color: '#ef4444', borderColor: '#fecaca' }}
                    >
                      <Trash2 size={11} />
                      Desativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── MODAL: SELECIONAR FORMULÁRIO PARA NOVA ANAMNESE ─────────── */}
      {showSelecionarForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ padding: '28px', width: '100%', maxWidth: '440px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Selecionar formulário</h3>
              <button onClick={() => setShowSelecionarForm(false)} className="btn btn-outline" style={{ padding: '4px 8px' }}><X size={14} /></button>
            </div>
            {formularios.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                <p style={{ fontSize: '13px' }}>Nenhum formulário disponível.</p>
                <button
                  onClick={() => { setShowSelecionarForm(false); setActiveTab('formularios'); abrirEditor(); }}
                  className="btn btn-primary"
                  style={{ marginTop: '12px', fontSize: '12px' }}
                >
                  Criar primeiro formulário
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {formularios.map((form) => (
                  <button
                    key={form.id}
                    onClick={() => abrirPreencher(form)}
                    style={{ textAlign: 'left', padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', background: 'none', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>{form.nome}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {form.procedimentoNome ?? 'Genérico'} · {form.campos.length} campo{form.campos.length !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: PREENCHER ANAMNESE ─────────────────────────────────── */}
      {showPreencher && formularioSelecionado && respostaAtual && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div className="card" style={{ padding: '28px', width: '100%', maxWidth: '560px', animation: 'fadeIn 0.2s ease-out', marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{formularioSelecionado.nome}</h3>
              <button onClick={() => setShowPreencher(false)} className="btn btn-outline" style={{ padding: '4px 8px' }}><X size={14} /></button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
              Paciente: <strong>{clienteNome}</strong>
            </div>

            {formularioSelecionado.campos.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Este formulário não tem campos configurados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {formularioSelecionado.campos.map((campo) => (
                  <div key={campo.id}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '8px' }}>
                      {campo.label}
                      {campo.obrigatorio && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                    </label>
                    <CampoRenderer
                      campo={campo}
                      value={drafRespostas[campo.id]}
                      onChange={(val) => setDraftRespostas((prev) => ({ ...prev, [campo.id]: val }))}
                    />
                  </div>
                ))}

                {/* Campo de assinatura global — só exibe se o formulário não tem campo de assinatura */}
                {!formularioSelecionado.campos.some((c) => c.tipo === 'assinatura_consentimento') && (
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '8px' }}>
                      Assinatura digital
                      <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '8px' }}>(obrigatória para finalizar)</span>
                    </label>
                    <SignatureCanvas
                      value={(drafRespostas['__assinatura__'] as string) ?? ''}
                      onChange={(val) => setDraftRespostas((prev) => ({ ...prev, __assinatura__: val }))}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button onClick={salvarRascunho} disabled={salvando} className="btn btn-outline" style={{ flex: 1, fontSize: '13px' }}>
                Salvar rascunho
              </button>
              <button
                onClick={assinarEFinalizar}
                disabled={salvando}
                className="btn btn-primary"
                style={{ flex: 2, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <FileSignature size={14} />
                {salvando ? 'Salvando…' : 'Assinar e finalizar'}
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
              A assinatura digital tem validade legal equivalente à física (Lei 14.063/2020).
            </p>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITOR DE FORMULÁRIO ───────────────────────────────── */}
      {showFormEditor && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div className="card" style={{ padding: '28px', width: '100%', maxWidth: '580px', animation: 'fadeIn 0.2s ease-out', marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                {editingFormulario ? 'Editar formulário' : 'Novo formulário'}
              </h3>
              <button onClick={() => setShowFormEditor(false)} className="btn btn-outline" style={{ padding: '4px 8px' }}><X size={14} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Nome */}
              <div className="form-group">
                <label className="form-label">Nome do formulário *</label>
                <input
                  className="form-input"
                  placeholder="Ex: Anamnese de Botox"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>

              {/* Procedimento associado */}
              <div className="form-group">
                <label className="form-label">Procedimento associado (opcional)</label>
                <select
                  className="form-input"
                  value={formProcedimentoId}
                  onChange={(e) => setFormProcedimentoId(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="">Genérico (todos os procedimentos)</option>
                  {procedimentos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              {/* Campos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Campos do formulário</label>
                  <button
                    type="button"
                    onClick={adicionarCampo}
                    className="btn btn-outline"
                    style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Plus size={12} />
                    Adicionar campo
                  </button>
                </div>

                {formCampos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed var(--color-border)', borderRadius: 'var(--border-radius-md)', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                    Nenhum campo adicionado.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {formCampos.map((campo, idx) => (
                      <div key={campo.id} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', background: '#FAFBFB' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <GripVertical size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: '10px', cursor: 'grab' }} />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                              className="form-input"
                              placeholder="Título do campo *"
                              value={campo.label}
                              onChange={(e) => atualizarCampo(idx, { label: e.target.value })}
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <select
                                className="form-input"
                                value={campo.tipo}
                                onChange={(e) => atualizarCampo(idx, { tipo: e.target.value as AnamneseCampoTipo, opcoes: e.target.value === 'multipla_escolha' ? ['Sim', 'Não'] : undefined })}
                                style={{ fontSize: '12px', padding: '5px 8px', flex: 1, minWidth: '180px' }}
                              >
                                {TIPOS_CAMPO.map((t) => (
                                  <option key={t.tipo} value={t.tipo}>{t.label}</option>
                                ))}
                              </select>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={campo.obrigatorio}
                                  onChange={(e) => atualizarCampo(idx, { obrigatorio: e.target.checked })}
                                />
                                Obrigatório
                              </label>
                            </div>
                            {campo.tipo === 'multipla_escolha' && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Opções (uma por linha)</div>
                                <textarea
                                  className="form-input"
                                  rows={3}
                                  value={(campo.opcoes ?? []).join('\n')}
                                  onChange={(e) => atualizarCampo(idx, { opcoes: e.target.value.split('\n').filter(Boolean) })}
                                  style={{ fontSize: '12px', padding: '6px 10px', resize: 'vertical' }}
                                  placeholder="Sim&#10;Não&#10;Às vezes"
                                />
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removerCampo(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', flexShrink: 0 }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button onClick={() => setShowFormEditor(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={salvarFormulario} disabled={savingForm} className="btn btn-primary" style={{ flex: 2 }}>
                {savingForm ? 'Salvando…' : editingFormulario ? 'Salvar alterações' : 'Criar formulário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
