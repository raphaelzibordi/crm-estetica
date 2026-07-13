import { useEffect, useState } from 'react';

// Evento disparado pelo Chrome/Edge/Android antes de mostrar o prompt nativo de instalação.
// Ainda não faz parte do lib.dom.d.ts padrão do TypeScript, então tipamos manualmente.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'lumina_pwa_install_dismissed_em';
const DISMISS_DIAS = 14; // não insiste antes desse prazo após o usuário recusar

function foiDispensadoRecentemente(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dias = (Date.now() - Number(raw)) / 86_400_000;
  return dias < DISMISS_DIAS;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Já rodando como app instalado (standalone): nunca mostra o convite.
    const jaInstalado =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (jaInstalado) return;

    const handler = (event: Event) => {
      event.preventDefault(); // bloqueia o mini-infobar/prompt padrão do navegador
      if (foiDispensadoRecentemente()) return;
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // No iOS/Safari não existe beforeinstallprompt — instrução é manual (Compartilhar > Adicionar à Tela de Início).
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos && !jaInstalado && !foiDispensadoRecentemente()) {
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // iOS: não há API de instalação — o botão só reforça a instrução manual acima.
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome !== 'accepted') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        width: 'min(420px, calc(100vw - 32px))',
        background: 'var(--color-bg, #fff)',
        color: 'var(--color-text-main)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <img
        src="/icons/icon-192.png"
        alt="Lumina"
        width={44}
        height={44}
        style={{ borderRadius: 10, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 14 }}>Instalar o Lumina</strong>
        <p style={{ margin: '4px 0 12px', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {isIos
            ? 'Toque em Compartilhar e depois em "Adicionar à Tela de Início" para usar o Lumina como um app.'
            : 'Adicione à tela inicial para abrir mais rápido, em tela cheia e sem as barras do navegador.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isIos && (
            <button
              onClick={handleInstall}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Adicionar
            </button>
          )}
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Agora não
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Fechar"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: 2,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
