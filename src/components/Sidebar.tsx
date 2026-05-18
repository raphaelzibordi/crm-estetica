import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  CalendarRange,
  ClipboardList,
  MessageSquareHeart,
  TrendingUp,
  Sparkles,
  LogOut,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, userName }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const footerRef = useRef<HTMLDivElement | null>(null);

  const menuItems = [
    { id: 'dashboard', label: 'Jornada da Cliente', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda Inteligente', icon: CalendarRange },
    { id: 'prontuario', label: 'Prontuário Visual', icon: ClipboardList },
    { id: 'comunicacao', label: 'CRM & Retenção', icon: MessageSquareHeart },
    { id: 'gestao', label: 'Gestão da Clínica', icon: TrendingUp },
  ];

  // Fecha o popover ao clicar fora
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      // App.tsx observa onAuthStateChange e força a tela de login
    } catch (err) {
      console.error('[Lumina] Erro ao sair:', err);
      alert('Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  };

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Sparkles size={16} />
        </div>
        <div className="brand-name">Lumina</div>
      </div>

      <nav className="nav-list">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
              style={{
                background: currentTab === item.id ? 'var(--color-primary)' : 'transparent',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer clicável: abre popover com botão Sair */}
      <div ref={footerRef} style={{ position: 'relative', marginTop: 'auto' }}>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
              padding: '6px',
              zIndex: 200,
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--color-warning)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: signingOut ? 'wait' : 'pointer',
                transition: 'var(--transition-smooth)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-warning-light)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <LogOut size={16} />
              <span>{signingOut ? 'Saindo...' : 'Sair do Lumina'}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="user-profile-footer"
          style={{
            width: '100%',
            background: menuOpen ? 'var(--color-primary-light)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--border-radius-md)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'var(--transition-smooth)',
            paddingTop: '20px',
            paddingBottom: '8px',
            paddingLeft: '8px',
            paddingRight: '8px',
          }}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <img
            src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150"
            alt="Dra. Helena Martins"
            className="user-avatar"
          />
          <div className="user-info" style={{ flex: 1 }}>
            <span className="user-name">{userName || 'Dra. Helena Martins'}</span>
            <span className="user-role">Diretora Clínica</span>
          </div>
          <ChevronUp
            size={14}
            style={{
              color: 'var(--color-text-muted)',
              transform: menuOpen ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'var(--transition-smooth)',
            }}
          />
        </button>
      </div>
    </div>
  );
};
