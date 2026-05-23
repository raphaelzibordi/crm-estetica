import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  X,
  Search,
  Share2,
  Clock,
  Eye,
  EyeOff,
  History,
  Check,
} from 'lucide-react';
import type {
  PrescricaoTemplate,
  PrescricaoTemplateVersao,
  TemplateCategoria,
  TemplatePermissaoEdicao,
} from '../types';
import { api } from '../lib/api';

interface Props {
  clienteId: string;
  clienteNome: string;
  userId: string;
  userName?: string;
}

const CATEGORIAS: { value: TemplateCategoria; label: string; cor: string; bg: string }[] = [
  { value: 'prescricao',                  label: 'Prescrição',                   cor: '#2563eb', bg: '#eff6ff' },
  { value: 'orientacao_pos_procedimento', label: 'Orientação Pós-Procedimento',  cor: '#16a34a', bg: '#f0fdf4' },
  { value: 'recomendacao_dermatologica',  label: 'Recomendação Dermatológica',   cor: '#7c3aed', bg: '#f5f3ff' },
  { value: 'recomendacao_estetica',       label: 'Recomendação Estética',        cor: '#db2777', bg: '#fdf2f8' },
  { value: 'outro',                       label: 'Outro',                        cor: '#6b7280', bg: '#f9fafb' },
];

const VARIAVEIS_DISPONIVEIS = [
  { key: '{{nome_paciente}}',     desc: 'Nome do paciente' },
  { key: '{{data}}',              desc: 'Data de hoje' },
  { key: '{{procedimento}}',      desc: 'Procedimento realizado' },
  { key: '{{profissional}}',      desc: 'Nome do profissional' },
  { key: '{{proxima_consulta}}',  desc: 'Data da próxima consulta' },
];

function getCategoriaInfo(cat: TemplateCategoria) {
  return CATEGORIAS.find(c => c.value === cat) ?? CATEGORIAS[4];
}

function detectarVariaveis(conteudo: string): string[] {
  const matches = conteudo.match(/\{\{[\w_]+\}\}/g) ?? [];
  return [...new Set(matches)];
}

