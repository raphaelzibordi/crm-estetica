import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Plus, Download, Clock, CheckCircle2, AlertCircle,
  Link2, Copy, Check, X, Pencil, Eye, EyeOff,
} from 'lucide-react';
import type { DocumentoAssinado, DocumentoModelo, DocumentoTipo } from '../types';
import { api } from '../lib/api';

// ── Utilidades ──────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function applyTemplate(conteudo: string, vars: Record<string, string>): string {
  return conteudo.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function downloadDocumento(doc: DocumentoAssinado): void {
  const assinadoEm = doc.assinadoEm
    ? new Date(doc.assinadoEm).toLocaleString('pt-BR')
    : '—';
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${doc.titulo}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 32px; }
    .conteudo { line-height: 1.8; white-space: pre-wrap; border-top: 1px solid #ddd; padding-top: 24px; }
    .assinatura { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
    .assinatura img { border: 1px solid #ccc; border-radius: 4px; max-width: 320px; }
    .hash { font-family: monospace; font-size: 11px; color: #888; margin-top: 20px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>${doc.titulo}</h1>
  <div class="meta">
    Profissional: ${doc.profissional} &nbsp;|&nbsp;
    Criado em: ${new Date(doc.createdAt).toLocaleDateString('pt-BR')}
  </div>
  <div class="conteudo">${doc.conteudoFinal.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div class="assinatura">
    <strong>Assinatura</strong><br/>
    Método: ${doc.assinaturaMetodo === 'presencial' ? 'Presencial' : 'Remoto'} &nbsp;|&nbsp;
    Assinado em: ${assinadoEm}<br/>
    ${doc.assinadoIp ? `IP: ${doc.assinadoIp}` : ''}
    ${doc.assinadoDispositivo ? `<br/>Dispositivo: ${doc.assinadoDispositivo}` : ''}
    ${doc.assinaturaData ? `<br/><br/><img src="${doc.assinaturaData}" alt="Assinatura" />` : ''}
  </div>
  <div class="hash">SHA-256: ${doc.hashIntegridade}</div>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Canvas de Assinatura ────────────────────────────────────────────────────

interface SigCanvasProps {
  value: string;
  onChange: (dataUrl: string) => void;
}

const SigCanvas: React.FC<SigCanvasProps> = ({ value, onChange }) => {
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
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPos.current = getPos(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !lastPos.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <canvas
        ref={canvasRef}
        width={500}
        height={130}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--border-radius-sm)',
          touchAction: 'none',
          cursor: 'crosshair',
          background: '#fafbfb',
          width: '100%',
        }}
      />
      <button
        type="button"
        onClick={() => {
          const canvas = canvasRef.current!;
          canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
          onChange('');
        }}
        className="btn btn-outline"
        style={{ padding: '4px 10px', fontSize: '11px', alignSelf: 'flex-end' }}
      >
        Limpar
      </button>
    </div>
  );
};

// ── Modelos padrão (seed local) ─────────────────────────────────────────────

export const MODELOS_PADRAO: Omit<DocumentoModelo, 'id' | 'createdAt' | 'ativo'>[] = [
  {
    nome: 'Contrato de Prestação de Serviços',
    tipo: 'contrato' as DocumentoTipo,
    variaveis: ['nome_paciente', 'data', 'procedimento', 'profissional'],
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESTÉTICOS

Pelo presente instrumento, a clínica representada pelo(a) profissional {{profissional}} e o(a) cliente {{nome_paciente}}, acordam a realização do seguinte procedimento:

Procedimento: {{procedimento}}
Data: {{data}}

CONDIÇÕES GERAIS:
1. O cliente declara estar ciente dos riscos e benefícios do procedimento descrito acima.
2. O cliente autoriza a realização do procedimento e o registro fotográfico para fins de acompanhamento clínico.
3. O cliente declara ter recebido todas as orientações pré e pós-procedimento.
4. Em caso de intercorrências, o cliente se compromete a comunicar imediatamente ao profissional responsável.

Ao assinar este documento, o cliente confirma que leu, entendeu e concorda com todas as condições acima.`,
  },
  {
    nome: 'TCLE — Termo de Consentimento Livre e Esclarecido',
    tipo: 'tcle' as DocumentoTipo,
    variaveis: ['nome_paciente', 'procedimento', 'profissional', 'data'],
    conteudo: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)

Eu, {{nome_paciente}}, declaro que fui devidamente informado(a) pelo(a) profissional {{profissional}} sobre o procedimento de {{procedimento}} a ser realizado em {{data}}.

INFORMAÇÕES PRESTADAS:

1. NATUREZA DO PROCEDIMENTO
Fui esclarecido(a) sobre a natureza, objetivos e métodos do procedimento, bem como seus possíveis efeitos colaterais e riscos esperados.

2. BENEFÍCIOS ESPERADOS
Compreendo os resultados esperados e estou ciente de que resultados individuais podem variar.

3. ALTERNATIVAS TERAPÊUTICAS
Fui informado(a) sobre alternativas disponíveis ao procedimento proposto.

4. RISCOS E COMPLICAÇÕES
Estou ciente dos riscos associados ao procedimento, incluindo mas não limitado a: eritema temporário, edema leve, hematomas e sensibilidade local.

5. DIREITO DE RECUSA
Compreendo que tenho o direito de recusar o procedimento a qualquer momento, sem prejuízo ao meu atendimento.

Assino este termo de forma livre e esclarecida, autorizando a realização do procedimento descrito.`,
  },
  {
    nome: 'Autorização de Registro Fotográfico',
    tipo: 'termo_fotografias' as DocumentoTipo,
    variaveis: ['nome_paciente', 'profissional', 'data'],
    conteudo: `TERMO DE AUTORIZAÇÃO DE REGISTRO FOTOGRÁFICO

Eu, {{nome_paciente}}, autorizo o(a) profissional {{profissional}} a realizar registros fotográficos e/ou audiovisuais do meu procedimento estético em {{data}}, para as seguintes finalidades:

☑ Acompanhamento clínico e evolução do tratamento
☑ Prontuário eletrônico pessoal
☐ Material educativo (somente mediante nova autorização expressa)
☐ Divulgação em redes sociais (somente mediante nova autorização expressa)

CONDIÇÕES:
- As imagens serão armazenadas de forma segura e sigilosa.
- Não serão divulgadas sem minha autorização prévia e específica.
- Tenho direito de solicitar a exclusão das imagens a qualquer momento.
- Esta autorização pode ser revogada por escrito a qualquer tempo.

Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).`,
  },
];

// ── Componente principal ────────────────────────────────────────────────────

interface AssinaturaDigitalProps {
  clienteId: string;
  clienteNome: string;
  userId: string;
  userName?: string;
}

type ModalStep = 'selecionar' | 'preencher' | 'assinar';
type SignMode = 'presencial' | 'remoto';

export const AssinaturaDigital: React.FC<AssinaturaDigitalProps> = ({
  clienteId,
  clienteNome,
  userId,
  userName,
}) => {
  const [documentos, setDocumentos] = useState<DocumentoAssinado[]>([]);
  const [templates, setTemplates] = useState<DocumentoModelo[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<ModalStep>('selecionar');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentoModelo | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [signMode, setSignMode] = useState<SignMode>('presencial');
  const [sigData, setSigData] = useState('');
  const [saving, setSaving] = useState(false);

  // Remote link
  const [remoteLink, setRemoteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Document viewer
  const [viewDoc, setViewDoc] = useState<DocumentoAssinado | null>(null);
  const [showContent, setShowContent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docs, tmps] = await Promise.all([
        api.getDocumentSignatures(userId, clienteId),
        api.getDocumentTemplates(userId),
      ]);
      setDocumentos(docs);
      setTemplates(tmps);
    } catch (err) {
      console.error('[Lumina] Erro ao carregar documentos:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, clienteId]);

  useEffect(() => { load(); }, [load]);

  const openModal = () => {
    setStep('selecionar');
    setSelectedTemplate(null);
    setVarValues({});
    setSigData('');
    setSignMode('presencial');
    setRemoteLink(null);
    setShowModal(true);
  };

  const handleSelectTemplate = (tmpl: DocumentoModelo) => {
    setSelectedTemplate(tmpl);
    const initial: Record<string, string> = {};
    const today = new Date().toLocaleDateString('pt-BR');
    tmpl.variaveis.forEach((v) => {
      if (v === 'nome_paciente') initial[v] = clienteNome;
      else if (v === 'data') initial[v] = today;
      else if (v === 'profissional') initial[v] = userName ?? '';
      else initial[v] = '';
    });
    setVarValues(initial);
    setStep('preencher');
  };

  const handleSelectCustom = () => {
    const custom: DocumentoModelo = {
      id: '__custom__',
      nome: 'Documento Personalizado',
      tipo: 'outro',
      conteudo: '',
      variaveis: ['nome_paciente', 'data', 'profissional'],
      ativo: true,
      createdAt: '',
    };
    handleSelectTemplate(custom);
  };

  const conteudoPreenchido = selectedTemplate
    ? applyTemplate(selectedTemplate.conteudo, varValues)
    : '';

  const handleProceed = () => setStep('assinar');

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const conteudo = conteudoPreenchido;
      const hash = await sha256(conteudo);

      if (signMode === 'presencial') {
        if (!sigData) { alert('Por favor, assine o documento antes de confirmar.'); setSaving(false); return; }
        await api.createDocumentSignature(
          {
            clienteId,
            modeloId: selectedTemplate.id === '__custom__' ? null : selectedTemplate.id,
            titulo: selectedTemplate.nome,
            conteudoFinal: conteudo,
            hashIntegridade: hash,
            profissional: userName ?? '',
            assinaturaData: sigData,
            assinaturaMetodo: 'presencial',
            assinadoDispositivo: navigator.userAgent,
          },
          userId
        );
        setShowModal(false);
        await load();
      } else {
        const doc = await api.createDocumentSignature(
          {
            clienteId,
            modeloId: selectedTemplate.id === '__custom__' ? null : selectedTemplate.id,
            titulo: selectedTemplate.nome,
            conteudoFinal: conteudo,
            hashIntegridade: hash,
            profissional: userName ?? '',
          },
          userId
        );
        const link = await api.createSignatureLink(doc.id, userId);
        const url = `${window.location.origin}/assinar/${link.token}`;
        setRemoteLink(url);
        await load();
      }
    } catch (err) {
      console.error('[Lumina] Erro ao salvar documento:', err);
      alert('Erro ao salvar documento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!remoteLink) return;
    navigator.clipboard.writeText(remoteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const statusBadge = (status: DocumentoAssinado['status']) => {
    if (status === 'assinado') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '20px' }}>
        <CheckCircle2 size={11} /> Assinado
      </span>
    );
    if (status === 'expirado') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '20px' }}>
        <AlertCircle size={11} /> Expirado
      </span>
    );
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: '20px' }}>
        <Clock size={11} /> Pendente
      </span>
    );
  };

  const tipoLabel: Record<string, string> = {
    contrato: 'Contrato', tcle: 'TCLE', termo_anestesia: 'Anestesia',
    termo_fotografias: 'Fotografias', prescricao: 'Prescrição', outro: 'Documento',
  };

  const allTemplates = [
    ...MODELOS_PADRAO.map((m, i) => ({ ...m, id: `__padrao_${i}__`, ativo: true, createdAt: '' })),
    ...templates,
  ] as DocumentoModelo[];

  return (
    <div className="card" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Documentos e Assinaturas</h3>
        </div>
        <button onClick={openModal} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> Novo Documento
        </button>
      </div>

      {/* Lista de documentos */}
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Carregando...</div>
      ) : documentos.length === 0 ? (
        <div style={{ padding: '32px', border: '1px dashed var(--color-border)', borderRadius: 'var(--border-radius-md)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Nenhum documento emitido para esta paciente ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {documentos.map((doc) => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', background: '#fafbfb', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.titulo}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                  {doc.assinadoEm && ` · Assinado em ${new Date(doc.assinadoEm).toLocaleDateString('pt-BR')}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {statusBadge(doc.status)}
                <button
                  onClick={() => { setViewDoc(doc); setShowContent(false); }}
                  className="btn btn-outline"
                  style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Visualizar"
                >
                  <Eye size={12} />
                </button>
                {doc.status === 'assinado' && (
                  <button
                    onClick={() => downloadDocumento(doc)}
                    className="btn btn-outline"
                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Download"
                  >
                    <Download size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Novo Documento ── */}
      {showModal && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: '16px' }}
          onClick={() => { if (!remoteLink) setShowModal(false); }}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Step: selecionar */}
            {step === 'selecionar' && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Selecionar Modelo de Documento</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {allTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition-smooth)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>{tmpl.nome}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{tipoLabel[tmpl.tipo] ?? 'Documento'}</div>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={handleSelectCustom}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--border-radius-md)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Pencil size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Documento personalizado (em branco)</div>
                  </button>
                </div>
                <button onClick={() => setShowModal(false)} className="btn btn-outline" style={{ width: '100%' }}>Cancelar</button>
              </>
            )}

            {/* Step: preencher */}
            {step === 'preencher' && selectedTemplate && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{selectedTemplate.nome}</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Preencha as variáveis do documento</p>

                {selectedTemplate.id === '__custom__' ? (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Conteúdo do Documento</label>
                    <textarea
                      rows={10}
                      className="form-textarea"
                      placeholder="Digite o conteúdo do documento..."
                      value={selectedTemplate.conteudo}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, conteudo: e.target.value })}
                      style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '13px' }}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Use {'{{nome_paciente}}'}, {'{{data}}'}, {'{{profissional}}'} para variáveis dinâmicas.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    {selectedTemplate.variaveis.map((v) => (
                      <div key={v} className="form-group">
                        <label className="form-label">{v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={varValues[v] ?? ''}
                          onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                          placeholder={`{{${v}}}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview */}
                <details style={{ marginBottom: '16px' }}>
                  <summary style={{ fontSize: '12px', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>
                    Visualizar prévia do documento
                  </summary>
                  <div style={{ marginTop: '12px', padding: '16px', background: '#f8f9f8', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto', color: 'var(--color-text-main)' }}>
                    {conteudoPreenchido || selectedTemplate.conteudo}
                  </div>
                </details>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setStep('selecionar')} className="btn btn-outline" style={{ flex: 1 }}>Voltar</button>
                  <button onClick={handleProceed} className="btn btn-primary" style={{ flex: 2 }}>
                    Prosseguir para Assinatura
                  </button>
                </div>
              </>
            )}

            {/* Step: assinar */}
            {step === 'assinar' && selectedTemplate && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{selectedTemplate.nome}</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Escolha o método de assinatura</p>

                {/* Mode selector */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  {(['presencial', 'remoto'] as SignMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { setSignMode(mode); setSigData(''); setRemoteLink(null); }}
                      style={{ flex: 1, padding: '10px', border: `1.5px solid ${signMode === mode ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 'var(--border-radius-md)', background: signMode === mode ? 'var(--color-primary-light)' : 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: signMode === mode ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                    >
                      {mode === 'presencial' ? 'Presencial (tablet/tela)' : 'Remoto (link)'}
                    </button>
                  ))}
                </div>

                {/* Remote link result */}
                {remoteLink ? (
                  <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--border-radius-md)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>
                      <CheckCircle2 size={16} /> Documento criado! Link de assinatura gerado:
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        readOnly
                        value={remoteLink}
                        style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: '12px', background: '#fff', color: 'var(--color-text-main)' }}
                      />
                      <button onClick={copyLink} className="btn btn-outline" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#16a34a', marginTop: '8px' }}>
                      Envie este link para a paciente. Expira em 48 horas.
                    </p>
                    <button onClick={() => setShowModal(false)} className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                      Concluído
                    </button>
                  </div>
                ) : (
                  <>
                    {signMode === 'presencial' && (
                      <div style={{ marginBottom: '20px' }}>
                        <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                          Assinatura da paciente (use o dedo ou caneta)
                        </label>
                        <SigCanvas value={sigData} onChange={setSigData} />
                      </div>
                    )}

                    {signMode === 'remoto' && (
                      <div style={{ padding: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--border-radius-md)', marginBottom: '20px', fontSize: '13px', color: '#1d4ed8' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <Link2 size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span>Um link seguro será gerado e você poderá compartilhá-lo com a paciente via WhatsApp, e-mail ou mensagem. O link expira em 48 horas.</span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setStep('preencher')} className="btn btn-outline" style={{ flex: 1 }}>Voltar</button>
                      <button
                        onClick={handleSave}
                        disabled={saving || (signMode === 'presencial' && !sigData)}
                        className="btn btn-primary"
                        style={{ flex: 2 }}
                      >
                        {saving ? 'Salvando...' : signMode === 'presencial' ? 'Confirmar Assinatura' : 'Gerar Link de Assinatura'}
                      </button>
                    </div>
                  </>
                )}

                {!remoteLink && (
                  <button onClick={() => setShowModal(false)} className="btn btn-outline" style={{ width: '100%', marginTop: '8px' }}>
                    Cancelar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Visualizar Documento ── */}
      {viewDoc && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: '16px' }}
          onClick={() => setViewDoc(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{viewDoc.titulo}</h3>
              <button onClick={() => setViewDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Metadata */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {statusBadge(viewDoc.status)}
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Criado em {new Date(viewDoc.createdAt).toLocaleDateString('pt-BR')}</span>
              {viewDoc.assinadoEm && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  · Assinado em {new Date(viewDoc.assinadoEm).toLocaleString('pt-BR')}
                </span>
              )}
              {viewDoc.assinaturaMetodo && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                  · {viewDoc.assinaturaMetodo}
                </span>
              )}
            </div>

            {/* Conteúdo */}
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => setShowContent((v) => !v)}
                className="btn btn-outline"
                style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}
              >
                {showContent ? <EyeOff size={13} /> : <Eye size={13} />}
                {showContent ? 'Ocultar texto' : 'Ver texto completo'}
              </button>
              {showContent && (
                <div style={{ padding: '16px', background: '#f8f9f8', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: '12px', lineHeight: '1.8', whiteSpace: 'pre-wrap', maxHeight: '260px', overflowY: 'auto' }}>
                  {viewDoc.conteudoFinal}
                </div>
              )}
            </div>

            {/* Assinatura */}
            {viewDoc.assinaturaData && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-main)' }}>Assinatura capturada:</p>
                <img src={viewDoc.assinaturaData} alt="Assinatura" style={{ border: '1px solid var(--color-border)', borderRadius: '4px', maxWidth: '320px', background: '#fff' }} />
              </div>
            )}

            {/* Audit trail */}
            <div style={{ padding: '12px', background: '#f8f9f8', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--color-text-main)' }}>Trilha de Auditoria</strong>
              <div>Hash SHA-256: <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{viewDoc.hashIntegridade}</code></div>
              {viewDoc.assinadoIp && <div>IP: {viewDoc.assinadoIp}</div>}
              {viewDoc.assinadoDispositivo && <div style={{ marginTop: '2px', wordBreak: 'break-all' }}>Dispositivo: {viewDoc.assinadoDispositivo.substring(0, 80)}...</div>}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              {viewDoc.status === 'assinado' && (
                <button onClick={() => downloadDocumento(viewDoc)} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Download size={15} /> Download
                </button>
              )}
              <button onClick={() => setViewDoc(null)} className="btn btn-outline" style={{ flex: 1 }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
