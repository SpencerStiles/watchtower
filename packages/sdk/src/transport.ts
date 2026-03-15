import type { EventPayload } from './types';

interface TransportOptions {
  maxBufferSize?: number;
  onDrop?: (droppedCount: number) => void;
}

export class Transport {
  private apiKey: string;
  private endpoint: string;
  private buffer: EventPayload[] = [];
  private maxBufferSize: number;
  private onDrop?: (droppedCount: number) => void;

  constructor(apiKey: string, endpoint: string, options?: TransportOptions) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.maxBufferSize = options?.maxBufferSize ?? 1000;
    this.onDrop = options?.onDrop;
  }

  get bufferedCount(): number {
    return this.buffer.length;
  }

  async send(events: EventPayload[]): Promise<void> {
    const toSend = [...this.buffer, ...events];
    this.buffer = [];

    try {
      const response = await fetch(`${this.endpoint}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(toSend),
      });

      if (!response.ok) {
        this.addToBuffer(toSend);
      }
    } catch {
      this.addToBuffer(toSend);
    }
  }

  private addToBuffer(events: EventPayload[]): void {
    let droppedCount = 0;
    for (const event of events) {
      if (this.buffer.length >= this.maxBufferSize) {
        droppedCount++;
      } else {
        this.buffer.push(event);
      }
    }
    if (droppedCount > 0) {
      if (this.onDrop) {
        this.onDrop(droppedCount);
      } else {
        console.warn(`[WatchTower] ${droppedCount} event(s) dropped — buffer full (max: ${this.maxBufferSize})`);
      }
    }
  }
}
