import { db } from './db';
import type { EventType } from '../types';

/**
 * Log a user action to the event_log table.
 * Non-blocking — fire and forget. Never throws.
 */
export async function logEvent(type: EventType, metadata?: Record<string, any>): Promise<void> {
  try {
    await db.eventLog.add({
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      metadata,
    });
  } catch {
    // Silent fail — event logging should never block user actions
  }
}
