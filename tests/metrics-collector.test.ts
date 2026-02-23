import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureMetrics, resetMetricsConfig } from '../src/config.js';


vi.mock('fs/promises', () => ({
	readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
	writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { readFile, writeFile } from 'fs/promises';
import {
	MetricsCollector,
	createMetricsCollector,
	getMetricsCollector,
	resetMetricsCollectorSingleton,
} from '../src/metrics-collector.js';

describe('MetricsCollector', () => {
	let collector: MetricsCollector;

	beforeEach(() => {
		vi.useFakeTimers();
		resetMetricsConfig();
		resetMetricsCollectorSingleton();
		vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
		vi.mocked(writeFile).mockResolvedValue(undefined);
		collector = createMetricsCollector();
	});

	afterEach(() => {
		collector.destroy();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe('trackPageView', () => {
		it('creates new page entry on first view', () => {
			collector.trackPageView('s1', '/home');
			const metrics = collector.getMetrics();
			expect(metrics.pageViews).toBe(1);
		});

		it('increments view count for existing page', () => {
			collector.trackPageView('s1', '/home');
			collector.trackPageView('s2', '/home');
			const metrics = collector.getMetrics();
			expect(metrics.pageViews).toBe(2);
		});

		it('tracks unique visitors per page', () => {
			collector.trackPageView('s1', '/home');
			collector.trackPageView('s1', '/home'); 
			collector.trackPageView('s2', '/home');
			const metrics = collector.getMetrics();
			expect(metrics.topPages[0].uniqueVisitors).toBe(2);
		});

		it('creates session on first page view', () => {
			collector.trackPageView('s1', '/home');
			const session = collector.getSessionMetrics('s1');
			expect(session).not.toBeNull();
			expect(session!.sessionId).toBe('s1');
			expect(session!.pageViews).toBe(1);
		});

		it('updates existing session', () => {
			collector.trackPageView('s1', '/home');
			collector.trackPageView('s1', '/about');
			const session = collector.getSessionMetrics('s1');
			expect(session!.pageViews).toBe(2);
			expect(session!.pages).toEqual(['/home', '/about']);
		});

		it('does not duplicate pages in session', () => {
			collector.trackPageView('s1', '/home');
			collector.trackPageView('s1', '/home');
			const session = collector.getSessionMetrics('s1');
			expect(session!.pages).toEqual(['/home']);
		});

		it('increments request count', () => {
			collector.trackPageView('s1', '/a');
			collector.trackPageView('s2', '/b');
			expect(collector.getMetrics().totalRequests).toBe(2);
		});

		it('stores referrer on session', () => {
			collector.trackPageView('s1', '/', undefined, 'https://google.com');
			expect(collector.getSessionMetrics('s1')!.referrer).toBe('https://google.com');
		});

		it('stores userId on session', () => {
			collector.trackPageView('s1', '/', 'user-42');
			expect(collector.getSessionMetrics('s1')!.userId).toBe('user-42');
		});

		it('stores userAgent on session', () => {
			collector.trackPageView('s1', '/', undefined, undefined, 'Mozilla/5.0');
			expect(collector.getSessionMetrics('s1')!.userAgent).toBe('Mozilla/5.0');
		});
	});

	describe('trackError', () => {
		it('increments error count', () => {
			collector.trackError();
			collector.trackError();
			expect(collector.getMetrics().totalErrors).toBe(2);
		});
	});

	describe('getSessionMetrics', () => {
		it('returns null for null sessionId', () => {
			expect(collector.getSessionMetrics(null)).toBeNull();
		});

		it('returns null for non-existent session', () => {
			expect(collector.getSessionMetrics('nonexistent')).toBeNull();
		});

		it('returns session data for existing session', () => {
			collector.trackPageView('s1', '/test');
			const session = collector.getSessionMetrics('s1');
			expect(session).not.toBeNull();
			expect(session!.sessionId).toBe('s1');
		});
	});

	describe('getMetrics', () => {
		it('returns correct totalVisitors', () => {
			collector.trackPageView('s1', '/');
			collector.trackPageView('s2', '/');
			expect(collector.getMetrics().totalVisitors).toBe(2);
		});

		it('returns correct activeUsers (within 30 min)', () => {
			collector.trackPageView('s1', '/');
			expect(collector.getMetrics().activeUsers).toBe(1);
		});

		it('excludes inactive users from activeUsers', () => {
			collector.trackPageView('s1', '/');
			vi.advanceTimersByTime(31 * 60 * 1000); 
			expect(collector.getMetrics().activeUsers).toBe(0);
		});

		it('calculates bounceRate for single-page sessions', () => {
			collector.trackPageView('s1', '/'); 
			collector.trackPageView('s2', '/');
			collector.trackPageView('s2', '/about'); 
			expect(collector.getMetrics().bounceRate).toBe(50);
		});

		it('returns 0 bounceRate with no sessions', () => {
			expect(collector.getMetrics().bounceRate).toBe(0);
		});

		it('returns top 5 pages sorted by views', () => {
			for (let i = 0; i < 6; i++) {
				collector.trackPageView(`s${i}`, `/page-${i}`);
			}
			
			collector.trackPageView('extra1', '/page-0');
			collector.trackPageView('extra2', '/page-0');
			const top = collector.getMetrics().topPages;
			expect(top.length).toBeLessThanOrEqual(5);
			expect(top[0].path).toBe('/page-0');
		});

		it('calculates page percentages', () => {
			collector.trackPageView('s1', '/a');
			collector.trackPageView('s2', '/a');
			collector.trackPageView('s3', '/b');
			const metrics = collector.getMetrics();
			const pageA = metrics.topPages.find((p) => p.path === '/a');
			expect(pageA!.percentage).toBeCloseTo(66.67, 0);
		});

		it('returns avgSessionDuration format', () => {
			collector.trackPageView('s1', '/');
			expect(collector.getMetrics().avgSessionDuration).toMatch(/\d+m \d+s/);
		});

		it('returns uptime in seconds', () => {
			vi.advanceTimersByTime(5000);
			expect(collector.getMetrics().uptime).toBeGreaterThanOrEqual(5);
		});

		it('returns request duration buckets', () => {
			collector.trackPageView('s1', '/');
			collector.trackPageView('s2', '/');
			const dur = collector.getMetrics().requestDuration;
			expect(dur.total).toBe(2);
			expect(dur.bucket1).toBeLessThanOrEqual(dur.bucket2);
			expect(dur.bucket2).toBeLessThanOrEqual(dur.bucket3);
		});

		it('returns requestRate and errorRate', () => {
			collector.trackPageView('s1', '/');
			collector.trackError();
			vi.advanceTimersByTime(1000);
			const m = collector.getMetrics();
			expect(m.requestRate).toBeGreaterThan(0);
			expect(m.errorRate).toBeGreaterThan(0);
		});
	});

	describe('categorizeReferrer', () => {
		it('returns Direct for empty referrer', () => {
			expect(collector.categorizeReferrer('')).toBe('Direct');
		});

		it('returns Direct for undefined referrer', () => {
			expect(collector.categorizeReferrer(undefined)).toBe('Direct');
		});

		it('returns Social Media for facebook', () => {
			expect(collector.categorizeReferrer('https://facebook.com/page')).toBe('Social Media');
		});

		it('returns Social Media for twitter', () => {
			expect(collector.categorizeReferrer('https://twitter.com/user')).toBe('Social Media');
		});

		it('returns Social Media for instagram', () => {
			expect(collector.categorizeReferrer('https://instagram.com/p/123')).toBe('Social Media');
		});

		it('returns Social Media for linkedin', () => {
			expect(collector.categorizeReferrer('https://linkedin.com/in/user')).toBe('Social Media');
		});

		it('returns Social Media for youtube', () => {
			expect(collector.categorizeReferrer('https://youtube.com/watch')).toBe('Social Media');
		});

		it('returns Social Media for tiktok', () => {
			expect(collector.categorizeReferrer('https://tiktok.com/@user')).toBe('Social Media');
		});

		it('returns Search for google', () => {
			expect(collector.categorizeReferrer('https://www.google.com/search?q=test')).toBe('Search');
		});

		it('returns Search for bing', () => {
			expect(collector.categorizeReferrer('https://bing.com/search')).toBe('Search');
		});

		it('returns Search for yahoo', () => {
			expect(collector.categorizeReferrer('https://search.yahoo.com/')).toBe('Search');
		});

		it('returns Search for duckduckgo', () => {
			expect(collector.categorizeReferrer('https://duckduckgo.com/?q=test')).toBe('Search');
		});

		it('returns Internal for localhost', () => {
			expect(collector.categorizeReferrer('http://localhost:5174/')).toBe('Internal');
		});

		it('returns Internal for stonewallunderground.com', () => {
			expect(collector.categorizeReferrer('https://stonewallunderground.com/')).toBe('Internal');
		});

		it('returns Referral for unknown domains', () => {
			expect(collector.categorizeReferrer('https://example.com/link')).toBe('Referral');
		});

		it('returns Direct for invalid URLs', () => {
			expect(collector.categorizeReferrer('not-a-url')).toBe('Direct');
		});
	});

	describe('analyzeTrafficSources', () => {
		it('returns empty array with no sessions', () => {
			expect(collector.analyzeTrafficSources()).toEqual([]);
		});

		it('groups sessions by source', () => {
			collector.trackPageView('s1', '/', undefined, 'https://google.com');
			collector.trackPageView('s2', '/', undefined, 'https://google.com');
			collector.trackPageView('s3', '/', undefined, 'https://facebook.com');
			const sources = collector.analyzeTrafficSources();
			expect(sources.length).toBe(2);
			const search = sources.find((s) => s.source === 'Search');
			expect(search!.visits).toBe(2);
			expect(search!.percentage).toBeCloseTo(66.67, 0);
		});
	});

	describe('cleanupOldSessions', () => {
		it('removes sessions older than 24 hours', () => {
			collector.trackPageView('s1', '/');
			vi.advanceTimersByTime(25 * 60 * 60 * 1000); 
			collector.cleanupOldSessions();
			expect(collector.getMetrics().totalVisitors).toBe(0);
		});

		it('keeps recent sessions', () => {
			collector.trackPageView('s1', '/');
			vi.advanceTimersByTime(12 * 60 * 60 * 1000); 
			collector.cleanupOldSessions();
			expect(collector.getMetrics().totalVisitors).toBe(1);
		});
	});

	describe('persistData', () => {
		it('writes page metrics and session metrics files', async () => {
			collector.trackPageView('s1', '/test');
			vi.mocked(writeFile).mockClear();
			await collector.persistData();
			expect(writeFile).toHaveBeenCalledTimes(2);
		});

		it('serializes Sets to arrays', async () => {
			collector.trackPageView('s1', '/test');
			vi.mocked(writeFile).mockClear();
			await collector.persistData();
			const call = vi.mocked(writeFile).mock.calls[0];
			const data = JSON.parse(call[1] as string);
			expect(Array.isArray(data[0].uniqueVisitors)).toBe(true);
		});
	});

	describe('loadPersistedData', () => {
		it('loads page metrics from file', async () => {
			vi.mocked(readFile)
				.mockResolvedValueOnce(
					JSON.stringify([
						{
							path: '/saved',
							views: 10,
							uniqueVisitors: ['a', 'b'],
							lastAccessed: '2024-01-01T00:00:00Z',
						},
					]),
				)
				.mockResolvedValueOnce(JSON.stringify([]));

			const c2 = createMetricsCollector();
			await c2.loadPersistedData();
			const metrics = c2.getMetrics();
			expect(metrics.pageViews).toBe(10);
			c2.destroy();
		});

		it('handles missing files gracefully', async () => {
			vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
			const c2 = createMetricsCollector();
			await expect(c2.loadPersistedData()).resolves.not.toThrow();
			c2.destroy();
		});
	});

	describe('destroy', () => {
		it('clears intervals', () => {
			const clearSpy = vi.spyOn(global, 'clearInterval');
			collector.destroy();
			expect(clearSpy).toHaveBeenCalledTimes(2);
		});

		it('persists data on destroy', async () => {
			collector.trackPageView('s1', '/');
			collector.destroy();
			
			expect(writeFile).toHaveBeenCalled();
		});
	});

	describe('factory and singleton', () => {
		it('createMetricsCollector returns new instance each time', () => {
			const a = createMetricsCollector();
			const b = createMetricsCollector();
			expect(a).not.toBe(b);
			a.destroy();
			b.destroy();
		});

		it('getMetricsCollector returns same instance', () => {
			const a = getMetricsCollector();
			const b = getMetricsCollector();
			expect(a).toBe(b);
		});

		it('resetMetricsCollectorSingleton clears singleton', () => {
			const a = getMetricsCollector();
			resetMetricsCollectorSingleton();
			const b = getMetricsCollector();
			expect(a).not.toBe(b);
			b.destroy();
		});
	});
});
