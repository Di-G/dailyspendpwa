import { useEffect, useState } from "react";

export default function PWADebug() {
  const [pwaStatus, setPwaStatus] = useState({
    isStandalone: false,
    hasBeforeInstallPrompt: false,
    isInstalled: false,
    userAgent: '',
    displayMode: ''
  });

  useEffect(() => {
    const checkPWAStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const hasBeforeInstallPrompt = !!window.beforeinstallprompt;
      const isInstalled = isStandalone || ('standalone' in window.navigator && (window.navigator as any).standalone);
      
      setPwaStatus({
        isStandalone,
        hasBeforeInstallPrompt,
        isInstalled,
        userAgent: navigator.userAgent,
        displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
      });
    };

    checkPWAStatus();
    
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = () => {
      setPwaStatus(prev => ({ ...prev, hasBeforeInstallPrompt: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-black text-white p-4 rounded-lg text-xs max-w-xs">
      <h3 className="font-bold mb-2">PWA Debug Info</h3>
      <div className="space-y-1">
        <div>Standalone: {pwaStatus.isStandalone ? 'Yes' : 'No'}</div>
        <div>Has Install Prompt: {pwaStatus.hasBeforeInstallPrompt ? 'Yes' : 'No'}</div>
        <div>Installed: {pwaStatus.isInstalled ? 'Yes' : 'No'}</div>
        <div>Display Mode: {pwaStatus.displayMode}</div>
        <div className="text-xs opacity-75 mt-2">
          {pwaStatus.userAgent.includes('Chrome') ? 'Chrome' : 
           pwaStatus.userAgent.includes('Safari') ? 'Safari' : 
           pwaStatus.userAgent.includes('Firefox') ? 'Firefox' : 'Other'}
        </div>
      </div>
    </div>
  );
}
