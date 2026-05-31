import React, { useEffect, useState } from 'react';
import type { Room } from '../types';
import { api } from '../lib/api';
import { Plus, Pencil, Trash2, DoorOpen, AlertTriangle } from 'lucide-react';

interface GerenciamentoSalasProps {
  userId: string;
}

type StatusFiltro = 'todas' | 'ativa' | 'inativa';
type ModalMode = 'criar' | 'editar' | null;

export const GerenciamentoSalas: React.FC<GerenciamentoSalasProps> = ({ userId }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todas');

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getRooms(userId);
      setRooms(data);
    } catch {
      // silent — empty list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const openCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormError(null);
    setEditingRoom(null);
    setModalMode('criar');
  };

  const openEdit = (room: Room) => {
    setFormName(room.name);
    setFormDescription(room.description ?? '');
    setFormError(null);
    setEditingRoom(room);
    setModalMode('editar');
  };

  const closeModal = () => { setModalMode(null); setEditingRoom(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { setFormError('O nome da sala é obrigatório.'); return; }
    if (formName.trim().length > 100) { setFormError('Nome deve ter no máximo 100 caracteres.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (modalMode === 'criar') {
        const room = await api.createRoom({ name: formName, description: formDescription }, userId);
        setRooms((prev) => [...prev, room].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      } else if (editingRoom) {
        const room = await api.updateRoom(editingRoom.id, { name: formName, description: formDescription }, userId);
        setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      }
      closeModal();
    } catch (err: any) {
      setFormError(err?.message ?? 'Erro ao salvar sala.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (room: Room) => {
    const novoStatus = room.status === 'ativa' ? 'inativa' : 'ativa';
    try {
      const updated = await api.updateRoom(room.id, { status: novoStatus }, userId);
      setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao alterar status da sala.');
    }
  };

  const handleDelete = async (room: Room) => {
    if (!confirm(`Deseja deletar permanentemente a sala "${room.name}"?`)) return;
    setDeleteError(null);
    try {
      await api.deleteRoom(room.id, userId);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch (err: any) {
      setDeleteError(err?.message ?? 'Erro ao deletar sala.');
    }
  };

  const filtered = rooms.filter((r) => statusFiltro === 'todas' || r.status === statusFiltro);

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--color-text-main)', marginBottom: '6px' }}>
            Salas de Atendimento
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Gerencie as salas da clínica para associar a agendamentos.
          </p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={openCreate}>
          <Plus size={15} /> Nova Sala
        </button>
      </div>

      {deleteError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 'var(--border-radius-md)', marginBottom: '16px', fontSize: '13px' }}>
          <AlertTriangle size={16} />
          {deleteError}
          <button onClick={() => setDeleteError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {(['todas', 'ativa', 'inativa'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFiltro(s)}
              className={statusFiltro === s ? 'btn btn-primary' : 'btn btn-outline'}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              {s === 'todas' ? 'Todas' : s === 'ativa' ? 'Ativas' : 'Inativas'}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Carregando salas…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <DoorOpen size={40} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '6px' }}>
              {rooms.length === 0 ? 'Nenhuma sala cadastrada' : 'Nenhuma sala com este filtro'}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {rooms.length === 0 ? 'Clique em "+ Nova Sala" para começar.' : 'Tente mudar o filtro de status.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['Nome', 'Descrição', 'Status', 'Criada em', 'Ações'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((room) => (
                  <tr key={room.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>{room.name}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{room.description || '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => handleToggleStatus(room)}
                        title="Clique para alternar status"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <span className={room.status === 'ativa' ? 'badge badge-sage' : 'badge badge-neutral'}>
                          {room.status === 'ativa' ? 'Ativa' : 'Inativa'}
                        </span>
                      </button>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(room.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openEdit(room)}
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Editar"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(room)}
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '11px', borderColor: '#E53E3E', color: '#E53E3E', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Deletar"
                        >
                          <Trash2 size={12} /> Deletar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modalMode && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '440px', width: '92%', padding: '32px' }}>
            <h3 style={{ marginBottom: '20px' }}>{modalMode === 'criar' ? 'Nova Sala' : 'Editar Sala'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nome da Sala <span style={{ color: '#E53E3E' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Cabine Botox"
                  maxLength={100}
                  required
                  autoFocus
                />
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {formName.length}/100 caracteres
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ex: Sala para procedimentos injetáveis"
                />
              </div>

              {formError && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 'var(--border-radius-sm)', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={14} /> {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={closeModal} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando…' : modalMode === 'criar' ? 'Criar Sala' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
