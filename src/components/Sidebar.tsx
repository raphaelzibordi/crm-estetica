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
  ChevronDown,
  Settings,
  User,
  Building2,
  Menu,
  X,
  Users,
  Receipt,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  DoorOpen,
  CalendarDays,
  Network,
  Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserRole, Unidade, Permissoes } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userName?: string;
  userPhotoUrl?: string;
  userRole?: UserRole;
  userCargo?: string;
  clinicName?: string;
  permissoes?: Permissoes | null;
  plano?: string | null;
  // US-048: multiclínicas
  unidades?: Unidade[];
  currentUnidadeId?: string | null;
  onSwitchUnidade?: (unidadeId: string | null) => void;
}

// Ordem numérica dos planos para comparação de nível mínimo
const PLAN_ORDER: Record<string, number> = { basico: 0, pro: 1, enterprise: 2, vip: 2 };

const ALL_MENU_ITEMS = [
  { id: 'dashboard',        label: 'Jornada da Cliente', icon: LayoutDashboard,    donoOnly: false, minPlan: 'basico'     },
  { id: 'agenda',           label: 'Agenda Inteligente', icon: CalendarRange,      donoOnly: false, minPlan: 'basico'     },
  { id: 'prontuario',       label: 'Prontuário Visual',  icon: ClipboardList,      donoOnly: false, minPlan: 'basico'     },
  { id: 'crm',              label: 'Pipeline de Leads',  icon: Users,              donoOnly: false, minPlan: 'pro'        },
  { id: 'orcamentos',       label: 'Orçamentos',         icon: Receipt,            donoOnly: false, minPlan: 'pro'        },
  { id: 'crc',              label: 'Relacionamento',     icon: HeartHandshake,     donoOnly: false, minPlan: 'pro'        },
  { id: 'whatsapp',         label: 'WhatsApp',           icon: MessageCircle,      donoOnly: false, minPlan: 'enterprise' },
  { id: 'comunicacao',      label: 'CRM & Retenção',     icon: MessageSquareHeart, donoOnly: true,  minPlan: 'enterprise' },
  { id: 'gestao',           label: 'Gestão da Clínica',  icon: TrendingUp,         donoOnly: true,  minPlan: 'basico'     },
  { id: 'salas',            label: 'Salas',              icon: DoorOpen,           donoOnly: true,  minPlan: 'pro'        },
  { id: 'calendario-salas', label: 'Calendário Salas',   icon: CalendarDays,       donoOnly: true,  minPlan: 'pro'        },
  { id: 'lgpd',             label: 'LGPD',               icon: ShieldCheck,        donoOnly: true,  minPlan: 'pro'        },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  userName,
  userPhotoUrl,
  userRole = 'dono',
  userCargo,
  clinicName,
  permissoes,
  plano,
  unidades = [],
  currentUnidadeId,
  onSwitchUnidade,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [unidadeDropdownOpen, setUnidadeDropdownOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const unidadeDropdownRef = useRef<HTMLDivElement | null>(null);

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
    setIsMobileOpen(false);
  };

  const menuItems = ALL_MENU_ITEMS.filter(item => {
    if (userRole === 'dono') {
      // Enquanto o plano ainda não foi carregado, exibe tudo para evitar flash
      if (plano == null) return true;
      const planLevel = PLAN_ORDER[plano] ?? 0;
      const required = PLAN_ORDER[item.minPlan] ?? 0;
      return planLevel >= required;
    }
    // Equipe com perfil: usa as permissões do perfil
    if (permissoes) return permissoes[item.id]?.ver === true;
    // Equipe sem perfil: comportamento legado (oculta donoOnly)
    return !item.donoOnly;
  });

  // Fecha dropdown de unidades ao clicar fora
  useEffect(() => {
    if (!unidadeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (unidadeDropdownRef.current && !unidadeDropdownRef.current.contains(e.target as Node)) {
        setUnidadeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [unidadeDropdownOpen]);

  const currentUnidadeNome = currentUnidadeId
    ? (unidades.find(u => u.id === currentUnidadeId)?.nome ?? clinicName)
    : (unidades.length > 1 ? 'Todas as unidades' : clinicName);

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
    <>
      {/* Mobile top bar */}
      <div className="mobile-header">
        <button
          className="mobile-hamburger"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="brand-icon" style={{ width: '28px', height: '28px' }}>
            <Sparkles size={14} />
          </div>
          <span className="brand-name" style={{ fontSize: '16px' }}>Lumina</span>
        </div>
        <div style={{ width: '38px' }} />
      </div>

      {/* Backdrop */}
      <div
        className={`sidebar-backdrop${isMobileOpen ? ' visible' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      <div className={`sidebar${isMobileOpen ? ' mobile-open' : ''}`}>
        {/* Close button — mobile only */}
        <button
          className="sidebar-close-btn"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>

      <div className="brand">
        <div className="brand-icon">
          <Sparkles size={16} />
        </div>
        <div className="brand-name">Lumina</div>
      </div>

      {(clinicName || unidades.length > 0) && (
        <div
          style={{
            paddingLeft: '8px',
            paddingRight: '8px',
            marginTop: '-32px',
            marginBottom: '20px',
          }}
        >
          {/* Seletor de unidade (quando há múltiplas) */}
          {unidades.length > 1 && onSwitchUnidade ? (
            <div ref={unidadeDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUnidadeDropdownOpen(v => !v)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--color-primary-light)',
                  border: '1px solid var(--color-border-hover)',
                  borderRadius: '100px',
                  padding: '5px 10px 5px 8px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <Network size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 500,
                    color: 'var(--color-primary)',
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    textAlign: 'left',
                  }}
                >
                  {currentUnidadeNome ?? 'Todas as unidades'}
                </span>
                <ChevronDown
                  size={11}
                  style={{
                    color: 'var(--color-primary)',
                    flexShrink: 0,
                    transform: unidadeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                />
              </button>

              {unidadeDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-md)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 300,
                    padding: '4px',
                    animation: 'fadeIn 0.12s ease-out',
                  }}
                >
                  <button
                    onClick={() => { onSwitchUnidade(null); setUnidadeDropdownOpen(false); }}
                    style={{
                      width: '100%', padding: '8px 10px',
                      background: !currentUnidadeId ? 'var(--color-primary-light)' : 'transparent',
                      border: 'none', borderRadius: 'var(--border-radius-sm)',
                      color: 'var(--color-text-main)', fontSize: '13px',
                      cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                  >
                    <Network size={13} style={{ opacity: 0.6 }} />
                    <span style={{ flex: 1 }}>Todas as unidades</span>
                    {!currentUnidadeId && <Check size={13} color="var(--color-primary)" />}
                  </button>
                  {unidades.filter(u => u.ativo).map(u => (
                    <button
                      key={u.id}
                      onClick={() => { onSwitchUnidade(u.id); setUnidadeDropdownOpen(false); }}
                      style={{
                        width: '100%', padding: '8px 10px',
                        background: currentUnidadeId === u.id ? 'var(--color-primary-light)' : 'transparent',
                        border: 'none', borderRadius: 'var(--border-radius-sm)',
                        color: 'var(--color-text-main)', fontSize: '13px',
                        cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}
                    >
                      <Building2 size={13} style={{ opacity: 0.6 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.nome}
                      </span>
                      {currentUnidadeId === u.id && <Check size={13} color="var(--color-primary)" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : clinicName ? (
            // Badge simples quando não há múltiplas unidades
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
          ) : null}

          {plano && (
            <div
              style={{
                marginTop: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '100px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                width: 'fit-content',
                ...(plano === 'pro' ? {
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
                  color: '#8B5CF6',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                } : plano === 'enterprise' ? {
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(239, 68, 68, 0.08) 100%)',
                  color: '#D97706',
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                } : plano === 'vip' ? {
                  background: 'linear-gradient(135deg, #1E1E1E 0%, #2D2D2D 100%)',
                  color: '#F59E0B',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
                } : {
                  background: 'var(--color-primary-light)',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-border-hover)',
                })
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: 'currentColor',
                  display: 'inline-block',
                }}
              />
              <span>Plano {plano === 'basico' ? 'Básico' : plano.toUpperCase()}</span>
            </div>
          )}
        </div>
      )}

      <nav className="nav-list">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
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
                onClick={() => { handleNavClick('configuracoes'); setMenuOpen(false); }}
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
    </>
  );
};
