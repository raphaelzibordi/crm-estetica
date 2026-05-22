import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, FileText, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

interface AssinaturaPublicaProps {
  token: string;
}

interface DocInfo {
  titulo: string;
  conteudo: string;
  profissional: string;
  hash: string;
  expiraEm: string;
}

// ── Canvas de assinatura (self-contained para página pública) ────────────────

const SigCanvas: React.FC<{ onChange: (dataUrl: string) => void }> = ({ onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

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
    ctx.lineWidth = 2.5;
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
        width={560}
        height={150}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ border: '2px solid #d1d5db', borderRadius: '8px', touchAction: 'none', cursor: 'crosshair', background: '#fafafa', width: '100%' }}
      />
      <button
        type="button"
        onClick={handleClear}
        style={{ alignSelf: 'flex-end', padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}
      >
        Limpar assinatura
      </button>
    </div>
  );
};

// ── Página pública ────────────────────────────────────────────────────────────

export const AssinaturaPublica: React.FC<AssinaturaPublicaProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sigData, setSigData] = useState('');
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.getDocumentByToken(token);
        if (!result) {
          setError('Este link de assinatura é inválido ou já expirou.');
        } else {
          setDoc(result);
        }
      } catch {
        setError('Não foi possível carregar o documento. Tente novamente.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSign = async () => {
    if (!sigData) { alert('Por favor, assine o documento antes de confirmar.'); return; }
    setSigning(true);
    try {
      const dispositivo = navigator.userAgent;
      const result = await api.signDocumentByToken(token, sigData, undefined, dispositivo);
      if (result.success) {
        setDone(true);
      } else {
        setError(result.error ?? 'Erro ao processar assinatura.');
      }
    } catch {
      setError('Erro ao processar assinatura. Tente novamente.');
    } finally {
      setSigning(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 16px',
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
    padding: '40px',
    width: '100%',
    maxWidth: '640px',
  };

  // Loading
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
            Carregando documento...
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: '#dc2626', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#111827' }}>Link Inválido</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>{error}</p>
        </div>
      </div>
    );
  }

  // Success
  if (done) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <CheckCircle2 size={48} style={{ color: '#16a34a', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>Documento Assinado!</h2>
          <p style={{ color: '#4b5563', fontSize: '14px' }}>
            Sua assinatura foi registrada com sucesso. Uma cópia ficará arquivada no seu prontuário.
          </p>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  const expira = new Date(doc.expiraEm).toLocaleString('pt-BR');

  return (
    <div style={containerStyle}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Sparkles size={20} style={{ color: '#2d5a4e' }} />
        <span style={{ fontWeight: 700, fontSize: '18px', color: '#2d5a4e' }}>Lumina</span>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <FileText size={22} style={{ color: '#2d5a4e', flexShrink: 0 }} />
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{doc.titulo}</h1>
        </div>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>
          Profissional responsável: <strong>{doc.profissional}</strong> &nbsp;·&nbsp; Link válido até {expira}
        </p>

        {/* Document content */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap', color: '#111827', marginBottom: '28px', maxHeight: '360px', overflowY: 'auto' }}>
          {doc.conteudo}
        </div>

        {/* Signature area */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
            Sua assinatura
          </label>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
            Assine com o dedo ou caneta diretamente na área abaixo para confirmar que leu e concorda com o documento.
          </p>
          <SigCanvas onChange={setSigData} />
        </div>

        {/* Hash notice */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', fontSize: '11px', color: '#166534', marginBottom: '20px' }}>
          Este documento possui verificação de integridade (SHA-256: <code style={{ wordBreak: 'break-all' }}>{doc.hash.substring(0, 32)}…</code>)
        </div>

        <button
          onClick={handleSign}
          disabled={signing || !sigData}
          style={{
            width: '100%', padding: '14px', borderRadius: '8px',
            background: sigData ? '#2d5a4e' : '#d1d5db', color: '#fff',
            border: 'none', fontSize: '15px', fontWeight: 600,
            cursor: sigData ? 'pointer' : 'not-allowed', transition: 'background 0.2s',
          }}
        >
          {signing ? 'Processando assinatura...' : 'Assinar e Confirmar'}
        </button>

        <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '12px' }}>
          Ao assinar, você confirma que leu e concorda com o conteúdo acima. Em conformidade com a Lei 14.063/2020.
        </p>
      </div>
    </div>
  );
};
