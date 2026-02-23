








import { getMetricsConfig } from './config.js';
import type { RealtimeEvent } from './types.js';

export class EventStreamManager {
  private streams = new Map<string, ReadableStreamDefaultController>();
  private static instance: EventStreamManager;

  private constructor() {}

  
  public static getInstance(): EventStreamManager {
    if (!EventStreamManager.instance) {
      EventStreamManager.instance = new EventStreamManager();
    }
    return EventStreamManager.instance;
  }

  


  public static resetInstance(): void {
    EventStreamManager.instance = undefined as unknown as EventStreamManager;
  }

  
  public addClient(
    clientId: string,
    controller: ReadableStreamDefaultController,
  ): void {
    this.streams.set(clientId, controller);
    const logger = getMetricsConfig().getLogger();
    logger.info(`Client ${clientId} connected to event stream`);
  }

  
  public removeClient(clientId: string): void {
    this.streams.delete(clientId);
    const logger = getMetricsConfig().getLogger();
    logger.info(`Client ${clientId} disconnected from event stream`);
  }

  
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

  
  public getClientCount(): number {
    return this.streams.size;
  }

  
  public broadcastMetrics(metrics: unknown): void {
    this.broadcast({
      type: 'metrics',
      timestamp: Date.now(),
      data: metrics,
    });
  }

  
  public broadcastLogs(logs: unknown[]): void {
    this.broadcast({
      type: 'logs',
      timestamp: Date.now(),
      data: logs,
    });
  }

  
  public broadcastAlert(alert: unknown): void {
    this.broadcast({
      type: 'alerts',
      timestamp: Date.now(),
      data: alert,
    });
  }

  
  public broadcastSystemStatus(status: unknown): void {
    this.broadcast({
      type: 'system',
      timestamp: Date.now(),
      data: status,
    });
  }
}


export function getEventStreamManager(): EventStreamManager {
  return EventStreamManager.getInstance();
}
