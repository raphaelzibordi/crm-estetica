import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Agenda } from './components/Agenda';
import { Prontuario } from './components/Prontuario';
import { Comunicacao } from './components/Comunicacao';
import { Gestao } from './components/Gestao';
import { Auth } from './components/Auth';
import { Configuracoes } from './components/Configuracoes';
import type { Agendamento, StatusJornada } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { api } from './lib/api';
import { ApiError, isUnauthorized } from './lib/errors';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);


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
  const handleUpdateStatus = async (
    id: string,
    newStatus: StatusJornada,
    extras?: { metodoPagamento?: Agendamento['metodoPagamento'] }
  ) => {
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
        } else if (newStatus === 'finalizada' && extras?.metodoPagamento) {
          updated.metodoPagamento = extras.metodoPagamento;
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
      if (newStatus === 'finalizada' && extras?.metodoPagamento) {
        updates.metodoPagamento = extras.metodoPagamento;
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
  const handleAddAgendamento = async (
    newAgendamento: Omit<Agendamento, 'id'>,
    extra?: { telefone?: string }
  ) => {
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
            telefone: extra?.telefone || '',
            email: '',
            dataNascimento: '',
            fotoUrl: '',
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

      // Recarrega só se o agendamento criado for para HOJE (o dashboard só mostra hoje)
      const hoje = new Date().toISOString().split('T')[0];
      if (newAgendamento.data === hoje) {
        await loadAgendamentosDoDia();
      }
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

  const handleDeleteAgendamento = async (id: string) => {
    if (!session?.user?.id) return;
    try {
      await api.deleteAgendamento(id, session.user.id);
      await loadAgendamentosDoDia();
    } catch (err) {
      console.error('Erro ao deletar agendamento:', err);
      const msg = err instanceof ApiError ? err.message : 'Erro ao deletar agendamento.';
      alert(msg);
      await handleUnauthorized(err);
    }
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
    <div className="app-container">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} userName={userName} />

      <main className="main-content">

        {currentTab === 'dashboard' && (
          <Dashboard
            agendamentos={agendamentos}
            onUpdateStatus={handleUpdateStatus}
            onOpenProntuario={handleOpenProntuario}
            onAddAgendamento={handleAddAgendamento}
            onDeleteAgendamento={handleDeleteAgendamento}
            userId={session.user.id}
            userName={userName}
          />
        )}

        {currentTab === 'agenda' && (
          <Agenda
            userId={session.user.id}
            userName={userName}
            agendamentos={agendamentos}
            onAddAgendamento={handleAddAgendamento}
            onDeleteAgendamento={handleDeleteAgendamento}
            onOpenProntuario={handleOpenProntuario}
          />
        )}

        {currentTab === 'prontuario' && (
          <Prontuario selectedClienteId={selectedClienteId} userId={session.user.id} />
        )}

        {currentTab === 'comunicacao' && <Comunicacao userId={session.user.id} />}

        {currentTab === 'gestao' && <Gestao userId={session.user.id} />}

        {currentTab === 'configuracoes' && (
          <Configuracoes userId={session.user.id} userName={userName} />
        )}
      </main>
    </div>
  );
}

export default App;
