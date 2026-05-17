import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Agenda } from './components/Agenda';
import { Prontuario } from './components/Prontuario';
import { Comunicacao } from './components/Comunicacao';
import { Gestao } from './components/Gestao';
import { Auth } from './components/Auth';
import { mockAgendamentosDia } from './data/mockData';
import type { Agendamento, StatusJornada } from './types';
import { supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(mockAgendamentosDia);
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

  // State Management: Update status in the clinical flow
  const handleUpdateStatus = (id: string, newStatus: StatusJornada) => {
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
  };

  // State Management: Add a new appointment in the agenda or flow
  const handleAddAgendamento = (newAgendamento: Omit<Agendamento, 'id'>) => {
    const created: Agendamento = {
      ...newAgendamento,
      id: 'a_' + Date.now()
    };
    setAgendamentos((prev) => [...prev, created]);
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
    <div className="app-container">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} userName={userName} />

      <main className="main-content">
        {currentTab === 'dashboard' && (
          <Dashboard 
            agendamentos={agendamentos} 
            onUpdateStatus={handleUpdateStatus} 
            onOpenProntuario={handleOpenProntuario}
            onAddAgendamento={handleAddAgendamento}
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
          />
        )}

        {currentTab === 'comunicacao' && (
          <Comunicacao />
        )}

        {currentTab === 'gestao' && (
          <Gestao />
        )}
      </main>
    </div>
  );
}

export default App;
