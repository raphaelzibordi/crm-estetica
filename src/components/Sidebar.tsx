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
  Settings,
  User,
  Building2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userName?: string;
  userPhotoUrl?: string;
  userRole?: UserRole;
  userCargo?: string;
  clinicName?: string;
}

const ALL_MENU_ITEMS = [
  { id: 'dashboard',   label: 'Jornada da Cliente', icon: LayoutDashboard, donoOnly: false },
  { id: 'agenda',      label: 'Agenda Inteligente', icon: CalendarRange,   donoOnly: false },
  { id: 'prontuario',  label: 'Prontuário Visual',  icon: ClipboardList,   donoOnly: false },
  { id: 'comunicacao', label: 'CRM & Retenção',     icon: MessageSquareHeart, donoOnly: true },
  { id: 'gestao',      label: 'Gestão da Clínica',  icon: TrendingUp,      donoOnly: true },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  userName,
  userPhotoUrl,
  userRole = 'dono',
  userCargo,
  clinicName,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const footerRef = useRef<HTMLDivElement | null>(null);

  const menuItems = ALL_MENU_ITEMS.filter(
    (item) => !item.donoOnly || userRole === 'dono'
  );

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

      {clinicName && (
        <div
          style={{
            paddingLeft: '8px',
            paddingRight: '8px',
            marginTop: '-32px',
            marginBottom: '20px',
          }}
        >
          <div
            title={clinicName}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--color-primary-light)',
              border: '1px solid var(--color-border-hover)',
              borderRadius: '100px',
              padding: '5px 12px 5px 8px',
              overflow: 'hidden',
            }}
          >
            <Building2 size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                color: 'var(--color-primary)',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {clinicName}
            </span>
          </div>
        </div>
      )}

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
            {/* Configurações (apenas para dono) */}
            {userRole === 'dono' && (
              <button
                type="button"
                onClick={() => { setCurrentTab('configuracoes'); setMenuOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', background: 'transparent', border: 'none',
                  borderRadius: 'var(--border-radius-sm)', color: 'var(--color-text-main)',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Settings size={16} />
                <span>Configurações</span>
              </button>
            )}

            {/* Linha divisora */}
            <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 6px' }} />

            {/* Sair */}
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
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-warning-light)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
          {userPhotoUrl ? (
            <img
              src={userPhotoUrl}
              alt={userName || 'Perfil'}
              className="user-avatar"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div
              className="user-avatar"
              style={{
                background: 'var(--color-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <User size={18} />
            </div>
          )}
          <div className="user-info" style={{ flex: 1 }}>
            <span className="user-name">{userName || 'Usuário'}</span>
            <span className="user-role">
              {userRole === 'equipe'
                ? (userCargo || 'Membro da Equipe')
                : 'Dono da Clínica'}
            </span>
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
