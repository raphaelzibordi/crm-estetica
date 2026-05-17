import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Agenda } from './components/Agenda';
import { Prontuario } from './components/Prontuario';
import { Comunicacao } from './components/Comunicacao';
import { Gestao } from './components/Gestao';
import { Auth } from './components/Auth';
import type { Agendamento, StatusJornada } from './types';
import { supabase } from './lib/supabase';
import { api } from './lib/api';

function App() {
  const [session, setSession] = useState<{ user: { id: string; user_metadata?: any } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const data = await api.getAgendamentos(session!.user.id, hoje);
      setAgendamentos(data);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    }
  };

  // State Management: Update status in the clinical flow
  const handleUpdateStatus = async (id: string, newStatus: StatusJornada) => {
    setAgendamentos((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const updated: Agendamento = { ...a, status: newStatus };
          
          // Custom flow automation: set arrival time & waiting times
          if (newStatus === 'chegou') {
            updated.horarioChegada = new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            });
            updated.tempoEsperaMinutos = 0;
          } else if (newStatus === 'atendimento') {
            // Keep previous waiting time or compute actual duration
            updated.tempoEsperaMinutos = a.tempoEsperaMinutos || 10;
          }
          
          return updated;
        }
        return a;
      })
    );
    
    // Persist in Supabase
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'chegou') updates.horarioChegada = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      await api.updateAgendamentoStatus(id, updates);
    } catch (err) {
      console.error('Erro ao atualizar status', err);
    }
  };

  // State Management: Add a new appointment in the agenda or flow
  const handleAddAgendamento = async (newAgendamento: Omit<Agendamento, 'id'>) => {
    try {
      let finalClienteId = newAgendamento.clienteId;
      
      // If temporary ID, create real client
      if (finalClienteId.startsWith('c')) {
        const novoCliente = await api.createCliente({
          nome: newAgendamento.clienteNome,
          telefone: '(00) 00000-0000',
          email: 'novo@cliente.com',
          dataNascimento: '1990-01-01',
          fotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
          dataUltimaVisita: new Date().toISOString().split('T')[0]
        }, session!.user.id);
        finalClienteId = novoCliente.id;
      }

      await api.createAgendamento({
        ...newAgendamento,
        clienteId: finalClienteId
      }, session!.user.id);

      // Reload from DB to get the join (clienteNome, etc)
      loadData();
      
    } catch (err) {
      console.error('Erro ao criar agendamento', err);
      alert('Erro ao criar agendamento no banco.');
    }
  };

  // UX Shortcut: Click on client name in dashboard redirects straight to medical records
  const handleOpenProntuario = (clienteId: string) => {
    setSelectedClienteId(clienteId);
    setCurrentTab('prontuario');
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--color-bg)' }}>Carregando Lumina...</div>;
  }

  if (!session) {
    return <Auth onLogin={setSession} />;
  }

  // Pass user info down (can fetch specific user profile later)
  const userName = session.user?.user_metadata?.nome_clinica || 'Lumina Clinics';

  return (
    <div className={`app-container ${darkMode ? 'dark-theme' : ''}`}>
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} userName={userName} />

      <main className="main-content" style={{ position: 'relative' }}>
        <button 
          onClick={() => setDarkMode(!darkMode)}
          style={{ position: 'absolute', top: '24px', right: '32px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', zIndex: 100, color: 'var(--color-text-main)' }}
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
          <Agenda 
            agendamentos={agendamentos} 
            onAddAgendamento={handleAddAgendamento}
          />
        )}

        {currentTab === 'prontuario' && (
          <Prontuario 
            selectedClienteId={selectedClienteId} 
            userId={session.user.id}
          />
        )}

        {currentTab === 'comunicacao' && (
          <Comunicacao userId={session.user.id} />
        )}

        {currentTab === 'gestao' && (
          <Gestao userId={session.user.id} />
        )}
      </main>
    </div>
  );
}

export default App;
