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

/**
 * A2HS prompt popup that appears at the bottom when the app is not installed and the browser supports it.
 * It listens for the beforeinstallprompt event and triggers the prompt when clicked.
 * It hides itself when running in standalone PWA mode or after successful install.
 * Users can dismiss it and it won't show again for the session.
 */
export default function AddToHomeScreen() {
  const deferredPromptRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Hide when already installed/PWA standalone
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Check if user dismissed the prompt in this session
    if (sessionStorage.getItem("a2hs-dismissed") === "true") {
      setIsDismissed(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e;
      setIsVisible(true);
    }

    function onAppInstalled() {
      setIsVisible(false);
      deferredPromptRef.current = null;
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleClick = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;
    
    try {
      await promptEvent.prompt?.();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setIsVisible(false);
        deferredPromptRef.current = null;
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem("a2hs-dismissed", "true");
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">Install DailySpend</h3>
          <p className="text-xs text-gray-600 mt-1">Add to your home screen for quick access</p>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <Button 
            onClick={handleClick} 
            size="sm"
            className="bg-primary text-white hover:bg-blue-700"
          >
            Install
          </Button>
          <Button 
            onClick={handleDismiss} 
            size="sm" 
            variant="ghost"
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}


