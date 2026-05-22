import { useEffect, useState } from 'react';
import type { GaleriaItem } from '../types';
import { api } from '../lib/api';

interface GaleriaPublicaProps {
  token: string;
}

export function GaleriaPublica({ token }: GaleriaPublicaProps) {
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [galeria, setGaleria] = useState<GaleriaItem[]>([]);
  const [clienteNome, setClienteNome] = useState('');
  const [clinicaNome, setClinicaNome] = useState('');
  const [expiraEm, setExpiraEm] = useState('');
  const [lightboxPair, setLightboxPair] = useState<{ antes: string; depois?: string; descricao: string } | null>(null);

  useEffect(() => {
    api.getGaleriaPublica(token).then((result) => {
      if (!result) {
        setInvalid(true);
      } else {
        setGaleria(result.items);
        setClienteNome(result.clienteNome);
        setClinicaNome(result.clinicaNome);
        setExpiraEm(result.expiraEm);
      }
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#888' }}>Carregando galeria...</p>
      </div>
    );
  }

  if (invalid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '12px', padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#333' }}>Link inválido ou expirado</h2>
        <p style={{ color: '#888', maxWidth: '360px' }}>Este link de compartilhamento não é mais válido. Solicite um novo link ao profissional responsável.</p>
      </div>
    );
  }

  const expiraFormatado = expiraEm
    ? new Date(expiraEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', borderBottom: '1px solid #e5e7eb', paddingBottom: '24px' }}>
        <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '4px', marginTop: 0 }}>{clinicaNome}</p>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>Evolução de {clienteNome}</h1>
        {expiraFormatado && (
          <p style={{ fontSize: '11px', color: '#bbb', margin: 0 }}>Link válido até {expiraFormatado}</p>
        )}
      </div>

      {/* Galeria */}
      {galeria.length === 0 ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: '60px 0' }}>Nenhuma foto registrada nesta galeria.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {galeria.map((gal) => (
            <div key={gal.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {/* Imagens lado a lado */}
              <div
                style={{ display: 'grid', gridTemplateColumns: gal.imagemDepois ? '1fr 1fr' : '1fr', gap: '2px', cursor: 'pointer' }}
                onClick={() => setLightboxPair({ antes: gal.imagem, depois: gal.imagemDepois, descricao: gal.descricao })}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>ANTES</div>
                  <img src={gal.imagem} alt="Antes" style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                </div>
                {gal.imagemDepois && (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#38a169', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>DEPOIS</div>
                    <img src={gal.imagemDepois} alt="Depois" style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                  </div>
                )}
              </div>
              {/* Rodapé */}
              <div style={{ padding: '12px 14px' }}>
                {gal.descricao && (
                  <p style={{ fontSize: '12px', color: '#555', margin: '0 0 4px', fontStyle: 'italic' }}>{gal.descricao}</p>
                )}
                <p style={{ fontSize: '11px', color: '#bbb', margin: 0 }}>
                  {gal.data ? gal.data.split('-').reverse().join('/') : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '56px', textAlign: 'center', color: '#ddd', fontSize: '11px' }}>
        Powered by Lumina CRM
      </div>

      {/* Lightbox */}
      {lightboxPair && (
        <div
          onClick={() => setLightboxPair(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', cursor: 'zoom-out' }}
        >
          {lightboxPair.descricao && (
            <div style={{ color: '#fff', fontSize: '13px', marginBottom: '16px', opacity: 0.75, textAlign: 'center' }}>
              {lightboxPair.descricao}
            </div>
          )}
          <div
            style={{ display: 'grid', gridTemplateColumns: lightboxPair.depois ? '1fr 1fr' : '1fr', gap: '16px', maxWidth: '90vw', maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#6366f1', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '4px' }}>ANTES</span>
              <img src={lightboxPair.antes} alt="Antes" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} />
            </div>
            {lightboxPair.depois && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#38a169', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '4px' }}>DEPOIS</span>
                <img src={lightboxPair.depois} alt="Depois" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }} />
              </div>
            )}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '16px' }}>clique em qualquer lugar para fechar</div>
        </div>
      )}
    </div>
  );
}
