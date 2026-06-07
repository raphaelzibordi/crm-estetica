import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Agenda } from './components/Agenda';
import { Prontuario } from './components/Prontuario';
import { Comunicacao } from './components/Comunicacao';
import { CRM } from './components/CRM';
import { Orcamentos } from './components/Orcamentos';
import { CRCCentral } from './components/CRCCentral';
import { WhatsApp } from './components/WhatsApp';
import { Gestao } from './components/Gestao';
import { Auth } from './components/Auth';
import { Configuracoes } from './components/Configuracoes';
import { WelcomeModal } from './components/WelcomeModal';
import { PlanoModal, type PlanoBilling, type PeriodicidadeBilling } from './components/PlanoModal';
import { PagamentoPendenteModal } from './components/PagamentoPendenteModal';
import { AgendamentoPublico } from './components/AgendamentoPublico';
import { AssinaturaPublica } from './components/AssinaturaPublica';
import { GaleriaPublica } from './components/GaleriaPublica';
import { LGPD } from './components/LGPD';
import { GerenciamentoSalas } from './components/GerenciamentoSalas';
import { CalendarioSalas } from './components/CalendarioSalas';
import { DefinirSenha } from './components/DefinirSenha';
import type { Agendamento, StatusJornada, UserRole, Unidade, Permissoes } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { api } from './lib/api';
import { ApiError, isUnauthorized } from './lib/errors';

