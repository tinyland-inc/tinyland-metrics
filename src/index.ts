/**
 * @tummycrypt/tinyland-metrics
 *
 * In-memory metrics collector and SSE event stream manager
 * for web applications.
 */

// Configuration
export {
  configureMetrics,
  getMetricsConfig,
  resetMetricsConfig,
} from './config.js';
export type {
  MetricsConfig,
  MetricsLogger,
  ResolvedMetricsConfig,
} from './config.js';

// Types
export type {
  MetricsData,
  PageMetrics,
  RealtimeEvent,
  RequestDurationBuckets,
  SerializedPageMetrics,
  SessionMetrics,
  TopPage,
  TrafficSource,
} from './types.js';

// Metrics Collector
export {
  MetricsCollector,
  createMetricsCollector,
  getMetricsCollector,
  resetMetricsCollectorSingleton,
} from './metrics-collector.js';

// Event Stream Manager
export {
  EventStreamManager,
  getEventStreamManager,
} from './event-stream.js';
