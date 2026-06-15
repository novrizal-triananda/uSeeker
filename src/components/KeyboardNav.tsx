import { useEffect, useCallback } from 'react';

// Layer navigation keys: 1-6
const LAYER_KEYS = ['1', '2', '3', '4', '5', '6'];

export default function KeyboardNav() {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Escape: close modals
    if (e.key === 'Escape') {
      const activeModal = document.querySelector<HTMLElement>(
        '[role="dialog"][aria-modal="true"]'
      );
      if (activeModal) {
        const closeBtn = activeModal.querySelector<HTMLElement>(
          '[data-close-modal], button[aria-label="Tutup"], button[aria-label="Close"]'
        );
        if (closeBtn) {
          closeBtn.click();
        } else {
          // Fallback: dispatch Escape on the dialog itself
          activeModal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
        return;
      }
    }

    // Number keys 1-6: navigate layers
    if (LAYER_KEYS.includes(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const target = e.target as HTMLElement;
      // Don't capture when typing in inputs
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const layerButtons = document.querySelectorAll<HTMLElement>(
        `[data-layer="${e.key}"]`
      );
      if (layerButtons.length > 0) {
        layerButtons[0].click();
        layerButtons[0].focus();
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus trap for modals
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const modal = document.querySelector<HTMLElement>(
        '[role="dialog"][aria-modal="true"]'
      );
      if (!modal) return;

      const focusableSelector =
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

      const handleTabTrap = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        const focusable = modal.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      modal.addEventListener('keydown', handleTabTrap);
      // Auto-focus first focusable element
      const firstFocusable = modal.querySelector<HTMLElement>(focusableSelector);
      if (firstFocusable) firstFocusable.focus();

      return () => modal.removeEventListener('keydown', handleTabTrap);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
