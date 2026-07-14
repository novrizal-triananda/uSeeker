import { ask } from '@tauri-apps/plugin-dialog';

/** Async confirm dialog using native Tauri dialog (replaces window.confirm which fails on WebKitGTK) */
export async function confirmAsync(message: string): Promise<boolean> {
  return ask(message, { title: 'uSeeker', kind: 'warning' });
}
