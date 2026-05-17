import React, { useState } from 'react';
import { mockClientesRetorno, mockTemplatesMensagens } from '../data/mockData';
import { MessageSquare, Send, Heart, AlertCircle } from 'lucide-react';

export const Comunicacao: React.FC = () => {
  const [selectedAlertaIdx, setSelectedAlertaIdx] = useState<number>(0);
  const [editingText, setEditingText] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const currentAlerta = mockClientesRetorno[selectedAlertaIdx];

  // Resolve template text dynamically replacing {nome}
  const getResolvedText = (templateText: string, clientName: string) => {
    return templateText.replace('{nome}', clientName.split(' ')[0]);
  };

  // Initialize edited message state when an alert or template is clicked
  React.useEffect(() => {
    if (currentAlerta) {
      const template = mockTemplatesMensagens.find(t => t.id === currentAlerta.templateSugeridoId) || mockTemplatesMensagens[0];
      setEditingText(getResolvedText(template.texto, currentAlerta.clienteNome));
      setSelectedTemplateId(template.id);
    }
  }, [selectedAlertaIdx, currentAlerta]);

  const handleTemplateChange = (templateId: string) => {
    const template = mockTemplatesMensagens.find(t => t.id === templateId);
    if (template && currentAlerta) {
      setSelectedTemplateId(templateId);
      setEditingText(getResolvedText(template.texto, currentAlerta.clienteNome));
    }
  };

  const handleSendWhatsApp = () => {
    // Elegant URL encoder for WhatsApp Web/App
    const phoneClean = currentAlerta.telefone.replace(/\D/g, '');
    const encodedText = encodeURIComponent(editingText);
    const waUrl = `https://wa.me/55${phoneClean}?text=${encodedText}`;
    
    // Simulates opening in window safely
    window.open(waUrl, '_blank');
    alert(`Redirecionando para o WhatsApp com mensagem humanizada para ${currentAlerta.clienteNome}!`);
  };

  /**
   * UX Comment: 
   * High performance retention avoids dry templates like "Olá. Você tem consulta agendada amanhã."
   * Beautiful aesthetics clinics focus on high-fidelity human care: "Como você está se sentindo? Sentimos sua falta."
   * The CRM Retenção engine lists target patients and allows draft personalization before dispatch.
   */
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

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Side: Active Alerts / Needs attention */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Alertas de Retorno Recente ({mockClientesRetorno.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mockClientesRetorno.map((alerta, idx) => {
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
                    <span style={{ color: 'var(--color-text-muted)' }}>{alerta.telefone}</span>
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

          {/* Quick Stats Widget */}
          <div className="card" style={{ padding: '20px', backgroundColor: '#FDFCFA', borderStyle: 'dashed' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Heart size={14} style={{ color: 'var(--color-warning)' }} /> Ritmo de Fidelização
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              <span>Clientes em dia: <strong>84%</strong></span>
              <span>Retornos este mês: <strong>28</strong></span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#EAEAEA', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ width: '84%', height: '100%', background: 'var(--color-primary)' }} />
            </div>
          </div>
        </div>

        {/* Right Side: Message Editor */}
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

            {/* Template Selector */}
            <div className="form-group">
              <label className="form-label">Selecione o Template Guia</label>
              <select 
                className="form-select"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                {mockTemplatesMensagens.map(t => (
                  <option key={t.id} value={t.id}>{t.titulo} ({t.gatilho})</option>
                ))}
              </select>
            </div>

            {/* Editor Area */}
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

            {/* Hint Box */}
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

            {/* Quick Actions Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => {
                  const template = mockTemplatesMensagens.find(t => t.id === currentAlerta.templateSugeridoId) || mockTemplatesMensagens[0];
                  setEditingText(getResolvedText(template.texto, currentAlerta.clienteNome));
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
    </div>
  );
};
