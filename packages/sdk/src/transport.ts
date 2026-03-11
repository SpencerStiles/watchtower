import type { EventPayload } from './types';

interface TransportOptions {
  maxBufferSize?: number;
}

export class Transport {
  private apiKey: string;
  private endpoint: string;
  private buffer: EventPayload[] = [];
  private maxBufferSize: number;

  constructor(apiKey: string, endpoint: string, options?: TransportOptions) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.maxBufferSize = options?.maxBufferSize ?? 1000;
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
    for (const event of events) {
      if (this.buffer.length >= this.maxBufferSize) break;
      this.buffer.push(event);
    }
  }
}