function formatarData(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const INITIAL_FORM = {
  nome: '',
  categoria: 'prescricao' as TemplateCategoria,
  conteudo: '',
  compartilhado: false,
  permissaoEdicao: 'somente_criador' as TemplatePermissaoEdicao,
};

export const TemplatesPrescricoes: React.FC<Props> = ({ userId, userName }) => {
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState<PrescricaoTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingTemplate, setEditingTemplate] = useState<PrescricaoTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Library filters
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('');

  // Form state
  const [form, setForm] = useState(INITIAL_FORM);
  const [formPreview, setFormPreview] = useState(false);

  // Version history
  const [versoes, setVersoes] = useState<PrescricaoTemplateVersao[]>([]);
  const [showVersoes, setShowVersoes] = useState(false);
  const [loadingVersoes, setLoadingVersoes] = useState(false);

  useEffect(() => {
    if (expanded && templates.length === 0) loadTemplates();
  }, [expanded]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getPrescricaoTemplates(userId);
      setTemplates(data);
    } catch {
      setError('Erro ao carregar templates.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = !search || t.nome.toLowerCase().includes(search.toLowerCase());
      const matchCat = !filterCat || t.categoria === filterCat;
      return matchSearch && matchCat;
    });
  }, [templates, search, filterCat]);

  const openCreate = () => {
    setEditingTemplate(null);
    setForm(INITIAL_FORM);
    setFormPreview(false);
    setVersoes([]);
    setShowVersoes(false);
    setError(null);
    setView('form');
  };

  const openEdit = async (t: PrescricaoTemplate) => {
    setEditingTemplate(t);
    setForm({
      nome:           t.nome,
      categoria:      t.categoria,
      conteudo:       t.conteudo,
      compartilhado:  t.compartilhado,
      permissaoEdicao: t.permissaoEdicao,
    });
    setFormPreview(false);
    setVersoes([]);
    setShowVersoes(false);
    setError(null);
    setView('form');
  };

  const handleLoadVersoes = async () => {
    if (!editingTemplate) return;
    setLoadingVersoes(true);
    try {
      const data = await api.getPrescricaoTemplateVersoes(editingTemplate.id, userId);
      setVersoes(data);
      setShowVersoes(true);
    } catch {
      setError('Erro ao carregar histórico.');
    } finally {
      setLoadingVersoes(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.conteudo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const variaveis = detectarVariaveis(form.conteudo);
      if (editingTemplate) {
        const updated = await api.updatePrescricaoTemplate(
          editingTemplate.id,
          { ...form, variaveis },
          userName || 'Profissional',
          userId
        );
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await api.createPrescricaoTemplate(
          { ...form, variaveis, criadoPorNome: userName || 'Profissional' },
          userId
        );
        setTemplates(prev => [created, ...prev]);
      }
      setView('list');
    } catch {
      setError('Erro ao salvar template. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId !== id) { setDeletingId(id); return; }
    try {
      await api.deletePrescricaoTemplate(id, userId);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Erro ao excluir template.');
    } finally {
      setDeletingId(null);
    }
  };

  const variaveis = detectarVariaveis(form.conteudo);
  const previewConteudo = form.conteudo
    .replace(/\{\{nome_paciente\}\}/g, 'Maria Silva')
    .replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'))
    .replace(/\{\{procedimento\}\}/g, 'Botox Frontal')
    .replace(/\{\{profissional\}\}/g, userName || 'Dra. Ana')
    .replace(/\{\{proxima_consulta\}\}/g, '15/07/2026');

  return (
    <div className="card" style={{ padding: '32px' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Templates de Prescrições</h3>
          {templates.length > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 400 }}>
              ({templates.length})
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>

      {!expanded && (
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
          Crie e reutilize templates de prescrições, orientações pós-procedimento e recomendações clínicas.
        </p>
      )}

      {expanded && (
        <div style={{ marginTop: '24px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
              {error}
              <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── VIEW: LIBRARY ── */}
          {view === 'list' && (
            <>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: '32px', fontSize: '13px' }}
                    placeholder="Buscar template..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="form-input"
                  style={{ fontSize: '13px', minWidth: '180px' }}
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {CATEGORIAS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} onClick={openCreate}>
                  <Plus size={14} />
                  Novo Template
                </button>
              </div>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                  Carregando templates...
                </div>
              )}

              {/* Empty state */}
              {!loading && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 24px', border: '1.5px dashed var(--color-border)', borderRadius: '12px' }}>
                  <FileText size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                    {search || filterCat ? 'Nenhum template encontrado' : 'Nenhum template criado ainda'}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                    {search || filterCat
                      ? 'Tente ajustar os filtros de busca.'
                      : 'Crie templates reutilizáveis para agilizar a documentação clínica.'}
                  </p>
                  {!search && !filterCat && (
                    <button className="btn btn-primary" onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={14} /> Criar Primeiro Template
                    </button>
                  )}
                </div>
              )}

              {/* Template grid */}
              {!loading && filtered.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {filtered.map(t => {
                    const catInfo = getCategoriaInfo(t.categoria);
                    return (
                      <div
                        key={t.id}
                        style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '16px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '8px' }}
                      >
                        {/* Category badge + shared indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: catInfo.cor, background: catInfo.bg, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${catInfo.cor}22` }}>
                            {catInfo.label}
                          </span>
                          {t.compartilhado && (
                            <span title="Template compartilhado com a clínica" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              <Share2 size={11} /> Compartilhado
                            </span>
                          )}
                        </div>

                        {/* Nome */}
                        <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                          {t.nome}
                        </p>

                        {/* Conteúdo preview */}
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {t.conteudo || '—'}
                        </p>

                        {/* Stats */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <FileText size={11} /> {t.usoCount}× usado
                          </span>
                          {t.ultimoUsoEm && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={11} /> {formatarData(t.ultimoUsoEm)}
                            </span>
                          )}
                        </div>

                        {/* Criado por (shared templates) */}
                        {t.compartilhado && t.criadoPorNome && (
                          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            Por {t.criadoPorNome}
                          </p>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <button
                            className="btn btn-outline"
                            style={{ flex: 1, fontSize: '12px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                            onClick={() => openEdit(t)}
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${deletingId === t.id ? '#dc2626' : 'var(--color-border)'}`,
                              background: deletingId === t.id ? '#fef2f2' : '#fff',
                              color: deletingId === t.id ? '#dc2626' : 'var(--color-text-muted)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            onClick={() => handleDelete(t.id)}
                            title={deletingId === t.id ? 'Clique novamente para confirmar' : 'Excluir template'}
                          >
                            {deletingId === t.id ? <><Check size={12} /> Confirmar</> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── VIEW: FORM (CREATE / EDIT) ── */}
          {view === 'form' && (
            <form onSubmit={handleSave}>
              {/* Form header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 600 }}>
                  {editingTemplate ? 'Editar Template' : 'Novo Template'}
                </h4>
                <button type="button" onClick={() => setView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Nome */}
              <div className="form-group">
                <label className="form-label">Nome do Template *</label>
                <input
                  className="form-input"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Orientações pós-botox"
                  required
                />
              </div>

              {/* Categoria */}
              <div className="form-group">
                <label className="form-label">Categoria *</label>
                <select
                  className="form-input"
                  value={form.categoria}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value as TemplateCategoria }))}
                >
                  {CATEGORIAS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Variáveis disponíveis */}
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  Variáveis disponíveis (clique para inserir):
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {VARIAVEIS_DISPONIVEIS.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      title={v.desc}
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', color: '#374151', fontFamily: 'monospace' }}
                      onClick={() => setForm(f => ({ ...f, conteudo: f.conteudo + v.key }))}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conteúdo + preview toggle */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Conteúdo *</label>
                  <button
                    type="button"
                    style={{ fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setFormPreview(v => !v)}
                  >
                    {formPreview ? <><EyeOff size={13} /> Editar</> : <><Eye size={13} /> Pré-visualizar</>}
                  </button>
                </div>
                {formPreview ? (
                  <div style={{ background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '14px', fontSize: '13px', lineHeight: 1.7, minHeight: '120px', whiteSpace: 'pre-wrap', color: 'var(--color-text-primary)' }}>
                    {previewConteudo || <span style={{ color: 'var(--color-text-muted)' }}>Conteúdo vazio.</span>}
                  </div>
                ) : (
                  <textarea
                    className="form-textarea"
                    rows={6}
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                    placeholder="Escreva o conteúdo do template. Use variáveis como {{nome_paciente}}, {{data}}, {{procedimento}}, {{profissional}}, {{proxima_consulta}}."
                    value={form.conteudo}
                    onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
                    required
                  />
                )}
              </div>

              {/* Variáveis detectadas */}
              {variaveis.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Variáveis detectadas:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {variaveis.map(v => {
                      const info = VARIAVEIS_DISPONIVEIS.find(x => x.key === v);
                      return (
                        <span key={v} title={info?.desc} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontFamily: 'monospace' }}>
                          {v}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compartilhamento */}
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.compartilhado}
                      onChange={e => setForm(f => ({ ...f, compartilhado: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Compartilhar com toda a clínica</span>
                  </label>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', marginLeft: '26px' }}>
                    Todos os profissionais poderão visualizar e usar este template.
                  </p>
                </div>
              </div>

              {form.compartilhado && (
                <div className="form-group">
                  <label className="form-label">Permissão de Edição</label>
                  <select
                    className="form-input"
                    value={form.permissaoEdicao}
                    onChange={e => setForm(f => ({ ...f, permissaoEdicao: e.target.value as TemplatePermissaoEdicao }))}
                  >
                    <option value="somente_criador">Somente o criador pode editar</option>
                    <option value="qualquer_profissional">Qualquer profissional pode editar</option>
                  </select>
                </div>
              )}

              {/* Histórico de versões (edit only) */}
              {editingTemplate && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    style={{ fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={showVersoes ? () => setShowVersoes(false) : handleLoadVersoes}
                  >
                    <History size={13} />
                    {loadingVersoes ? 'Carregando...' : showVersoes ? 'Ocultar histórico' : 'Ver histórico de versões'}
                  </button>
                  {showVersoes && (
                    <div style={{ marginTop: '10px', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                      {versoes.length === 0 ? (
                        <p style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Nenhuma edição anterior registrada.</p>
                      ) : (
                        versoes.map((v, i) => (
                          <div key={v.id} style={{ padding: '12px 16px', borderBottom: i < versoes.length - 1 ? '1px solid var(--color-border)' : 'none', background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                Versão {v.versao}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                {v.editadoPorNome} · {formatarData(v.editadoEm)}
                              </span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                              {v.conteudoAnterior}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Form actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  {saving ? 'Salvando...' : editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setView('list')}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
