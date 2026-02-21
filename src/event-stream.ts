/**
 * Server-Sent Events (SSE) manager.
 *
 * Maintains a set of connected SSE clients (by client ID) and provides
 * typed broadcast helpers for metrics, logs, alerts, and system status.
 *
 * Uses the DI config logger instead of bare console calls.
 */

import { getMetricsConfig } from './config.js';
import type { RealtimeEvent } from './types.js';

export class EventStreamManager {
  private streams = new Map<string, ReadableStreamDefaultController>();
  private static instance: EventStreamManager;

  private constructor() {}

  /** Return the singleton instance, creating it on first call. */
  public static getInstance(): EventStreamManager {
    if (!EventStreamManager.instance) {
      EventStreamManager.instance = new EventStreamManager();
    }
    return EventStreamManager.instance;
  }

  /**
   * Reset the singleton instance (for testing purposes).
   */
  public static resetInstance(): void {
    EventStreamManager.instance = undefined as unknown as EventStreamManager;
  }

  /** Register a new SSE client. */
  public addClient(
    clientId: string,
    controller: ReadableStreamDefaultController,
  ): void {
    this.streams.set(clientId, controller);
    const logger = getMetricsConfig().getLogger();
    logger.info(`Client ${clientId} connected to event stream`);
  }

  /** Remove an SSE client by ID. */
  public removeClient(clientId: string): void {
    this.streams.delete(clientId);
    const logger = getMetricsConfig().getLogger();
    logger.info(`Client ${clientId} disconnected from event stream`);
  }

  /** Broadcast an event to all connected clients in SSE format. */
  public broadcast(event: RealtimeEvent): void {
    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    const logger = getMetricsConfig().getLogger();

    this.streams.forEach((controller, clientId) => {
      try {
        controller.enqueue(eventData);
      } catch (error) {
        logger.error(`Failed to send event to client ${clientId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        this.removeClient(clientId);
      }
    });
  }

  /** Return the number of currently connected clients. */
  public getClientCount(): number {
    return this.streams.size;
  }

  /** Broadcast a metrics update. */
  public broadcastMetrics(metrics: unknown): void {
    this.broadcast({
      type: 'metrics',
      timestamp: Date.now(),
      data: metrics,
    });
  }

  /** Broadcast log entries. */
  public broadcastLogs(logs: unknown[]): void {
    this.broadcast({
      type: 'logs',
      timestamp: Date.now(),
      data: logs,
    });
  }

  /** Broadcast an alert. */
  public broadcastAlert(alert: unknown): void {
    this.broadcast({
      type: 'alerts',
      timestamp: Date.now(),
      data: alert,
    });
  }

  /** Broadcast system status. */
  public broadcastSystemStatus(status: unknown): void {
    this.broadcast({
      type: 'system',
      timestamp: Date.now(),
      data: status,
    });
  }
}

/** Convenience function to get the EventStreamManager singleton. */
export function getEventStreamManager(): EventStreamManager {
  return EventStreamManager.getInstance();
}
