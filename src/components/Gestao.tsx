import React, { useState } from 'react';
import { mockEstoque, mockFinanceiro } from '../data/mockData';
import type { ItemEstoque } from '../types';
import { TrendingUp, AlertTriangle, DollarSign, Wallet, FileSpreadsheet } from 'lucide-react';

export const Gestao: React.FC = () => {
  const [estoqueState, setEstoqueState] = useState<ItemEstoque[]>(mockEstoque);

  const handleRestock = (id: string) => {
    setEstoqueState(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantidade: item.quantidade + 10,
          status: 'normal',
          ultimaReposicao: new Date().toISOString().split('T')[0]
        };
      }
      return item;
    }));
    alert('Compra/Reposição registrada! +10 unidades adicionadas ao estoque.');
  };

  const handleSubtract = (id: string) => {
    setEstoqueState(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantidade - 1);
        return {
          ...item,
          quantidade: newQty,
          status: newQty <= item.quantidadeMinima ? 'critico' : 'normal'
        };
      }
      return item;
    }));
  };

  const faturamentoLiquido = mockFinanceiro.faturamentoTotal - mockFinanceiro.comissoesPagas;

  /**
   * UX Design Decision: Humanized Financial Dashboard
   * Back-office dashboards in medical spas are often dry spreadsheets.
   * We designed a high-end visual scorecard highlighting margins and commissions elegantly.
   * Stock alerts are highlighted in warm clay-coral, encouraging quiet control without red alarm panic.
   */
  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
          Gestão & Back-Office da Clínica
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          Consulte o estoque de insumos e acompanhe o fechamento financeiro diário com facilidade.
        </p>
      </div>

      {/* Financial scorecards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            <span>Faturamento Bruto de Hoje</span>
            <DollarSign size={16} style={{ color: 'var(--color-success)' }} />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            R$ {mockFinanceiro.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 500 }}>
            +18% em relação a quarta-feira passada
          </span>
        </div>

        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            <span>Comissões Devidas (Dra./Estet.)</span>
            <TrendingUp size={16} style={{ color: 'var(--color-warning)' }} />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            R$ {mockFinanceiro.comissoesPagas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Provisão de 30% calculada por procedimento
          </span>
        </div>

        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            <span>Faturamento Líquido (Margem)</span>
            <Wallet size={16} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)' }}>
            R$ {faturamentoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 500 }}>
            Excelente rentabilidade diária (70% margem)
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px', alignItems: 'start' }}>
        
        {/* Inventory Control Table */}
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Controle de Estoque e Consumíveis</h3>
            </div>
            
            {/* Show total critical items */}
            {estoqueState.filter(item => item.status === 'critico').length > 0 && (
              <span className="badge badge-terracotta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} />
                <span>{estoqueState.filter(item => item.status === 'critico').length} itens críticos</span>
              </span>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', paddingBottom: '10px' }}>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Insumo</th>
                <th style={{ padding: '12px 8px', fontWeight: 500, textAlign: 'center' }}>Qtd Atual</th>
                <th style={{ padding: '12px 8px', fontWeight: 500, textAlign: 'center' }}>Qtd Min</th>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Estado</th>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Última Compra</th>
                <th style={{ padding: '12px 8px', fontWeight: 500, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {estoqueState.map((item) => {
                const isCrit = item.status === 'critico';
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'var(--transition-smooth)' }}>
                    <td style={{ padding: '16px 8px', fontWeight: 600 }}>{item.produto}</td>
                    <td style={{ padding: '16px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantidade} <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{item.unidade}s</span></td>
                    <td style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{item.quantidadeMinima}</td>
                    <td style={{ padding: '16px 8px' }}>
                      <span className={`badge ${isCrit ? 'badge-terracotta' : 'badge-success'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 8px', color: 'var(--color-text-muted)' }}>{new Date(item.ultimaReposicao).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handleSubtract(item.id)}
                          className="btn btn-outline" 
                          style={{ padding: '4px 8px', fontSize: '11px', minWidth: '24px' }}
                          title="Deduzir 1 unidade (Consumo)"
                        >
                          -1
                        </button>
                        <button 
                          onClick={() => handleRestock(item.id)}
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="Registrar Reabastecimento"
                        >
                          Repor
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Payments Summary Panel */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Métodos de Pagamento</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {mockFinanceiro.formasPagamento.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600 }}>{p.metodo}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    R$ {p.valor.toLocaleString('pt-BR')} ({p.percentual}%)
                  </span>
                </div>
                
                {/* Progress bar */}
                <div style={{ width: '100%', height: '6px', background: '#F0F0F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${p.percentual}%`, 
                    height: '100%', 
                    background: idx === 0 ? 'var(--color-primary)' : idx === 1 ? '#BACBC5' : '#DCDCDC' 
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '24px', paddingTop: '16px', fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
            * As comissões dos profissionais são calculadas automaticamente após a finalização de cada procedimento no checkout.
          </div>
        </div>

      </div>
    </div>
  );
};
