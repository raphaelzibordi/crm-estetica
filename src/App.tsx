import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Agenda } from './components/Agenda';
import { Prontuario } from './components/Prontuario';
import { Comunicacao } from './components/Comunicacao';
import { Gestao } from './components/Gestao';
import { Auth } from './components/Auth';
import { Configuracoes } from './components/Configuracoes';
import { WelcomeModal } from './components/WelcomeModal';
import type { Agendamento, StatusJornada, UserRole } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { api } from './lib/api';
import { ApiError, isUnauthorized } from './lib/errors';

// Abas que membros da equipe NÃO podem acessar.
const TABS_BLOQUEADAS_EQUIPE = new Set(['comunicacao', 'gestao', 'configuracoes']);

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Perfil do usuário logado (resolvido após sessão).
  const [userRole, setUserRole]     = useState<UserRole>('dono');
  const [userPhotoUrl, setUserPhotoUrl] = useState('');
  const [userName, setUserName]     = useState('');
  const [userCargo, setUserCargo]   = useState('');
  const [clinicName, setClinicName] = useState('');
  const [tenantId, setTenantId]     = useState<string>(''); // ID usado em todas as chamadas de API
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  // Guarda de rota para membros da equipe: redireciona para 'dashboard' se tentarem
  // acessar aba bloqueada (inclusive via setCurrentTab direto).
  const setCurrentTabSafe = useCallback((tab: string) => {
    if (userRole === 'equipe' && TABS_BLOQUEADAS_EQUIPE.has(tab)) return;
    setCurrentTab(tab);
  }, [userRole]);

  // Evita loop: só busca perfil quando session.user.id muda.
  const lastProfileUid = useRef<string | null>(null);

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

        if (event === 'SIGNED_OUT' || (!nextSession && event !== 'INITIAL_SESSION')) {
          setAgendamentos([]);
          setSelectedClienteId(null);
          setCurrentTab('dashboard');
          setUserRole('dono');
          setUserPhotoUrl('');
          setUserName('');
          setUserCargo('');
          setClinicName('');
          setTenantId('');
          setShowWelcomeModal(false);
          sessionStorage.removeItem('lumina_welcome_shown');
          lastProfileUid.current = null;
        }
      });
      unsub = () => data.subscription.unsubscribe();
    })();

    return () => unsub();
  }, []);

  // ============================================================
  // Carga do perfil do usuário (role, foto, nome, tenantId)
  // ============================================================
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || lastProfileUid.current === uid) return;
    lastProfileUid.current = uid;

    (async () => {
      try {
        const profile = await api.getUserProfile(uid);
        setUserRole(profile.role);
        setUserPhotoUrl(profile.fotoUrl);
        setTenantId(profile.tenantId);
        // Prioridade: nome do perfil > metadata do auth > fallback
        setUserName(
          profile.nome ||
          (session.user.user_metadata as any)?.nome_clinica ||
          'Lumina'
        );
        // Clinic name: for dono it's their own nome_clinica; for equipe it's the owner's.
        // Fall back to auth metadata so it's available even before the profile row is written.
        setClinicName(
          profile.nomeClinica ||
          (session.user.user_metadata as any)?.nome_clinica ||
          ''
        );
        if (profile.role === 'equipe') {
          setUserCargo(profile.cargo ?? '');
          // Show welcome modal once per browser session (cleared on logout).
          if (!sessionStorage.getItem('lumina_welcome_shown')) {
            setShowWelcomeModal(true);
          }
        }
        // Membro da equipe na aba bloqueada: redireciona.
        if (profile.role === 'equipe' && TABS_BLOQUEADAS_EQUIPE.has(currentTab)) {
          setCurrentTab('dashboard');
        }
      } catch (err) {
        console.error('[Lumina] Erro ao carregar perfil:', err);
        // Fallback seguro: trata como dono sem foto
        setTenantId(uid);
        setUserName((session.user.user_metadata as any)?.nome_clinica || 'Lumina');
      }
    })();
  }, [session?.user?.id, currentTab]);

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
    if (!tenantId) return;
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const data = await api.getAgendamentos(tenantId, hoje);
      setAgendamentos(data);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
      await handleUnauthorized(err);
    }
  }, [tenantId, handleUnauthorized]);

  useEffect(() => {
    if (tenantId) loadAgendamentosDoDia();
  }, [tenantId, loadAgendamentosDoDia]);

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
      await api.updateAgendamentoStatus(id, updates, tenantId || session?.user.id);
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
    if (!tenantId) return;
    try {
      let finalClienteId = newAgendamento.clienteId;

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
          tenantId
        );
        finalClienteId = novoCliente.id;
      }

      await api.createAgendamento({ ...newAgendamento, clienteId: finalClienteId }, tenantId);

      const hoje = new Date().toISOString().split('T')[0];
      if (newAgendamento.data === hoje) await loadAgendamentosDoDia();
    } catch (err) {
      console.error('Erro ao criar agendamento:', err);
      if (err instanceof ApiError && err.code === 'AGENDAMENTO_CONFLITO') {
        throw err; // Let the calling component display the conflict modal
      }
      const msg = err instanceof ApiError ? err.message : 'Erro ao criar agendamento no banco.';
      alert(msg);
      await handleUnauthorized(err);
    }
  };

  const handleOpenProntuario = (clienteId: string) => {
    setSelectedClienteId(clienteId);
    setCurrentTab('prontuario');
  };

  const handleUpdateAgendamentoDados = async (
    id: string,
    updates: { horaInicio?: string; horaFim?: string; procedimento?: string; profissional?: string }
  ) => {
    setAgendamentos((prev) =>
      prev.map((a) => (a.id !== id ? a : { ...a, ...updates }))
    );
    try {
      await api.updateAgendamentoDados(id, updates, tenantId || session?.user.id);
    } catch (err) {
      console.error('Erro ao atualizar dados do agendamento:', err);
      const msg = err instanceof ApiError ? err.message : 'Falha ao atualizar o atendimento.';
      alert(msg);
      loadAgendamentosDoDia();
      await handleUnauthorized(err);
    }
  };

  const handleDeleteAgendamento = async (id: string) => {
    if (!tenantId) return;
    try {
      await api.deleteAgendamento(id, tenantId);
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

  // Enquanto o perfil ainda não foi resolvido após login, usa o tenantId = user.id
  const effectiveTenantId = tenantId || session.user.id;

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTabSafe}
        userName={userName}
        userPhotoUrl={userPhotoUrl}
        userRole={userRole}
        userCargo={userCargo}
        clinicName={clinicName}
      />

      <main className="main-content">

        {currentTab === 'dashboard' && (
          <Dashboard
            agendamentos={agendamentos}
            onUpdateStatus={handleUpdateStatus}
            onUpdateAgendamentoDados={handleUpdateAgendamentoDados}
            onOpenProntuario={handleOpenProntuario}
            onAddAgendamento={handleAddAgendamento}
            onDeleteAgendamento={handleDeleteAgendamento}
            userId={effectiveTenantId}
            userName={userName}
          />
        )}

        {currentTab === 'agenda' && (
          <Agenda
            userId={effectiveTenantId}
            userName={userName}
            agendamentos={agendamentos}
            onAddAgendamento={handleAddAgendamento}
            onDeleteAgendamento={handleDeleteAgendamento}
            onOpenProntuario={handleOpenProntuario}
          />
        )}

        {currentTab === 'prontuario' && (
          <Prontuario
            selectedClienteId={selectedClienteId}
            userId={effectiveTenantId}
            onAddAgendamento={handleAddAgendamento}
            userName={userName}
          />
        )}

        {/* Abas restritas: apenas donos chegam aqui (setCurrentTabSafe bloqueia equipe) */}
        {currentTab === 'comunicacao' && userRole === 'dono' && (
          <Comunicacao userId={effectiveTenantId} />
        )}

        {currentTab === 'gestao' && userRole === 'dono' && (
          <Gestao userId={effectiveTenantId} />
        )}

        {currentTab === 'configuracoes' && userRole === 'dono' && (
          <Configuracoes
            userId={session.user.id}
            userName={userName}
            onProfileUpdate={({ nome, fotoUrl }) => {
              if (nome !== undefined) setUserName(nome);
              if (fotoUrl !== undefined) setUserPhotoUrl(fotoUrl);
            }}
          />
        )}
      </main>

      {showWelcomeModal && (
        <WelcomeModal
          userName={userName}
          clinicName={clinicName}
          onClose={() => {
            setShowWelcomeModal(false);
            sessionStorage.setItem('lumina_welcome_shown', '1');
          }}
        />
      )}
    </div>
  );
}

export default App;
