import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, DoorOpen, Check, X, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { ApiError } from '../lib/errors';
import type { Sala, UserRole } from '../types';

interface SalasProps {
  userId: string;
  userRole: UserRole;
}

type SortField = 'nome' | 'createdAt';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'todas' | 'ativa' | 'inativa';

interface ModalState {
  open: boolean;
  sala: Sala | null;
}

const EMPTY_FORM = { nome: '', descricao: '' };

export const Salas: React.FC<SalasProps> = ({ userId, userRole }) => {
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todas');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [modal, setModal] = useState<ModalState>({ open: false, sala: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Sala | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isReadOnly = userRole === 'equipe';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSalasAll(userId);
      setSalas(data);
    } catch (err) {
      console.error('Erro ao carregar salas:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModal({ open: true, sala: null });
  };

  const openEdit = (sala: Sala) => {
    setForm({ nome: sala.nome, descricao: sala.descricao ?? '' });
    setFormError('');
    setModal({ open: true, sala });
  };

  const closeModal = () => {
    if (saving) return;
    setModal({ open: false, sala: null });
  };

  const handleSave = async () => {
    const nome = form.nome.trim();
    if (!nome) { setFormError('Nome é obrigatório.'); return; }
    if (nome.length > 100) { setFormError('Nome deve ter no máximo 100 caracteres.'); return; }

    setSaving(true);
    setFormError('');
    try {
      if (modal.sala) {
        const updated = await api.updateSala(modal.sala.id, { nome, descricao: form.descricao }, userId);
        setSalas(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await api.createSala({ nome, descricao: form.descricao }, userId);
        setSalas(prev => [...prev, created]);
      }
      setModal({ open: false, sala: null });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao salvar sala.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (sala: Sala) => {
    try {
      const updated = await api.updateSala(sala.id, { ativo: !sala.ativo }, userId);
      setSalas(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao atualizar sala.';
      alert(msg);
    }
  };

  const openDelete = (sala: Sala) => {
    setDeleteTarget(sala);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteSala(deleteTarget.id, userId);
      setSalas(prev => prev.filter(s => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao deletar sala.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = salas
    .filter(s => {
      if (filterStatus === 'ativa') return s.ativo;
      if (filterStatus === 'inativa') return !s.ativo;
      return true;
    })
    .filter(s => !search || s.nome.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'nome') cmp = a.nome.localeCompare(b.nome, 'pt-BR');
      else cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />;
  };

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--color-primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DoorOpen size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text-main)' }}>
              Salas de Atendimento
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              {salas.filter(s => s.ativo).length} sala{salas.filter(s => s.ativo).length !== 1 ? 's' : ''} ativa{salas.filter(s => s.ativo).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {!isReadOnly && (
          <button
            onClick={openCreate}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', background: 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Nova Sala
          </button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar sala..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 8px 8px 32px',
              border: '1px solid var(--color-border)', borderRadius: 8,
              fontSize: 13, background: 'var(--bg-card)', color: 'var(--color-text-main)',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['todas', 'ativa', 'inativa'] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: '1px solid',
                borderColor: filterStatus === f ? 'var(--color-primary)' : 'var(--color-border)',
                background: filterStatus === f ? 'var(--color-primary-light)' : 'transparent',
                color: filterStatus === f ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              {f === 'todas' ? 'Todas' : f === 'ativa' ? 'Ativas' : 'Inativas'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12,
        border: '1px solid var(--color-border)', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
            Carregando salas...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
            {search || filterStatus !== 'todas'
              ? 'Nenhuma sala encontrada com os filtros aplicados.'
              : 'Nenhuma sala cadastrada. Clique em "+ Nova Sala" para começar.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                <th
                  onClick={() => handleSort('nome')}
                  style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    NOME <SortIcon field="nome" />
                  </span>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  DESCRIÇÃO
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  STATUS
                </th>
                <th
                  onClick={() => handleSort('createdAt')}
                  style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    CRIADA EM <SortIcon field="createdAt" />
                  </span>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sala, idx) => (
                <tr
                  key={sala.id}
                  style={{
                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                    opacity: sala.ativo ? 1 : 0.6,
                  }}
                >
                  <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: sala.ativo ? 'var(--color-primary-light)' : 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <DoorOpen size={14} style={{ color: sala.ativo ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                      </div>
                      {sala.nome}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 220 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {sala.descricao || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                      background: sala.ativo ? 'var(--color-success-light, #dcfce7)' : 'var(--color-bg)',
                      color: sala.ativo ? 'var(--color-success, #16a34a)' : 'var(--color-text-muted)',
                      border: `1px solid ${sala.ativo ? 'var(--color-success-border, #bbf7d0)' : 'var(--color-border)'}`,
                    }}>
                      {sala.ativo ? <Check size={11} /> : <X size={11} />}
                      {sala.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {sala.createdAt
                      ? new Date(sala.createdAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {isReadOnly ? (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Visualização</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* Ativar/Desativar */}
                        <button
                          onClick={() => handleToggleAtivo(sala)}
                          title={sala.ativo ? 'Desativar sala' : 'Reativar sala'}
                          style={{
                            padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            border: '1px solid var(--color-border)',
                            background: 'transparent',
                            color: sala.ativo ? 'var(--color-warning, #d97706)' : 'var(--color-success, #16a34a)',
                            cursor: 'pointer',
                          }}
                        >
                          {sala.ativo ? 'Desativar' : 'Reativar'}
                        </button>
                        {/* Editar */}
                        <button
                          onClick={() => openEdit(sala)}
                          disabled={!sala.ativo}
                          title={!sala.ativo ? 'Reative a sala para editar' : 'Editar sala'}
                          style={{
                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 6, border: '1px solid var(--color-border)',
                            background: 'transparent', cursor: sala.ativo ? 'pointer' : 'not-allowed',
                            color: sala.ativo ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                            opacity: sala.ativo ? 1 : 0.5,
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        {/* Deletar */}
                        <button
                          onClick={() => openDelete(sala)}
                          title="Deletar sala"
                          style={{
                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 6, border: '1px solid var(--color-border)',
                            background: 'transparent', cursor: 'pointer',
                            color: 'var(--color-warning, #d97706)',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal criar / editar */}
      {modal.open && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 14,
              border: '1px solid var(--color-border)',
              padding: 28, width: '100%', maxWidth: 460,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-main)' }}>
              {modal.sala ? 'Editar Sala' : 'Nova Sala'}
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 6 }}>
                Nome <span style={{ color: 'var(--color-warning)' }}>*</span>
              </label>
              <input
                type="text"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Sala Botox, Cabine 01..."
                maxLength={100}
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px',
                  border: `1px solid ${formError && !form.nome.trim() ? 'var(--color-warning)' : 'var(--color-border)'}`,
                  borderRadius: 8, fontSize: 14,
                  background: 'var(--color-bg)', color: 'var(--color-text-main)',
                  boxSizing: 'border-box',
                }}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {form.nome.length}/100
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 6 }}>
                Descrição <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Sala para procedimentos a laser, equipamentos disponíveis..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--color-border)', borderRadius: 8,
                  fontSize: 14, background: 'var(--color-bg)', color: 'var(--color-text-main)',
                  resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>

            {formError && (
              <div style={{
                marginBottom: 16, padding: '10px 12px', borderRadius: 8,
                background: 'var(--color-warning-light, #fef3c7)',
                border: '1px solid var(--color-warning-border, #fde68a)',
                color: 'var(--color-warning, #d97706)', fontSize: 13,
              }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                disabled={saving}
                style={{
                  padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-main)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  border: 'none', background: 'var(--color-primary)', color: '#fff',
                  cursor: saving ? 'wait' : 'pointer', minWidth: 80,
                }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar deleção */}
      {deleteTarget && (
        <div
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 14,
              border: '1px solid var(--color-border)',
              padding: 28, width: '100%', maxWidth: 420,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--color-warning-light, #fef3c7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Trash2 size={20} style={{ color: 'var(--color-warning, #d97706)' }} />
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-main)' }}>
                Deletar sala?
              </h2>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Tem certeza que deseja deletar a sala <strong style={{ color: 'var(--color-text-main)' }}>{deleteTarget.nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-muted)' }}>
              Salas com agendamentos ativos não podem ser deletadas.
            </p>

            {deleteError && (
              <div style={{
                marginBottom: 16, padding: '10px 12px', borderRadius: 8,
                background: 'var(--color-warning-light, #fef3c7)',
                border: '1px solid var(--color-warning-border, #fde68a)',
                color: 'var(--color-warning, #d97706)', fontSize: 13,
              }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-main)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  border: 'none', background: 'var(--color-warning, #d97706)', color: '#fff',
                  cursor: deleting ? 'wait' : 'pointer', minWidth: 80,
                }}
              >
                {deleting ? 'Deletando...' : 'Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
