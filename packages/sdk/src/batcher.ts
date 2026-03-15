import type { EventPayload } from './types';

interface BatcherOptions {
  batchSize: number;
  flushIntervalMs: number;
  onFlush: (events: EventPayload[]) => Promise<void>;
}

export class Batcher {
  private queue: EventPayload[] = [];
  private options: BatcherOptions;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: BatcherOptions) {
    this.options = options;
    this.timer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush().catch((err) => {
          console.error('[WatchTower] Batcher flush failed:', err);
        });
      }
    }, options.flushIntervalMs);
  }

  add(event: EventPayload): void {
    this.queue.push(event);
    if (this.queue.length >= this.options.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    await this.options.onFlush(batch);
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
