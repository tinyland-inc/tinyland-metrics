import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMetricsConfig } from '../src/config.js';
import { EventStreamManager, getEventStreamManager } from '../src/event-stream.js';

function createMockController() {
	return {
		enqueue: vi.fn(),
		close: vi.fn(),
		desiredSize: 1,
		error: vi.fn(),
	} as unknown as ReadableStreamDefaultController;
}

describe('EventStreamManager', () => {
	beforeEach(() => {
		resetMetricsConfig();
		EventStreamManager.resetInstance();
	});

	describe('singleton', () => {
		it('getInstance returns the same instance', () => {
			const a = EventStreamManager.getInstance();
			const b = EventStreamManager.getInstance();
			expect(a).toBe(b);
		});

		it('getEventStreamManager returns singleton', () => {
			const a = getEventStreamManager();
			const b = EventStreamManager.getInstance();
			expect(a).toBe(b);
		});

		it('resetInstance creates new instance', () => {
			const a = EventStreamManager.getInstance();
			EventStreamManager.resetInstance();
			const b = EventStreamManager.getInstance();
			expect(a).not.toBe(b);
		});
	});

	describe('addClient', () => {
		it('adds a client', () => {
			const mgr = EventStreamManager.getInstance();
			const ctrl = createMockController();
			mgr.addClient('c1', ctrl);
			expect(mgr.getClientCount()).toBe(1);
		});

		it('adds multiple clients', () => {
			const mgr = EventStreamManager.getInstance();
			mgr.addClient('c1', createMockController());
			mgr.addClient('c2', createMockController());
			expect(mgr.getClientCount()).toBe(2);
		});

		it('replaces client with same ID', () => {
			const mgr = EventStreamManager.getInstance();
			mgr.addClient('c1', createMockController());
			mgr.addClient('c1', createMockController());
			expect(mgr.getClientCount()).toBe(1);
		});
	});

	describe('removeClient', () => {
		it('removes an existing client', () => {
			const mgr = EventStreamManager.getInstance();
			mgr.addClient('c1', createMockController());
			mgr.removeClient('c1');
			expect(mgr.getClientCount()).toBe(0);
		});

		it('does nothing for non-existent client', () => {
			const mgr = EventStreamManager.getInstance();
			mgr.removeClient('nonexistent');
			expect(mgr.getClientCount()).toBe(0);
		});
	});

	describe('getClientCount', () => {
		it('returns 0 when empty', () => {
			expect(EventStreamManager.getInstance().getClientCount()).toBe(0);
		});

		it('returns correct count', () => {
			const mgr = EventStreamManager.getInstance();
			mgr.addClient('c1', createMockController());
			mgr.addClient('c2', createMockController());
			mgr.addClient('c3', createMockController());
			expect(mgr.getClientCount()).toBe(3);
		});
	});

	describe('broadcast', () => {
		it('sends SSE formatted data to all clients', () => {
			const mgr = EventStreamManager.getInstance();
			const ctrl1 = createMockController();
			const ctrl2 = createMockController();
			mgr.addClient('c1', ctrl1);
			mgr.addClient('c2', ctrl2);

			const event = { type: 'metrics' as const, timestamp: 123, data: { foo: 1 } };
			mgr.broadcast(event);

			const expected = `data: ${JSON.stringify(event)}\n\n`;
			expect(ctrl1.enqueue).toHaveBeenCalledWith(expected);
			expect(ctrl2.enqueue).toHaveBeenCalledWith(expected);
		});

		it('removes errored clients', () => {
			const mgr = EventStreamManager.getInstance();
			const ctrl1 = createMockController();
			(ctrl1.enqueue as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error('closed');
			});
			mgr.addClient('c1', ctrl1);
			mgr.addClient('c2', createMockController());

			mgr.broadcast({ type: 'heartbeat', timestamp: 0 });
			expect(mgr.getClientCount()).toBe(1);
		});

		it('sends to zero clients without error', () => {
			const mgr = EventStreamManager.getInstance();
			expect(() => mgr.broadcast({ type: 'heartbeat', timestamp: 0 })).not.toThrow();
		});
	});

	describe('broadcastMetrics', () => {
		it('sends metrics event with correct type', () => {
			const mgr = EventStreamManager.getInstance();
			const ctrl = createMockController();
			mgr.addClient('c1', ctrl);

			mgr.broadcastMetrics({ cpu: 50 });

			const call = (ctrl.enqueue as ReturnType<typeof vi.fn>).mock.calls[0][0];
			const parsed = JSON.parse(call.replace('data: ', '').trim());
			expect(parsed.type).toBe('metrics');
			expect(parsed.data).toEqual({ cpu: 50 });
			expect(parsed.timestamp).toBeTypeOf('number');
		});
	});

	describe('broadcastLogs', () => {
		it('sends logs event with correct type', () => {
			const mgr = EventStreamManager.getInstance();
			const ctrl = createMockController();
			mgr.addClient('c1', ctrl);

			mgr.broadcastLogs([{ msg: 'hello' }]);

			const call = (ctrl.enqueue as ReturnType<typeof vi.fn>).mock.calls[0][0];
			const parsed = JSON.parse(call.replace('data: ', '').trim());
			expect(parsed.type).toBe('logs');
			expect(parsed.data).toEqual([{ msg: 'hello' }]);
		});
	});

	describe('broadcastAlert', () => {
		it('sends alerts event with correct type', () => {
			const mgr = EventStreamManager.getInstance();
			const ctrl = createMockController();
			mgr.addClient('c1', ctrl);

			mgr.broadcastAlert({ level: 'critical' });

			const call = (ctrl.enqueue as ReturnType<typeof vi.fn>).mock.calls[0][0];
			const parsed = JSON.parse(call.replace('data: ', '').trim());
			expect(parsed.type).toBe('alerts');
			expect(parsed.data).toEqual({ level: 'critical' });
		});
	});

	describe('broadcastSystemStatus', () => {
		it('sends system event with correct type', () => {
			const mgr = EventStreamManager.getInstance();
			const ctrl = createMockController();
			mgr.addClient('c1', ctrl);

			mgr.broadcastSystemStatus({ status: 'healthy' });

			const call = (ctrl.enqueue as ReturnType<typeof vi.fn>).mock.calls[0][0];
			const parsed = JSON.parse(call.replace('data: ', '').trim());
			expect(parsed.type).toBe('system');
			expect(parsed.data).toEqual({ status: 'healthy' });
		});
	});
});
