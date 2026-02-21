/**
 * Dependency-injection configuration for tinyland-metrics.
 *
 * Consumers call `configureMetrics()` once at startup to provide
 * environment-specific values (data directory, logger, timers, etc.).
 * Internal code reads values via `getMetricsConfig()` which fills in
 * sensible defaults for anything not explicitly set.
 */

/** Logger interface accepted by the metrics package. */
export interface MetricsLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
}

/** Configuration options for the metrics package. */
export interface MetricsConfig {
  /** Directory for persisted metrics files. Defaults to 'data/metrics'. */
  dataDir?: string;
  /** Whether running in development mode. Defaults to false. */
  isDevelopment?: boolean;
  /** Logger factory. Defaults to noop logger. */
  getLogger?: () => MetricsLogger;
  /** Cleanup interval in ms. Defaults to 3600000 (1 hour). */
  cleanupIntervalMs?: number;
  /** Persist interval in ms. Defaults to 300000 (5 minutes). */
  persistIntervalMs?: number;
  /** Register process.on('beforeExit') for cleanup. Defaults to false. */
  registerShutdownHook?: boolean;
}

/** A no-op logger used when no logger is configured. */
const noopLogger: MetricsLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/** The resolved config type where every field has a value. */
export type ResolvedMetricsConfig = Required<MetricsConfig>;

let config: MetricsConfig = {};

/**
 * Set (or merge) metrics configuration.
 * Typically called once at application startup.
 */
export function configureMetrics(c: MetricsConfig): void {
  config = { ...config, ...c };
}

/**
 * Retrieve the fully-resolved configuration with defaults applied.
 */
export function getMetricsConfig(): ResolvedMetricsConfig {
  return {
    dataDir: config.dataDir ?? 'data/metrics',
    isDevelopment: config.isDevelopment ?? false,
    getLogger: config.getLogger ?? (() => noopLogger),
    cleanupIntervalMs: config.cleanupIntervalMs ?? 3600000,
    persistIntervalMs: config.persistIntervalMs ?? 300000,
    registerShutdownHook: config.registerShutdownHook ?? false,
  };
}

/**
 * Reset configuration to empty (defaults will be used).
 * Primarily useful in tests.
 */
export function resetMetricsConfig(): void {
  config = {};
}
