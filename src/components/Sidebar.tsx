import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  ClipboardList, 
  MessageSquareHeart, 
  TrendingUp, 
  Sparkles 
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, userName }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Jornada da Cliente', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda Inteligente', icon: CalendarRange },
    { id: 'prontuario', label: 'Prontuário Visual', icon: ClipboardList },
    { id: 'comunicacao', label: 'CRM & Retenção', icon: MessageSquareHeart },
    { id: 'gestao', label: 'Gestão da Clínica', icon: TrendingUp },
  ];

  /**
   * UX Choice: Minimalist Luxury Sidebar
   * The sidebar represents the serene environment of a luxury clinic.
   * Using "Verde Sálvia" as an accent color over high-end off-whites (#FAFAFA)
   * provides a humanized, warm experience rather than complex high-tech tools.
   */
  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Sparkles size={16} />
        </div>
        <div className="brand-name">{userName || 'Lumina Estética'}</div>
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
                cursor: 'pointer'
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="user-profile-footer">
        <img 
          src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150" 
          alt="Dra. Helena Martins" 
          className="user-avatar"
        />
        <div className="user-info">
          <span className="user-name">{userName || 'Dra. Helena Martins'}</span>
          <span className="user-role">Diretora Clínica</span>
        </div>
      </div>
    </div>
  );
};
