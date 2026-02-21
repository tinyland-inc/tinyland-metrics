/**
 * In-memory metrics collector with page view tracking, session tracking,
 * traffic source analysis, bounce rate calculation, and optional JSON
 * persistence.
 *
 * All environment coupling is resolved through the DI config layer
 * (see config.ts).  Timers use `.unref()` so they never keep the
 * process alive on their own.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getMetricsConfig } from './config.js';
import type {
  MetricsData,
  PageMetrics,
  SessionMetrics,
  TopPage,
  TrafficSource,
} from './types.js';

export class MetricsCollector {
  private pageMetrics = new Map<string, PageMetrics>();
  private sessionMetrics = new Map<string, SessionMetrics>();
  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private persistInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const cfg = getMetricsConfig();

    // Load persisted data (fire-and-forget; errors handled internally)
    this.loadPersistedData();

    // Periodic cleanup of stale sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSessions();
    }, cfg.cleanupIntervalMs);
    this.cleanupInterval.unref();

    // Periodic persistence
    this.persistInterval = setInterval(() => {
      this.persistData();
    }, cfg.persistIntervalMs);
    this.persistInterval.unref();

    // Optional shutdown hook
    if (cfg.registerShutdownHook) {
      process.on('beforeExit', () => {
        this.destroy();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Track a page view, creating page and session entries as needed. */
  trackPageView(
    sessionId: string,
    path: string,
    userId?: string,
    referrer?: string,
    userAgent?: string,
  ): void {
    // Update page metrics
    let pageData = this.pageMetrics.get(path);
    if (!pageData) {
      pageData = {
        path,
        views: 0,
        uniqueVisitors: new Set<string>(),
        lastAccessed: new Date(),
      };
      this.pageMetrics.set(path, pageData);
    }
    pageData.views++;
    pageData.uniqueVisitors.add(sessionId);
    pageData.lastAccessed = new Date();

    // Update session metrics
    let session = this.sessionMetrics.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        userId,
        startTime: new Date(),
        lastActivity: new Date(),
        pageViews: 0,
        pages: [],
        referrer,
        userAgent,
      };
      this.sessionMetrics.set(sessionId, session);
    }
    session.lastActivity = new Date();
    session.pageViews++;
    if (!session.pages.includes(path)) {
      session.pages.push(path);
    }

    this.requestCount++;
  }

  /** Track an error occurrence. */
  trackError(_sessionId?: string, _errorType?: string): void {
    this.errorCount++;
  }

  /** Return session metrics for the given session ID, or null. */
  getSessionMetrics(sessionId: string | null): SessionMetrics | null {
    if (!sessionId) return null;
    return this.sessionMetrics.get(sessionId) ?? null;
  }

  /** Compute and return the current metrics snapshot. */
  getMetrics(): MetricsData {
    const now = Date.now();
    const uptime = (now - this.startTime) / 1000;

    // Active sessions: activity within last 30 minutes
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
    const activeSessions = Array.from(this.sessionMetrics.values()).filter(
      (session) => session.lastActivity > thirtyMinutesAgo,
    );

    // Top pages (top 5 by view count)
    const topPages: TopPage[] = Array.from(this.pageMetrics.entries())
      .map(([path, data]) => ({
        path,
        views: data.views,
        uniqueVisitors: data.uniqueVisitors.size,
        percentage: 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    const totalPageViews = Array.from(this.pageMetrics.values()).reduce(
      (sum, page) => sum + page.views,
      0,
    );

    const topPagesWithPercentages: TopPage[] = topPages.map((page) => ({
      ...page,
      percentage:
        totalPageViews > 0 ? (page.views / totalPageViews) * 100 : 0,
    }));

    // Traffic sources
    const trafficSources = this.analyzeTrafficSources();

    // Average session duration
    const sessionDurations = activeSessions.map(
      (session) =>
        session.lastActivity.getTime() - session.startTime.getTime(),
    );
    const avgDurationMs =
      sessionDurations.length > 0
        ? sessionDurations.reduce((a, b) => a + b, 0) /
          sessionDurations.length
        : 0;
    const avgDurationMinutes = Math.floor(avgDurationMs / 60000);
    const avgDurationSeconds = Math.floor((avgDurationMs % 60000) / 1000);

    // Bounce rate
    const singlePageSessions = Array.from(
      this.sessionMetrics.values(),
    ).filter((session) => session.pageViews === 1).length;
    const totalSessions = this.sessionMetrics.size;
    const bounceRate =
      totalSessions > 0
        ? (singlePageSessions / totalSessions) * 100
        : 0;

    return {
      totalVisitors: this.sessionMetrics.size,
      activeUsers: activeSessions.length,
      pageViews: totalPageViews,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      avgSessionDuration: `${avgDurationMinutes}m ${avgDurationSeconds}s`,
      bounceRate: Math.round(bounceRate * 10) / 10,
      topPages: topPagesWithPercentages,
      trafficSources,
      activeSessions: activeSessions.length,
      uptime,
      requestRate: this.requestCount / uptime,
      errorRate: this.errorCount / uptime,
      requestDuration: {
        bucket1: Math.floor(this.requestCount * 0.7),
        bucket2: Math.floor(this.requestCount * 0.9),
        bucket3: Math.floor(this.requestCount * 0.98),
        total: this.requestCount,
      },
    };
  }

  /** Stop all timers and persist data one final time. */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
      this.persistInterval = null;
    }
    this.persistData();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Analyze traffic sources from referrer data across all sessions. */
  analyzeTrafficSources(): TrafficSource[] {
    const sources = new Map<string, number>();

    for (const session of this.sessionMetrics.values()) {
      const source = this.categorizeReferrer(session.referrer);
      sources.set(source, (sources.get(source) ?? 0) + 1);
    }

    const total = Array.from(sources.values()).reduce((a, b) => a + b, 0);

    return Array.from(sources.entries())
      .map(([source, visits]) => ({
        source,
        visits,
        percentage: total > 0 ? (visits / total) * 100 : 0,
      }))
      .sort((a, b) => b.visits - a.visits);
  }

  /** Categorize a referrer URL into a traffic source bucket. */
  categorizeReferrer(referrer?: string): string {
    if (!referrer || referrer === '') {
      return 'Direct';
    }

    try {
      const url = new URL(referrer);
      const domain = url.hostname.toLowerCase();

      // Social media
      if (
        domain.includes('facebook.com') ||
        domain.includes('twitter.com') ||
        domain.includes('instagram.com') ||
        domain.includes('linkedin.com') ||
        domain.includes('youtube.com') ||
        domain.includes('tiktok.com')
      ) {
        return 'Social Media';
      }

      // Search engines
      if (
        domain.includes('google.') ||
        domain.includes('bing.com') ||
        domain.includes('yahoo.com') ||
        domain.includes('duckduckgo.com')
      ) {
        return 'Search';
      }

      // Internal / same domain
      if (
        domain.includes('stonewallunderground.com') ||
        domain.includes('localhost')
      ) {
        return 'Internal';
      }

      return 'Referral';
    } catch {
      return 'Direct';
    }
  }

  /** Remove sessions inactive for more than 24 hours. */
  cleanupOldSessions(): void {
    const logger = getMetricsConfig().getLogger();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let cleaned = 0;

    this.sessionMetrics.forEach((session, id) => {
      if (session.lastActivity < oneDayAgo) {
        this.sessionMetrics.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      const cfg = getMetricsConfig();
      if (cfg.isDevelopment) {
        logger.info(`[MetricsCollector] Cleaned up ${cleaned} old sessions`);
      }
    }
  }

  /** Load previously persisted page and session data from disk. */
  async loadPersistedData(): Promise<void> {
    const cfg = getMetricsConfig();
    const logger = cfg.getLogger();
    const pageMetricsFile = join(cfg.dataDir, 'page-metrics.json');
    const sessionMetricsFile = join(cfg.dataDir, 'session-metrics.json');

    try {
      const pageData = await readFile(pageMetricsFile, 'utf-8');
      const pages = JSON.parse(pageData) as Array<{
        path: string;
        views: number;
        uniqueVisitors: string[];
        lastAccessed: string;
      }>;
      for (const page of pages) {
        this.pageMetrics.set(page.path, {
          ...page,
          uniqueVisitors: new Set(page.uniqueVisitors),
          lastAccessed: new Date(page.lastAccessed),
        });
      }

      const sessionData = await readFile(sessionMetricsFile, 'utf-8');
      const sessions = JSON.parse(sessionData) as Array<{
        sessionId: string;
        userId?: string;
        startTime: string;
        lastActivity: string;
        pageViews: number;
        pages: string[];
        referrer?: string;
        userAgent?: string;
      }>;
      for (const session of sessions) {
        this.sessionMetrics.set(session.sessionId, {
          ...session,
          startTime: new Date(session.startTime),
          lastActivity: new Date(session.lastActivity),
        });
      }

      if (cfg.isDevelopment) {
        logger.info('[MetricsCollector] Loaded persisted metrics');
      }
    } catch {
      if (cfg.isDevelopment) {
        logger.info(
          '[MetricsCollector] No persisted metrics found, starting fresh',
        );
      }
    }
  }

  /** Persist current metrics to disk as JSON. */
  async persistData(): Promise<void> {
    const cfg = getMetricsConfig();
    const logger = cfg.getLogger();
    const pageMetricsFile = join(cfg.dataDir, 'page-metrics.json');
    const sessionMetricsFile = join(cfg.dataDir, 'session-metrics.json');

    try {
      const pages = Array.from(this.pageMetrics.entries()).map(
        ([path, data]) => ({
          path,
          views: data.views,
          uniqueVisitors: Array.from(data.uniqueVisitors),
          lastAccessed: data.lastAccessed,
        }),
      );

      const sessions = Array.from(this.sessionMetrics.values());

      await writeFile(pageMetricsFile, JSON.stringify(pages, null, 2));
      await writeFile(sessionMetricsFile, JSON.stringify(sessions, null, 2));

      if (cfg.isDevelopment) {
        logger.info('[MetricsCollector] Persisted metrics to disk');
      }
    } catch (error) {
      logger.error('[MetricsCollector] Failed to persist metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Factory and singleton helpers
// ---------------------------------------------------------------------------

/** Create a fresh MetricsCollector instance. */
export function createMetricsCollector(): MetricsCollector {
  return new MetricsCollector();
}

let singletonInstance: MetricsCollector | null = null;

/** Lazy singleton getter for backward compatibility. */
export function getMetricsCollector(): MetricsCollector {
  if (!singletonInstance) {
    singletonInstance = new MetricsCollector();
  }
  return singletonInstance;
}

/**
 * Reset the singleton (for testing purposes).
 * Destroys the existing instance if present.
 */
export function resetMetricsCollectorSingleton(): void {
  if (singletonInstance) {
    singletonInstance.destroy();
    singletonInstance = null;
  }
}
