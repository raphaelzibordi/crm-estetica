import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Loader2, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import type { RelatorioFaltas } from '../types';

interface RelatorioFaltasProps {
  userId: string;
}

export const RelatorioFaltas: React.FC<RelatorioFaltasProps> = ({ userId }) => {
  const [relatorio, setRelatorio] = useState<RelatorioFaltas | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadRelatorio();
  }, [dataInicio, dataFim]);

  const loadRelatorio = async () => {
    setLoading(true);
    try {
      const r = await api.getNoShowReport(dataInicio, dataFim, userId);
      setRelatorio(r);
    } catch (e) {
      console.error('Erro ao carregar relatório de faltas', e);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!relatorio) return;

    const lines = [
      ['RELATÓRIO DE FALTAS E DESMARCAÇÕES'],
      [`Período: ${dataInicio} a ${dataFim}`],
      [],
      ['RESUMO'],
      ['Total de Faltas', relatorio.totalFaltas],
      ['Total de Agendamentos', relatorio.totalAgendamentos],
      [`Taxa de Faltas (%)`, relatorio.taxaFaltas.toFixed(2)],
      [],
    ];

    if (relatorio.faltasPorProfissional && Object.keys(relatorio.faltasPorProfissional).length > 0) {
      lines.push(['FALTAS POR PROFISSIONAL']);
      Object.entries(relatorio.faltasPorProfissional).forEach(([prof, count]) => {
        lines.push([prof, count.toString()]);
      });
      lines.push([]);
    }

    if (relatorio.faltasPorProcedimento && Object.keys(relatorio.faltasPorProcedimento).length > 0) {
      lines.push(['FALTAS POR PROCEDIMENTO']);
      Object.entries(relatorio.faltasPorProcedimento).forEach(([proc, count]) => {
        lines.push([proc, count.toString()]);
      });
    }

    const csv = lines.map(line => line.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-faltas-${dataInicio}-${dataFim}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <label className="form-label">Data Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
            className="form-input"
          />
        </div>
        <button
          onClick={exportToCSV}
          disabled={!relatorio}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: relatorio ? 'var(--color-primary)' : 'var(--color-text-muted)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: relatorio ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {relatorio && (
        <>
          {/* Resumo KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px' }}>
                {relatorio.totalFaltas}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Total de Faltas
              </div>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>
                {relatorio.totalAgendamentos}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Agendamentos
              </div>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 700,
                color: relatorio.taxaFaltas > 20 ? '#ef4444' : relatorio.taxaFaltas > 10 ? '#f59e0b' : '#10b981',
                marginBottom: '4px',
              }}>
                {relatorio.taxaFaltas.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Taxa de Faltas
              </div>
            </div>
          </div>

          {/* Faltas por Profissional */}
          {relatorio.faltasPorProfissional && Object.keys(relatorio.faltasPorProfissional).length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Faltas por Profissional</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(relatorio.faltasPorProfissional)
                  .sort((a, b) => b[1] - a[1])
                  .map(([prof, count]) => (
                    <div key={prof} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-main)' }}>{prof}</span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '4px 10px',
                        borderRadius: '4px',
                      }}>
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Faltas por Procedimento */}
          {relatorio.faltasPorProcedimento && Object.keys(relatorio.faltasPorProcedimento).length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <BarChart3 size={16} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Faltas por Procedimento</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(relatorio.faltasPorProcedimento)
                  .sort((a, b) => b[1] - a[1])
                  .map(([proc, count]) => (
                    <div key={proc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-main)' }}>{proc}</span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '4px 10px',
                        borderRadius: '4px',
                      }}>
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
