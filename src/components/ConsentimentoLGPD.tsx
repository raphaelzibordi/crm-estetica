import React, { useState } from 'react';
import { Shield, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const VERSAO_TERMO = '1.0';

const TEXTO_TERMO_SERVICO = `TERMO DE CONSENTIMENTO PARA USO DE DADOS PESSOAIS

Finalidade: Prestação de serviços de saúde e estética (Lei Geral de Proteção de Dados — LGPD, Art. 11, dados de saúde).

Seus dados pessoais (nome, telefone, e-mail, data de nascimento, histórico de atendimentos e fotos clínicas) serão coletados e tratados exclusivamente para:
• Registro e controle de atendimentos;
• Elaboração de prontuários e histórico clínico;
• Comunicação sobre agendamentos e retornos.

Seus direitos como titular dos dados:
• Acesso: solicitar relatório completo dos seus dados em até 72 horas;
• Correção: atualizar dados incorretos a qualquer momento;
• Exclusão: solicitar remoção de dados pessoais não-clínicos (dados de prontuário são mantidos por 20 anos conforme CFM);
• Portabilidade: exportar seus dados em formato digital;
• Revogação: retirar este consentimento a qualquer momento.

Retenção: seus dados são mantidos enquanto você for paciente ativo e pelo prazo legal exigido (prontuário: 20 anos — Resolução CFM nº 1.821/07). Logs de auditoria: mínimo 5 anos (ANPD).

Para exercer seus direitos, entre em contato com a clínica.`;

const TEXTO_TERMO_MARKETING = `CONSENTIMENTO PARA COMUNICAÇÕES DE MARKETING

Desejo receber comunicações sobre promoções, novidades e conteúdos educativos sobre tratamentos estéticos pelos canais WhatsApp e e-mail.

Este consentimento é opcional e separado do consentimento de serviço. Você pode revogar a qualquer momento respondendo "PARAR" às mensagens ou solicitando à clínica.`;

interface ConsentimentoLGPDProps {
  clienteId: string;
  clienteNome: string;
  userId: string;
  ehMenor?: boolean;
  onConcluido: () => void;
  onPular?: () => void;
}

export const ConsentimentoLGPD: React.FC<ConsentimentoLGPDProps> = ({
  clienteId,
  clienteNome,
  userId,
  ehMenor = false,
  onConcluido,
  onPular,
}) => {
  const [aceitouServico, setAceitouServico] = useState(false);
  const [aceitouMarketing, setAceitouMarketing] = useState(false);
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelCpf, setResponsavelCpf] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleConfirmar = async () => {
    if (!aceitouServico) {
      setErro('O consentimento de serviço é obrigatório para realizar o atendimento.');
      return;
    }
    if (ehMenor && !responsavelNome.trim()) {
      setErro('Informe o nome do responsável legal para pacientes menores de 18 anos.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await api.registrarConsentimentoLGPD({
        clienteId,
        tipo: 'servico',
        versaoTermo: VERSAO_TERMO,
        termoTexto: TEXTO_TERMO_SERVICO,
        metodo: ehMenor ? 'responsavel_legal' : 'checkbox',
        responsavelLegalNome: ehMenor ? responsavelNome : undefined,
        responsavelLegalCpf: ehMenor ? responsavelCpf : undefined,
      }, userId);

      if (aceitouMarketing) {
        await api.registrarConsentimentoLGPD({
          clienteId,
          tipo: 'marketing',
          versaoTermo: VERSAO_TERMO,
          termoTexto: TEXTO_TERMO_MARKETING,
          metodo: ehMenor ? 'responsavel_legal' : 'checkbox',
          responsavelLegalNome: ehMenor ? responsavelNome : undefined,
        }, userId);
      }

      onConcluido();
    } catch (err) {
      setErro('Erro ao registrar consentimento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 900, padding: '16px',
    }}>
      <div className="modal-inner" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--border-radius-md)',
        width: '560px',
        maxWidth: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Cabeçalho */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '20px 24px', borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-primary-light)',
        }}>
          <Shield size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}>
              Consentimento de dados — LGPD
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
              Paciente: <strong>{clienteNome}</strong>
            </p>
          </div>
        </div>

        {/* Conteúdo rolável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Termo de serviço */}
          <div style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '14px',
            marginBottom: '16px',
            maxHeight: '180px',
            overflowY: 'auto',
          }}>
            <pre style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              margin: 0,
              lineHeight: 1.6,
            }}>
              {TEXTO_TERMO_SERVICO}
            </pre>
          </div>

          {/* Checkbox serviço */}
          <button
            onClick={() => setAceitouServico(v => !v)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', width: '100%', padding: '8px 0', marginBottom: '16px',
            }}
          >
            {aceitouServico
              ? <CheckSquare size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '1px' }} />
              : <Square size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: '1px' }} />
            }
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.4 }}>
              Li e aceito o Termo de Consentimento para uso de dados pessoais para prestação de serviços de saúde.{' '}
              <span style={{ color: 'var(--color-danger)' }}>*</span>
            </span>
          </button>

          {/* Consentimento marketing (opcional) */}
          <div style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '12px 14px',
            marginBottom: '16px',
          }}>
            <pre style={{
              fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap',
              fontFamily: 'inherit', margin: '0 0 10px', lineHeight: 1.5,
            }}>
              {TEXTO_TERMO_MARKETING}
            </pre>
            <button
              onClick={() => setAceitouMarketing(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              {aceitouMarketing
                ? <CheckSquare size={16} style={{ color: 'var(--color-primary)' }} />
                : <Square size={16} style={{ color: 'var(--color-text-muted)' }} />
              }
              <span style={{ fontSize: '12px', color: 'var(--color-text-main)', fontWeight: 500 }}>
                Aceito receber comunicações de marketing (opcional)
              </span>
            </button>
          </div>

          {/* Campos para menores */}
          {ehMenor && (
            <div style={{
              background: 'var(--color-warning-light, #fff8e1)',
              border: '1px solid var(--color-warning)',
              borderRadius: 'var(--border-radius-sm)',
              padding: '14px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-warning)' }}>
                  Paciente menor de 18 anos — obrigatório responsável legal
                </span>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <input
                  type="text"
                  value={responsavelNome}
                  onChange={e => setResponsavelNome(e.target.value)}
                  placeholder="Nome completo do responsável legal *"
                  style={{
                    padding: '8px 12px', fontSize: '13px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--bg-card)',
                    color: 'var(--color-text-main)',
                  }}
                />
                <input
                  type="text"
                  value={responsavelCpf}
                  onChange={e => setResponsavelCpf(e.target.value)}
                  placeholder="CPF do responsável legal (opcional)"
                  style={{
                    padding: '8px 12px', fontSize: '13px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--bg-card)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>
            </div>
          )}

          {erro && (
            <p style={{ color: 'var(--color-danger)', fontSize: '12px', margin: '0 0 12px', fontWeight: 500 }}>
              {erro}
            </p>
          )}
        </div>

        {/* Rodapé */}
        <div style={{
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
          padding: '16px 24px', borderTop: '1px solid var(--color-border)',
        }}>
          {onPular && (
            <button
              onClick={onPular}
              style={{
                padding: '9px 16px', fontSize: '13px', fontWeight: 500,
                background: 'none', border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
            >
              Coletar depois
            </button>
          )}
          <button
            onClick={handleConfirmar}
            disabled={salvando || !aceitouServico}
            style={{
              padding: '9px 20px', fontSize: '13px', fontWeight: 600,
              background: aceitouServico ? 'var(--color-primary)' : 'var(--color-border)',
              color: aceitouServico ? '#fff' : 'var(--color-text-muted)',
              border: 'none', borderRadius: 'var(--border-radius-sm)',
              cursor: !aceitouServico || salvando ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Shield size={14} />
            {salvando ? 'Registrando...' : 'Confirmar consentimento'}
          </button>
        </div>
      </div>
    </div>
  );
};
