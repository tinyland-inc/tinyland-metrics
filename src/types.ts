







export interface PageMetrics {
  path: string;
  views: number;
  uniqueVisitors: Set<string>;
  lastAccessed: Date;
}


export interface SerializedPageMetrics {
  path: string;
  views: number;
  uniqueVisitors: string[];
  lastAccessed: string;
}


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


export interface TrafficSource {
  source: string;
  visits: number;
  percentage?: number;
}


export interface TopPage {
  path: string;
  views: number;
  uniqueVisitors: number;
  percentage: number;
}


export interface RequestDurationBuckets {
  
  bucket1: number;
  
  bucket2: number;
  
  bucket3: number;
  
  total: number;
}


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


export interface RealtimeEvent {
  type: 'connection' | 'heartbeat' | 'metrics' | 'logs' | 'alerts' | 'system';
  timestamp: number;
  data?: unknown;
  clientId?: string;
  message?: string;
}
