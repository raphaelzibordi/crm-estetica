import React, { useState } from 'react';
import { X, Check, Shield } from 'lucide-react';
import type { PerfilAcesso, Permissoes, TabPermissoes } from '../types';

interface PerfilAcessoModalProps {
  perfil?: PerfilAcesso | null;
  onSave: (nome: string, permissoes: Permissoes) => Promise<void>;
  onClose: () => void;
}

// Definição das abas e suas ações possíveis
const TABS_CONFIG: { id: string; label: string; acoes: (keyof TabPermissoes)[] }[] = [
  { id: 'dashboard',        label: 'Jornada da Cliente',  acoes: ['ver'] },
  { id: 'agenda',           label: 'Agenda Inteligente',  acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { id: 'prontuario',       label: 'Prontuário Visual',   acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { id: 'crm',              label: 'Pipeline de Leads',   acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { id: 'orcamentos',       label: 'Orçamentos',          acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { id: 'crc',              label: 'Relacionamento (CRC)', acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { id: 'whatsapp',         label: 'WhatsApp',            acoes: ['ver', 'criar'] },
  { id: 'comunicacao',      label: 'CRM & Retenção',      acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { id: 'gestao',           label: 'Gestão da Clínica',   acoes: ['ver'] },
  { id: 'salas',            label: 'Salas',               acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { id: 'calendario-salas', label: 'Calendário Salas',    acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { id: 'lgpd',             label: 'LGPD',                acoes: ['ver'] },
];

const ACAO_LABEL: Record<keyof TabPermissoes, string> = {
  ver: 'Ver',
  criar: 'Criar',
  editar: 'Editar',
  deletar: 'Deletar',
};

// Templates de perfis padrão para criação rápida
const PERFIS_TEMPLATE: { nome: string; permissoes: Permissoes }[] = [
  {
    nome: 'Recepcionista',
    permissoes: {
      dashboard:         { ver: true },
      agenda:            { ver: true,  criar: true,  editar: true,  deletar: false },
      prontuario:        { ver: true,  criar: false, editar: false, deletar: false },
      crm:               { ver: true,  criar: true,  editar: true,  deletar: false },
      orcamentos:        { ver: true,  criar: true,  editar: true,  deletar: false },
      crc:               { ver: true,  criar: true,  editar: true,  deletar: false },
      whatsapp:          { ver: true,  criar: true },
      comunicacao:       { ver: false },
      gestao:            { ver: false },
      salas:             { ver: true,  criar: false, editar: false, deletar: false },
      'calendario-salas':{ ver: true,  criar: false, editar: false, deletar: false },
      lgpd:              { ver: false },
    },
  },
  {
    nome: 'Profissional',
    permissoes: {
      dashboard:         { ver: true },
      agenda:            { ver: true,  criar: false, editar: false, deletar: false },
      prontuario:        { ver: true,  criar: true,  editar: true,  deletar: false },
      crm:               { ver: false },
      orcamentos:        { ver: true,  criar: true,  editar: true,  deletar: false },
      crc:               { ver: false },
      whatsapp:          { ver: false, criar: false },
      comunicacao:       { ver: false },
      gestao:            { ver: false },
      salas:             { ver: false },
      'calendario-salas':{ ver: false },
      lgpd:              { ver: false },
    },
  },
  {
    nome: 'Gestor',
    permissoes: {
      dashboard:         { ver: true },
      agenda:            { ver: true,  criar: true,  editar: true,  deletar: true },
      prontuario:        { ver: true,  criar: true,  editar: true,  deletar: false },
      crm:               { ver: true,  criar: true,  editar: true,  deletar: true },
      orcamentos:        { ver: true,  criar: true,  editar: true,  deletar: true },
      crc:               { ver: true,  criar: true,  editar: true,  deletar: true },
      whatsapp:          { ver: true,  criar: true },
      comunicacao:       { ver: true,  criar: true,  editar: true,  deletar: true },
      gestao:            { ver: true },
      salas:             { ver: true,  criar: true,  editar: true,  deletar: true },
      'calendario-salas':{ ver: true,  criar: true,  editar: true,  deletar: true },
      lgpd:              { ver: false },
    },
  },
];

function buildEmpty(): Permissoes {
  const p: Permissoes = {};
  for (const t of TABS_CONFIG) {
    const tab: TabPermissoes = { ver: false };
    if (t.acoes.includes('criar'))   tab.criar   = false;
    if (t.acoes.includes('editar'))  tab.editar  = false;
    if (t.acoes.includes('deletar')) tab.deletar = false;
    p[t.id] = tab;
  }
  return p;
}

export const PerfilAcessoModal: React.FC<PerfilAcessoModalProps> = ({ perfil, onSave, onClose }) => {
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [permissoes, setPermissoes] = useState<Permissoes>(() => {
    if (perfil?.permissoes) {
      // Fill in any missing tabs from template
      const base = buildEmpty();
      for (const t of TABS_CONFIG) {
        if (perfil.permissoes[t.id] !== undefined) {
          base[t.id] = { ...base[t.id], ...perfil.permissoes[t.id] };
        }
      }
      return base;
    }
    return buildEmpty();
  });
  const [saving, setSaving] = useState(false);

  const toggle = (tabId: string, acao: keyof TabPermissoes) => {
    setPermissoes(prev => {
      const tab = { ...prev[tabId] };
      const current = !!(tab as any)[acao];
      if (acao === 'ver' && current) {
        // Desativar 'ver' desativa todas as ações do tab
        const reset: TabPermissoes = { ver: false };
        const cfg = TABS_CONFIG.find(t => t.id === tabId);
        if (cfg?.acoes.includes('criar'))   reset.criar   = false;
        if (cfg?.acoes.includes('editar'))  reset.editar  = false;
        if (cfg?.acoes.includes('deletar')) reset.deletar = false;
        return { ...prev, [tabId]: reset };
      }
      if (acao !== 'ver' && !current && !tab.ver) {
        // Ativar qualquer ação sem 'ver' ativa 'ver' também
        (tab as any)['ver'] = true;
      }
      (tab as any)[acao] = !current;
      return { ...prev, [tabId]: tab };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { alert('Informe o nome do perfil.'); return; }
    setSaving(true);
    try { await onSave(nome.trim(), permissoes); }
    catch (err: any) { alert(`Erro: ${err?.message || err}`); }
    finally { setSaving(false); }
  };

  const aplicarTemplate = (t: typeof PERFIS_TEMPLATE[0]) => {
    setNome(t.nome);
    const base = buildEmpty();
    for (const tab of TABS_CONFIG) {
      if (t.permissoes[tab.id] !== undefined) {
        base[tab.id] = { ...base[tab.id], ...t.permissoes[tab.id] };
      }
    }
    setPermissoes(base);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-card)', borderRadius: '16px',
          width: '100%', maxWidth: '660px',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
              {perfil ? 'Editar Perfil de Acesso' : 'Novo Perfil de Acesso'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSave} style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Nome */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Nome do Perfil</label>
            <input
              className="form-input"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Recepcionista, Esteticista, Gestor"
              required
            />
          </div>

          {/* Templates rápidos — só exibe quando criando */}
          {!perfil && (
            <div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                SUGESTÕES DE PERFIL
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PERFIS_TEMPLATE.map(t => (
                  <button
                    key={t.nome}
                    type="button"
                    onClick={() => aplicarTemplate(t)}
                    style={{
                      padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                      background: nome === t.nome ? 'var(--color-primary)' : 'var(--color-primary-light)',
                      color: nome === t.nome ? '#fff' : 'var(--color-primary)',
                      border: '1px solid var(--color-primary)',
                      borderRadius: '100px', cursor: 'pointer',
                    }}
                  >
                    {t.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matriz de permissões */}
          <div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px', fontWeight: 600 }}>
              PERMISSÕES POR MÓDULO
            </p>

            {/* Cabeçalho */}
            <div className="perfil-acesso-matrix-row" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 60px 60px 60px 60px',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ minWidth: 0 }}>Módulo</span>
              <span style={{ textAlign: 'center' }}>Ver</span>
              <span style={{ textAlign: 'center' }}>Criar</span>
              <span style={{ textAlign: 'center' }}>Editar</span>
              <span style={{ textAlign: 'center' }}>Deletar</span>
            </div>

            {/* Linhas */}
            {TABS_CONFIG.map((tab, idx) => {
              const p = permissoes[tab.id] ?? { ver: false };
              return (
                <div
                  key={tab.id}
                  className="perfil-acesso-matrix-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 60px 60px 60px 60px',
                    gap: '4px',
                    padding: '10px 12px',
                    alignItems: 'center',
                    background: idx % 2 === 0 ? 'transparent' : '#f9f9f7',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 500, color: p.ver ? 'var(--color-text-main)' : 'var(--color-text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tab.label}
                  </span>
                  {(['ver', 'criar', 'editar', 'deletar'] as (keyof TabPermissoes)[]).map(acao => {
                    const supported = tab.acoes.includes(acao);
                    const checked = !!(p as any)[acao];
                    return (
                      <div key={acao} style={{ display: 'flex', justifyContent: 'center' }}>
                        {supported ? (
                          <button
                            type="button"
                            onClick={() => toggle(tab.id, acao)}
                            title={`${checked ? 'Desativar' : 'Ativar'} ${ACAO_LABEL[acao]}`}
                            style={{
                              width: 24, height: 24,
                              borderRadius: '6px',
                              border: checked ? 'none' : '2px solid var(--color-border)',
                              background: checked ? 'var(--color-primary)' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s',
                            }}
                          >
                            {checked && <Check size={13} color="#fff" strokeWidth={3} />}
                          </button>
                        ) : (
                          <div style={{ width: 24, height: 24 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: '120px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {saving ? 'Salvando...' : <><Check size={14} /> Salvar Perfil</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
