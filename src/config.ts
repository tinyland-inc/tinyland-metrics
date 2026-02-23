









export interface MetricsLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
}


export interface MetricsConfig {
  
  dataDir?: string;
  
  isDevelopment?: boolean;
  
  getLogger?: () => MetricsLogger;
  
  cleanupIntervalMs?: number;
  
  persistIntervalMs?: number;
  
  registerShutdownHook?: boolean;
}


const noopLogger: MetricsLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};


export type ResolvedMetricsConfig = Required<MetricsConfig>;

let config: MetricsConfig = {};





export function configureMetrics(c: MetricsConfig): void {
  config = { ...config, ...c };
}




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





export function resetMetricsConfig(): void {
  config = {};
}
