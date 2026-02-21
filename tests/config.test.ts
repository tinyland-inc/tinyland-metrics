import { describe, it, expect, beforeEach } from 'vitest';
import {
	configureMetrics,
	getMetricsConfig,
	resetMetricsConfig,
} from '../src/config.js';

describe('metrics config', () => {
	beforeEach(() => {
		resetMetricsConfig();
	});

	describe('getMetricsConfig defaults', () => {
		it('returns default dataDir', () => {
			expect(getMetricsConfig().dataDir).toBe('data/metrics');
		});

		it('returns default isDevelopment as false', () => {
			expect(getMetricsConfig().isDevelopment).toBe(false);
		});

		it('returns default logger that is noop', () => {
			const logger = getMetricsConfig().getLogger();
			expect(logger.info).toBeTypeOf('function');
			expect(logger.warn).toBeTypeOf('function');
			expect(logger.error).toBeTypeOf('function');
			expect(logger.debug).toBeTypeOf('function');
			// Should not throw
			logger.info('test');
			logger.warn('test');
			logger.error('test');
			logger.debug('test');
		});

		it('returns default cleanupIntervalMs of 1 hour', () => {
			expect(getMetricsConfig().cleanupIntervalMs).toBe(3600000);
		});

		it('returns default persistIntervalMs of 5 minutes', () => {
			expect(getMetricsConfig().persistIntervalMs).toBe(300000);
		});

		it('returns default registerShutdownHook as false', () => {
			expect(getMetricsConfig().registerShutdownHook).toBe(false);
		});
	});

	describe('configureMetrics', () => {
		it('sets dataDir', () => {
			configureMetrics({ dataDir: '/tmp/metrics' });
			expect(getMetricsConfig().dataDir).toBe('/tmp/metrics');
		});

		it('sets isDevelopment', () => {
			configureMetrics({ isDevelopment: true });
			expect(getMetricsConfig().isDevelopment).toBe(true);
		});

		it('sets custom logger', () => {
			const customLogger = {
				info: () => {},
				warn: () => {},
				error: () => {},
				debug: () => {},
			};
			configureMetrics({ getLogger: () => customLogger });
			expect(getMetricsConfig().getLogger()).toBe(customLogger);
		});

		it('sets cleanupIntervalMs', () => {
			configureMetrics({ cleanupIntervalMs: 5000 });
			expect(getMetricsConfig().cleanupIntervalMs).toBe(5000);
		});

		it('sets persistIntervalMs', () => {
			configureMetrics({ persistIntervalMs: 1000 });
			expect(getMetricsConfig().persistIntervalMs).toBe(1000);
		});

		it('sets registerShutdownHook', () => {
			configureMetrics({ registerShutdownHook: true });
			expect(getMetricsConfig().registerShutdownHook).toBe(true);
		});

		it('merges with existing config', () => {
			configureMetrics({ dataDir: '/tmp/a' });
			configureMetrics({ isDevelopment: true });
			const cfg = getMetricsConfig();
			expect(cfg.dataDir).toBe('/tmp/a');
			expect(cfg.isDevelopment).toBe(true);
		});

		it('overrides existing values', () => {
			configureMetrics({ dataDir: '/tmp/a' });
			configureMetrics({ dataDir: '/tmp/b' });
			expect(getMetricsConfig().dataDir).toBe('/tmp/b');
		});
	});

	describe('resetMetricsConfig', () => {
		it('resets all config to defaults', () => {
			configureMetrics({
				dataDir: '/custom',
				isDevelopment: true,
				cleanupIntervalMs: 999,
			});
			resetMetricsConfig();
			const cfg = getMetricsConfig();
			expect(cfg.dataDir).toBe('data/metrics');
			expect(cfg.isDevelopment).toBe(false);
			expect(cfg.cleanupIntervalMs).toBe(3600000);
		});
	});
});
