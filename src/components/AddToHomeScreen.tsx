import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Extend Window interface for PWA events
declare global {
  interface Window {
    beforeinstallprompt: any;
    appinstalled: any;
  }
}

export default function AddToHomeScreen() {
  const deferredPromptRef = useRef<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkIfInstalled = () => {
      // For iOS
      if ('standalone' in window.navigator && (window.navigator as any).standalone) {
        setIsInstalled(true);
        return true;
      }
      
      // For Android/Chrome
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return true;
      }
      
      return false;
    };

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('a2hs-dismissed') === 'true';
    
    if (checkIfInstalled() || isDismissed) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      console.log('App installed successfully');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      deferredPromptRef.current = null;
    };

    // Check if prompt is already available (for cases where event fired before component mounted)
    if (window.beforeinstallprompt) {
      console.log('beforeinstallprompt already available');
      deferredPromptRef.current = window.beforeinstallprompt;
      setShowInstallPrompt(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPromptRef.current) {
      console.log('No install prompt available');
      return;
    }

    try {
      console.log('Showing install prompt');
      await deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      console.log('Install prompt outcome:', outcome);
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallPrompt(false);
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    sessionStorage.setItem('a2hs-dismissed', 'true');
  };

  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg p-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">Install DailySpend</h3>
          <p className="text-xs text-gray-600 mt-1">
            Add to your home screen for quick access and offline use
          </p>
        </div>
        <div className="flex items-center justify-end space-x-2">
          <Button 
            onClick={handleInstallClick} 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Install
          </Button>
          <Button 
            onClick={handleDismiss} 
            size="sm" 
            variant="ghost"
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}


