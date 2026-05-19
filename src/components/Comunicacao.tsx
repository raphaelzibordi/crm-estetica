import React, { useEffect, useState } from 'react';
import type { ClienteRetorno, TemplateMensagem } from '../types';
import { MessageSquare, Send, Heart, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface ComunicacaoProps {
  userId: string;
}

export const Comunicacao: React.FC<ComunicacaoProps> = ({ userId }) => {
  const [selectedAlertaIdx, setSelectedAlertaIdx] = useState<number>(0);
  const [editingText, setEditingText] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [alertas, setAlertas] = useState<ClienteRetorno[]>([]);
  const [templates, setTemplates] = useState<TemplateMensagem[]>([]);
  const [loading, setLoading] = useState(true);

  const currentAlerta = alertas[selectedAlertaIdx];

  const getResolvedText = (templateText: string, clientName: string) => {
    return templateText.replace('{nome}', clientName.split(' ')[0] || clientName);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await api.ensureSeedData(userId).catch(() => {});
        const [retornos, tpls] = await Promise.all([
          api.getClientesRetorno(userId),
          api.getTemplatesMensagens(userId),
        ]);
        if (cancelled) return;
        setAlertas(retornos);
        setTemplates(tpls);
      } catch (err) {
        console.error('Erro ao carregar dados de retenção:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (currentAlerta && templates.length > 0) {
      const template =
        templates.find((t) => t.id === currentAlerta.templateSugeridoId) || templates[0];
      setEditingText(getResolvedText(template.texto, currentAlerta.clienteNome));
      setSelectedTemplateId(template.id);
    } else {
      setEditingText('');
      setSelectedTemplateId('');
    }
  }, [selectedAlertaIdx, currentAlerta, templates]);

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template && currentAlerta) {
      setSelectedTemplateId(templateId);
      setEditingText(getResolvedText(template.texto, currentAlerta.clienteNome));
    }
  };

  const handleSendWhatsApp = () => {
    if (!currentAlerta) return;
    const phoneClean = currentAlerta.telefone.replace(/\D/g, '');
    if (!phoneClean) {
      alert('Cliente sem telefone cadastrado. Atualize o cadastro para enviar mensagem.');
      return;
    }
    const encodedText = encodeURIComponent(editingText);
    const waUrl = `https://wa.me/55${phoneClean}?text=${encodedText}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
          CRM & Retenção Ativa
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Reestabeleça contato com clientes cujo efeito de procedimento expirou ou que não visitam a clínica há mais de 60 dias.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '40px', color: 'var(--color-text-muted)' }}>
          Carregando alertas de retenção...
        </div>
      ) : alertas.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Nenhum cliente em alerta de retorno no momento. Continue acompanhando a evolução dos atendimentos.
        </div>
      ) : (
        <div className="comunicacao-grid" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '32px', alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Alertas de Retorno Recente ({alertas.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alertas.map((alerta, idx) => {
                const isSelected = idx === selectedAlertaIdx;

                return (
                  <div
                    key={alerta.id}
                    onClick={() => setSelectedAlertaIdx(idx)}
                    className="card"
                    style={{
                      padding: '20px',
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: isSelected ? 'var(--color-primary-light)' : '#FFFFFF',
                      borderLeft: '4px solid var(--color-warning)',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                        {alerta.clienteNome}
                      </h4>
                      <span className="badge badge-terracotta" style={{ fontSize: '10px' }}>
                        {alerta.motivoAlerta}
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                      Última sessão: <strong>{alerta.ultimoProcedimento}</strong> em {new Date(alerta.dataUltimoProcedimento).toLocaleDateString('pt-BR')} ({alerta.tempoAusenciaDias} dias atrás)
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{alerta.telefone || 'Sem telefone'}</span>
                      {isSelected && (
                        <span style={{ color: 'var(--color-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Ativo para envio <Send size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card" style={{ padding: '20px', backgroundColor: '#FDFCFA', borderStyle: 'dashed' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Heart size={14} style={{ color: 'var(--color-warning)' }} /> Alertas Ativos
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <span>Clientes a recontatar: <strong>{alertas.length}</strong></span>
                <span>Templates: <strong>{templates.length}</strong></span>
              </div>
            </div>
          </div>

          {currentAlerta && (
            <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Cuidado Exclusivo Personalizado</h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Escreva ou edite a mensagem carinhosa para {currentAlerta.clienteNome}
                  </span>
                </div>
                <span className="badge badge-sage">WhatsApp Ativo</span>
              </div>

              <div className="form-group">
                <label className="form-label">Selecione o Template Guia</label>
                <select
                  className="form-select"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.titulo} ({t.gatilho})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Mensagem Humanizada a Enviar</label>
                <textarea
                  rows={8}
                  className="form-textarea"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  style={{ lineHeight: '1.6', fontSize: '14px', padding: '16px' }}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                backgroundColor: 'var(--color-primary-light)',
                padding: '16px',
                borderRadius: 'var(--border-radius-md)',
                fontSize: '12px',
                color: 'var(--color-primary-dark)'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Dica de Acolhimento:</strong> Evite utilizar linguagem excessivamente transacional.
                  Utilizar palavras como "carinho", "momento", "cuidado" e emojis acolhedores mantém o posicionamento sofisticado da clínica.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => {
                    const template =
                      templates.find((t) => t.id === currentAlerta.templateSugeridoId) ||
                      templates[0];
                    if (template) {
                      setEditingText(getResolvedText(template.texto, currentAlerta.clienteNome));
                    }
                  }}
                  className="btn btn-outline"
                >
                  Restaurar Original
                </button>
                <button
                  onClick={handleSendWhatsApp}
                  className="btn btn-primary"
                >
                  <MessageSquare size={16} />
                  <span>Enviar pelo WhatsApp</span>
                </button>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
};
