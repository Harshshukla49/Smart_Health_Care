import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const PwaContext = createContext(null);

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Check initial installation state and device type
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone display mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    // Detect iOS / iPadOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    setIsIos(isIosDevice);

    // If on iOS and not yet installed, mark as installable via Add to Home Screen
    if (isIosDevice && !isStandalone) {
      setIsInstallable(true);
    }

    // Listen for beforeinstallprompt on Chromium, Android, and Edge
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('[PWA] beforeinstallprompt event captured.');
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowIosGuide(false);
      toast.success('Smart Health Care installed to your device!', {
        icon: '🏥',
        duration: 4000,
      });
      console.log('[PWA] Application was successfully installed.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger installation workflow
  const promptInstall = useCallback(async () => {
    // If running on iOS Safari, show the interactive Add to Home Screen walkthrough
    if (isIos && !isInstalled) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback for browsers without direct prompt API
      if (!isInstalled) {
        toast('To install: click the Install icon in your browser address bar or menu.', {
          icon: '📲',
          duration: 4500,
        });
      }
      return;
    }

    try {
      // Show native install dialog
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the installation prompt');
        setIsInstallable(false);
      } else {
        console.log('[PWA] User dismissed the installation prompt');
      }

      setDeferredPrompt(null);
    } catch (err) {
      console.warn('[PWA] Error displaying installation dialog:', err);
    }
  }, [deferredPrompt, isIos, isInstalled]);

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isIos,
        showIosGuide,
        setShowIosGuide,
        promptInstall,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    return {
      isInstallable: false,
      isInstalled: false,
      isIos: false,
      showIosGuide: false,
      setShowIosGuide: () => {},
      promptInstall: () => {},
    };
  }
  return context;
}
