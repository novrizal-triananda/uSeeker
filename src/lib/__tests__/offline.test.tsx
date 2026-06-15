import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import OfflineIndicator from '../../components/OfflineIndicator';

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
});

describe('OfflineIndicator', () => {
  it('should render nothing when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should show banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Anda sedang offline. Fitur AI tidak tersedia.')).toBeDefined();
  });

  it('should have aria-live="polite" on the alert', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<OfflineIndicator />);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
  });

  it('should hide when going back online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.getByRole('alert')).toBeDefined();

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('should show when going offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    render(<OfflineIndicator />);
    expect(screen.queryByRole('alert')).toBeNull();

    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    window.dispatchEvent(new Event('offline'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});
