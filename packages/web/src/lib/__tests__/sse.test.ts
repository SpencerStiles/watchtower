import { describe, it, expect } from 'vitest';
import { SSEManager } from '../sse';

describe('SSEManager', () => {
  it('registers and broadcasts to connections', () => {
    const manager = new SSEManager();
    const received: string[] = [];
    const mockWriter = { write: (data: string) => received.push(data) };

    manager.register('agent_1', mockWriter as any);
    manager.broadcast('agent_1', { type: 'event', data: { score: 85 } });

    expect(received.length).toBe(1);
    expect(received[0]).toContain('"score":85');
  });

  it('does not send to other agents', () => {
    const manager = new SSEManager();
    const received: string[] = [];
    const mockWriter = { write: (data: string) => received.push(data) };

    manager.register('agent_2', mockWriter as any);
    manager.broadcast('agent_1', { type: 'event', data: {} });

    expect(received.length).toBe(0);
  });

  it('removes connection on unregister', () => {
    const manager = new SSEManager();
    const received: string[] = [];
    const mockWriter = { write: (data: string) => received.push(data) };

    manager.register('agent_1', mockWriter as any);
    manager.unregister('agent_1', mockWriter as any);
    manager.broadcast('agent_1', { type: 'event', data: {} });

    expect(received.length).toBe(0);
  });
});