// Detecta se a URL atual é uma página pública de agendamento (/agenda/:slug)
function getPublicBookingSlug(): string | null {
  const match = window.location.pathname.match(/^\/agenda\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Detecta se a URL atual é uma página pública de assinatura (/assinar/:token)
function getPublicSigningToken(): string | null {
  const match = window.location.pathname.match(/^\/assinar\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

// Detecta se a URL atual é uma galeria compartilhada (/galeria/:token)
function getPublicGaleriaToken(): string | null {
  const match = window.location.pathname.match(/^\/galeria\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

// Detecta se a URL atual é a rota de definição de senha (/definir-senha)
function isDefinirSenhaPath(): boolean {
  return window.location.pathname === '/definir-senha';
}

// Abas que membros da equipe NÃO podem acessar.
const TABS_BLOQUEADAS_EQUIPE = new Set(['comunicacao', 'gestao', 'configuracoes', 'lgpd']);

// Roteador raiz: delega para página pública ou app autenticado.
function App() {
  const publicSlug = getPublicBookingSlug();
  if (publicSlug) return <AgendamentoPublico slug={publicSlug} />;
  const signingToken = getPublicSigningToken();
  if (signingToken) return <AssinaturaPublica token={signingToken} />;
  const galeriaToken = getPublicGaleriaToken();
  if (galeriaToken) return <GaleriaPublica token={galeriaToken} />;
  return <AppMain />;
}

// Rota pública de primeiro acesso: renderizada dentro de AppMain via estado recoveryMode.
// O componente DefinirSenha é exibido quando o Supabase detecta um token de recovery na URL.

function AppMain() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Inicia como true apenas para /definir-senha direto.
  // Quando vem do link (hash tokens), aguarda setSession concluir antes de ativar.
  const [recoveryMode, setRecoveryMode] = useState(() => isDefinirSenhaPath());

  // Perfil do usuário logado (resolvido após sessão).
  const [userRole, setUserRole]           = useState<UserRole>('dono');
  const [userPhotoUrl, setUserPhotoUrl]   = useState('');
  const [userName, setUserName]           = useState('');
  const [userCargo, setUserCargo]         = useState('');
  const [clinicName, setClinicName]       = useState('');
  const [tenantId, setTenantId]           = useState<string>('');
  const [userPermissoes, setUserPermissoes] = useState<Permissoes | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Cobrança: modal de escolha de plano (fim de trial sem ativação ou renovação anual próxima)
  const [billingModalMotivo, setBillingModalMotivo] = useState<'trial_expirado' | 'renovacao_anual' | null>(null);
  const [billingDiasRestantes, setBillingDiasRestantes] = useState<number | null>(null);
  const [billingModalDismissed, setBillingModalDismissed] = useState(false);

  // Cobrança: modal de pagamento em atraso / assinatura suspensa (T1.6)
  const [paymentIssue, setPaymentIssue] = useState<{
    status: 'past_due' | 'suspended';
    diasAtraso: number | null;
    tentativas: number;
    suspensoEm: Date | null;
    plano: PlanoBilling;
    periodicidade: PeriodicidadeBilling;
  } | null>(null);
  const [paymentIssueDismissed, setPaymentIssueDismissed] = useState(false);

  // US-048: Multiclínicas
  const [redeUnidades, setRedeUnidades]       = useState<Unidade[]>([]);
  const [redes, setRedes]                     = useState<import('./types').Rede[]>([]);
  const [currentUnidadeId, setCurrentUnidadeId] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [onlineBookingAlert, setOnlineBookingAlert] = useState<string | null>(null);

  // Guarda de rota: para equipe com perfil usa permissões dinâmicas; sem perfil usa fallback.
  const setCurrentTabSafe = useCallback((tab: string) => {
    if (userRole === 'equipe') {
      if (userPermissoes) {
        if (!userPermissoes[tab]?.ver) return;
      } else {
        if (TABS_BLOQUEADAS_EQUIPE.has(tab)) return;
      }
    }
    if (tab === 'prontuario') setSelectedClienteId(null);
    setCurrentTab(tab);
  }, [userRole, userPermissoes]);

  // Evita loop: só busca perfil quando session.user.id muda.
  const lastProfileUid = useRef<string | null>(null);

  // ============================================================
  // RECOVERY VIA HASH (implicit flow do Admin API vs PKCE do SDK)
  // O generateLink da Admin API sempre emite tokens no hash (#access_token=...).
  // Com flowType:'pkce' o SDK ignora esses tokens — precisamos chamar setSession
  // manualmente para que DefinirSenha encontre a sessão via getSession().
  // ============================================================
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (type === 'recovery' && accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (!error) {
            window.history.replaceState(null, '', window.location.pathname);
            setRecoveryMode(true);
          }
        });
    }
  }, []);

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
        if (event === 'PASSWORD_RECOVERY') {
          setSession(nextSession);
          setRecoveryMode(true);
          window.history.replaceState(null, '', '/definir-senha');
          return;
        }

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
          setUserPermissoes(null);
          setShowWelcomeModal(false);
          setBillingModalMotivo(null);
          setBillingDiasRestantes(null);
          setBillingModalDismissed(false);
          setRedes([]);
          setRedeUnidades([]);
          setCurrentUnidadeId(null);
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
          setUserPermissoes(profile.permissoes ?? null);
          // Show welcome modal once per browser session (cleared on logout).
          if (!sessionStorage.getItem('lumina_welcome_shown')) {
            setShowWelcomeModal(true);
          }
        }
        // Membro da equipe na aba bloqueada: redireciona.
        if (profile.role === 'equipe') {
          const permissoes = profile.permissoes ?? null;
          const bloqueada = permissoes
            ? !permissoes[currentTab]?.ver
            : TABS_BLOQUEADAS_EQUIPE.has(currentTab);
          if (bloqueada) setCurrentTab('dashboard');
        }

        // US-048: carrega redes e unidades do dono
        if (profile.role === 'dono') {
          loadRedeData(profile.tenantId);
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
  // Cobrança: decide se exibe o modal de escolha de plano
  // (trial sem ativação após 30 dias, ou assinatura anual vencendo em até 30 dias)
  // ============================================================
  useEffect(() => {
    if (userRole !== 'dono' || !tenantId) return;

    (async () => {
      try {
        const { data } = await supabase
          .from('usuarios')
          .select('abacatepay_subscription_status, plano, plano_periodicidade, acesso_expira_em, created_at, payment_overdue_since, payment_retry_count, suspended_at')
          .eq('id', tenantId)
          .maybeSingle();
        if (!data) return;

        const status = data.abacatepay_subscription_status as string | null;
        const periodicidade = (data.plano_periodicidade as string | null) ?? 'mensal';
        const expiraEm = data.acesso_expira_em ? new Date(data.acesso_expira_em as string) : null;
        const createdAt = data.created_at ? new Date(data.created_at as string) : null;
        const now = new Date();

        // Pagamento em atraso ou assinatura suspensa: prioridade máxima (T1.6)
        if (status === 'past_due' || status === 'suspended') {
          const overdueSince = data.payment_overdue_since ? new Date(data.payment_overdue_since as string) : null;
          const suspendedAt = data.suspended_at ? new Date(data.suspended_at as string) : null;
          setPaymentIssue({
            status,
            diasAtraso: overdueSince ? Math.floor((now.getTime() - overdueSince.getTime()) / 86400000) : null,
            tentativas: (data.payment_retry_count as number | null) ?? 0,
            suspensoEm: suspendedAt,
            plano: ((data.plano as string | null) ?? 'basico') as PlanoBilling,
            periodicidade: periodicidade as PeriodicidadeBilling,
          });
          return;
        }

        if (status === 'pending' && createdAt) {
          const diasDesdeCadastro = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
          if (diasDesdeCadastro >= 30) {
            setBillingModalMotivo('trial_expirado');
            setBillingDiasRestantes(null);
            return;
          }
        }

        if (periodicidade === 'anual' && status === 'active' && expiraEm) {
          const diasRestantes = Math.ceil((expiraEm.getTime() - now.getTime()) / 86400000);
          if (diasRestantes <= 30) {
            setBillingModalMotivo('renovacao_anual');
            setBillingDiasRestantes(diasRestantes);
          }
        }
      } catch {
        // Informação de cobrança é opcional — falha silenciosa
      }
    })();
  }, [userRole, tenantId]);

  // ============================================================
  // Carga inicial de dados quando há sessão válida
  // ============================================================
  const loadRedeData = useCallback(async (uid?: string) => {
    const id = uid || tenantId;
    if (!id) return;
    try {
      const redesData = await api.getRedes(id);
      setRedes(redesData);
      if (redesData.length > 0) {
        const unidadesAll: Unidade[] = [];
        for (const r of redesData) {
          const us = await api.getUnidades(r.id, id);
          unidadesAll.push(...us);
        }
        setRedeUnidades(unidadesAll);
      } else {
        setRedeUnidades([]);
      }
    } catch {
      // Redes são opcionais — falha silenciosa
    }
  }, [tenantId]);

  const handleUnauthorized = useCallback(async (err: unknown) => {
    if (isUnauthorized(err)) {
      console.warn('[Lumina] Sessão expirada — efetuando signOut forçado.');
      await supabase.auth.signOut();
      setSession(null);
    }
  }, []);

  // Quando há rede, pacienteCompartilhado vem da primeira rede ativa
  const pacienteCompartilhado = redes.length > 0 && redes[0].pacienteCompartilhado;

  const loadAgendamentosDoDia = useCallback(async () => {
    if (!tenantId) return;
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const data = await api.getAgendamentos(tenantId, hoje, currentUnidadeId ?? undefined);
      setAgendamentos(data);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
      await handleUnauthorized(err);
    }
  }, [tenantId, currentUnidadeId, handleUnauthorized]);

  useEffect(() => {
    if (tenantId) loadAgendamentosDoDia();
  }, [tenantId, loadAgendamentosDoDia]);

  // ── Notificação realtime: novo agendamento online ────────────────
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`online-bookings-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agendamentos', filter: `user_id=eq.${tenantId}` },
        (payload) => {
          if ((payload.new as any)?.origem_online) {
            const nome = (payload.new as any)?.profissional ?? '';
            setOnlineBookingAlert(`Novo agendamento online recebido${nome ? ` com ${nome}` : ''}!`);
            loadAgendamentosDoDia();
            setTimeout(() => setOnlineBookingAlert(null), 6000);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      if (newStatus === 'finalizada') {
        const ag = agendamentos.find(a => a.id === id);
        if (ag?.procedimento) {
          api.baixarEstoqueCheckout(
            id,
            ag.procedimento,
            ag.profissional || '',
            tenantId || session?.user.id || '',
          ).catch(err => console.warn('[estoque] Baixa automática falhou:', err));
        }
      }
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
    updates: { horaInicio?: string; horaFim?: string; procedimento?: string; profissional?: string; sala?: string }
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

  // Primeiro acesso via link de recovery: exibe tela de definição de senha.
  // A sessão pode ainda estar sendo processada pelo SDK — DefinirSenha verifica
  // internamente via getSession() e redireciona caso o token seja inválido.
  if (recoveryMode) {
    return (
      <DefinirSenha
        onSuccess={() => {
          setRecoveryMode(false);
          window.history.replaceState(null, '', '/');
        }}
      />
    );
  }

  // GUARDA DE ROTA: sem sessão válida → tela de login obrigatória.
  // Verifica o hash antes de redirecionar para não descartar um token de recovery
  // que o SDK ainda não terminou de processar.
  if (!session || !session.user) {
    if (window.location.hash.includes('type=recovery')) {
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
        unidades={redeUnidades}
        currentUnidadeId={currentUnidadeId}
        onSwitchUnidade={setCurrentUnidadeId}
        permissoes={userPermissoes}
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
            permissoes={userPermissoes}
          />
        )}

        {currentTab === 'prontuario' && (
          <Prontuario
            selectedClienteId={selectedClienteId}
            userId={effectiveTenantId}
            onAddAgendamento={handleAddAgendamento}
            userName={userName}
            unidadeId={currentUnidadeId}
            pacienteCompartilhado={pacienteCompartilhado}
            permissoes={userPermissoes}
          />
        )}

        {currentTab === 'crm' && (
          <CRM
            userId={effectiveTenantId}
            userName={userName}
            onConvertidoAgendar={(_clienteId, clienteNome) => {
              alert(`"${clienteNome}" convertido em paciente! Acesse Prontuário para criar o agendamento.`);
              setCurrentTabSafe('prontuario');
            }}
            permissoes={userPermissoes}
          />
        )}

        {currentTab === 'orcamentos' && (
          <Orcamentos
            userId={effectiveTenantId}
            userName={userName || clinicName}
            onConvertidoAgendar={(nomeCliente) => {
              alert(`Orçamento de "${nomeCliente}" aprovado! Acesse a Agenda para criar o agendamento.`);
              setCurrentTabSafe('agenda');
            }}
            permissoes={userPermissoes}
          />
        )}

        {currentTab === 'crc' && (
          <CRCCentral
            userId={effectiveTenantId}
            userName={userName || clinicName}
            onAgendar={() => setCurrentTabSafe('agenda')}
            permissoes={userPermissoes}
          />
        )}

        {currentTab === 'whatsapp' && (
          <WhatsApp
            userId={effectiveTenantId}
            userName={userName || clinicName}
            permissoes={userPermissoes}
          />
        )}

        {/* Abas restritas: setCurrentTabSafe bloqueia equipe sem permissão */}
        {currentTab === 'comunicacao' && (userRole === 'dono' || userPermissoes?.['comunicacao']?.ver) && (
          <Comunicacao userId={effectiveTenantId} permissoes={userPermissoes} />
        )}

        {currentTab === 'gestao' && (userRole === 'dono' || userPermissoes?.['gestao']?.ver) && (
          <Gestao userId={effectiveTenantId} userName={userName} unidadeId={currentUnidadeId} />
        )}

        {currentTab === 'salas' && (userRole === 'dono' || userPermissoes?.['salas']?.ver) && (
          <GerenciamentoSalas userId={effectiveTenantId} permissoes={userPermissoes} />
        )}

        {currentTab === 'calendario-salas' && (userRole === 'dono' || userPermissoes?.['calendario-salas']?.ver) && (
          <CalendarioSalas
            userId={effectiveTenantId}
            agendamentosHoje={agendamentos}
            onEditAgendamento={handleUpdateAgendamentoDados}
          />
        )}

        {currentTab === 'lgpd' && (userRole === 'dono' || userPermissoes?.['lgpd']?.ver) && (
          <LGPD userId={effectiveTenantId} />
        )}

        {currentTab === 'configuracoes' && userRole === 'dono' && (
          <Configuracoes
            userId={session.user.id}
            userName={userName}
            onProfileUpdate={({ nome, fotoUrl }) => {
              if (nome !== undefined) setUserName(nome);
              if (fotoUrl !== undefined) setUserPhotoUrl(fotoUrl);
            }}
            redes={redes}
            redeUnidades={redeUnidades}
            onRedeUpdated={() => loadRedeData()}
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

      {billingModalMotivo && !billingModalDismissed && (
        <PlanoModal
          motivo={billingModalMotivo}
          clinicName={clinicName}
          diasRestantes={billingDiasRestantes}
          onClose={() => setBillingModalDismissed(true)}
        />
      )}

      {paymentIssue && (paymentIssue.status === 'suspended' || !paymentIssueDismissed) && (
        <PagamentoPendenteModal
          status={paymentIssue.status}
          clinicName={clinicName}
          diasAtraso={paymentIssue.diasAtraso}
          tentativas={paymentIssue.tentativas}
          suspensoEm={paymentIssue.suspensoEm}
          plano={paymentIssue.plano}
          periodicidade={paymentIssue.periodicidade}
          onClose={paymentIssue.status === 'past_due' ? () => setPaymentIssueDismissed(true) : undefined}
        />
      )}

      {/* Toast: novo agendamento online */}
      {onlineBookingAlert && (
        <div
          className="online-booking-toast"
          style={{
            background: '#2C302E', color: '#fff',
            padding: '14px 20px', borderRadius: '12px',
            fontSize: '14px', fontWeight: 500,
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: '10px',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <span style={{ fontSize: '20px' }}>📅</span>
          <span>{onlineBookingAlert}</span>
          <button
            onClick={() => setOnlineBookingAlert(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px', opacity: 0.7, marginLeft: 4, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
