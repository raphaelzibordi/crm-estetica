import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Agenda } from './components/Agenda';
import { Prontuario } from './components/Prontuario';
import { Comunicacao } from './components/Comunicacao';
import { Gestao } from './components/Gestao';
import { Auth } from './components/Auth';
import type { Agendamento, StatusJornada } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { api } from './lib/api';
import { ApiError, isUnauthorized } from './lib/errors';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  // ============================================================
  // GUARDA DE ROTA: bloqueio de acesso sem token válido
  // ============================================================
  useEffect(() => {
    let unsub = () => {};

    (async () => {
      try {
        const {
          data: { session: current },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          console.error('[Lumina] Falha ao recuperar sessão:', error.message);
        }
        setSession(current ?? null);
      } catch (err) {
        console.error('[Lumina] Erro inesperado ao validar sessão:', err);
        setSession(null);
      } finally {
        setLoading(false);
      }

      const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
        setSession(nextSession);

        // Sessão revogada / expirada → limpa o estado e força tela de login
        if (event === 'SIGNED_OUT' || (!nextSession && event !== 'INITIAL_SESSION')) {
          setAgendamentos([]);
          setSelectedClienteId(null);
          setCurrentTab('dashboard');
        }
      });
      unsub = () => data.subscription.unsubscribe();
    })();

    return () => unsub();
  }, []);

  // ============================================================
  // Carga inicial de dados quando há sessão válida
  // ============================================================
  const handleUnauthorized = useCallback(async (err: unknown) => {
    if (isUnauthorized(err)) {
      console.warn('[Lumina] Sessão expirada — efetuando signOut forçado.');
      await supabase.auth.signOut();
      setSession(null);
    }
  }, []);

  const loadAgendamentosDoDia = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const data = await api.getAgendamentos(session.user.id, hoje);
      setAgendamentos(data);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
      await handleUnauthorized(err);
    }
  }, [session?.user?.id, handleUnauthorized]);

  useEffect(() => {
    if (session?.user?.id) {
      loadAgendamentosDoDia();
    }
  }, [session?.user?.id, loadAgendamentosDoDia]);

  // ============================================================
  // ATUALIZAÇÃO DE STATUS DA JORNADA
  // ============================================================
  const handleUpdateStatus = async (id: string, newStatus: StatusJornada) => {
    const horaAgora = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Atualização otimista
    setAgendamentos((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const updated: Agendamento = { ...a, status: newStatus };
        if (newStatus === 'chegou') {
          updated.horarioChegada = horaAgora;
          updated.tempoEsperaMinutos = 0;
        } else if (newStatus === 'atendimento') {
          updated.tempoEsperaMinutos = a.tempoEsperaMinutos ?? 10;
        }
        return updated;
      })
    );

    try {
      const updates: Partial<Agendamento> = { status: newStatus };
      if (newStatus === 'chegou') {
        updates.horarioChegada = horaAgora;
        updates.tempoEsperaMinutos = 0;
      }
      await api.updateAgendamentoStatus(id, updates, session?.user.id);
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      const msg = err instanceof ApiError ? err.message : 'Falha ao atualizar o status.';
      alert(msg);
      // Reverte estado em caso de falha
      loadAgendamentosDoDia();
      await handleUnauthorized(err);
    }
  };

  // ============================================================
  // CRIAÇÃO DE AGENDAMENTO
  // ============================================================
  const handleAddAgendamento = async (newAgendamento: Omit<Agendamento, 'id'>) => {
    if (!session?.user?.id) return;
    try {
      let finalClienteId = newAgendamento.clienteId;

      // IDs temporários (`c123`, `c_temp`) significam que o cliente
      // foi criado em runtime no front e ainda não existe no banco.
      const isTempId =
        !finalClienteId ||
        finalClienteId.startsWith('c_') ||
        /^c\d+$/.test(finalClienteId);

      if (isTempId) {
        const novoCliente = await api.createCliente(
          {
            nome: newAgendamento.clienteNome,
            telefone: '(00) 00000-0000',
            email: '',
            dataNascimento: '',
            fotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
            dataUltimaVisita: new Date().toISOString().split('T')[0],
            statusRetencao: 'em_dia',
            tags: [],
          },
          session.user.id
        );
        finalClienteId = novoCliente.id;
      }

      await api.createAgendamento(
        {
          ...newAgendamento,
          clienteId: finalClienteId,
        },
        session.user.id
      );

      await loadAgendamentosDoDia();
    } catch (err) {
      console.error('Erro ao criar agendamento:', err);
      const msg =
        err instanceof ApiError ? err.message : 'Erro ao criar agendamento no banco.';
      alert(msg);
      await handleUnauthorized(err);
    }
  };

  const handleOpenProntuario = (clienteId: string) => {
    setSelectedClienteId(clienteId);
    setCurrentTab('prontuario');
  };

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================
  if (!isSupabaseConfigured) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text-main)',
          gap: '12px',
        }}
      >
        <strong>Configuração ausente</strong>
        <span style={{ maxWidth: '480px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          As variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> não
          foram encontradas. Configure o arquivo <code>.env</code> e reinicie o servidor.
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: 'var(--color-bg)',
        }}
      >
        Carregando Lumina...
      </div>
    );
  }

  // GUARDA DE ROTA: sem sessão válida → tela de login obrigatória
  if (!session || !session.user) {
    return <Auth onLogin={(s) => setSession(s)} />;
  }

  const userName =
    (session.user.user_metadata as { nome_clinica?: string } | undefined)?.nome_clinica ||
    'Lumina Clinics';

  return (
    <div className={`app-container ${darkMode ? 'dark-theme' : ''}`}>
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} userName={userName} />

      <main className="main-content" style={{ position: 'relative' }}>
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            position: 'absolute',
            top: '24px',
            right: '32px',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            cursor: 'pointer',
            zIndex: 100,
            color: 'var(--color-text-main)',
          }}
        >
          {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>

        {currentTab === 'dashboard' && (
          <Dashboard
            agendamentos={agendamentos}
            onUpdateStatus={handleUpdateStatus}
            onOpenProntuario={handleOpenProntuario}
            onAddAgendamento={handleAddAgendamento}
            userName={userName}
          />
        )}

        {currentTab === 'agenda' && (
          <Agenda agendamentos={agendamentos} onAddAgendamento={handleAddAgendamento} />
        )}

        {currentTab === 'prontuario' && (
          <Prontuario selectedClienteId={selectedClienteId} userId={session.user.id} />
        )}

        {currentTab === 'comunicacao' && <Comunicacao userId={session.user.id} />}

        {currentTab === 'gestao' && <Gestao userId={session.user.id} />}
      </main>
    </div>
  );
}

export default App;
