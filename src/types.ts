/**
 * Types for the tinyland-metrics package.
 *
 * All interfaces used by the MetricsCollector and EventStreamManager
 * are defined here for a single source of truth.
 */

/** Metrics for a single page/path. */
export interface PageMetrics {
  path: string;
  views: number;
  uniqueVisitors: Set<string>;
  lastAccessed: Date;
}

/** Serialized form of PageMetrics (Sets become arrays, Dates become strings). */
export interface SerializedPageMetrics {
  path: string;
  views: number;
  uniqueVisitors: string[];
  lastAccessed: string;
}

/** Metrics for a single user session. */
export interface SessionMetrics {
  sessionId: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  pageViews: number;
  pages: string[];
  referrer?: string;
  userAgent?: string;
}

/** A categorized traffic source with visit count and percentage. */
export interface TrafficSource {
  source: string;
  visits: number;
  percentage?: number;
}

/** A top page entry including computed percentage. */
export interface TopPage {
  path: string;
  views: number;
  uniqueVisitors: number;
  percentage: number;
}

/** Request duration distribution buckets. */
export interface RequestDurationBuckets {
  /** Count of requests under 0.1s (70th percentile estimate). */
  bucket1: number;
  /** Count of requests under 0.5s (90th percentile estimate). */
  bucket2: number;
  /** Count of requests under 1s (98th percentile estimate). */
  bucket3: number;
  /** Total request count. */
  total: number;
}

/** The full metrics snapshot returned by MetricsCollector.getMetrics(). */
export interface MetricsData {
  totalVisitors: number;
  activeUsers: number;
  pageViews: number;
  totalRequests: number;
  totalErrors: number;
  avgSessionDuration: string;
  bounceRate: number;
  topPages: TopPage[];
  trafficSources: TrafficSource[];
  activeSessions: number;
  uptime: number;
  requestRate: number;
  errorRate: number;
  requestDuration: RequestDurationBuckets;
}

/** An event broadcast through the SSE event stream. */
export interface RealtimeEvent {
  type: 'connection' | 'heartbeat' | 'metrics' | 'logs' | 'alerts' | 'system';
  timestamp: number;
  data?: unknown;
  clientId?: string;
  message?: string;
}
