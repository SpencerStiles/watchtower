import { randomBytes } from 'crypto';
import type { WatchTowerConfig, EventPayload } from './types';
import { Transport } from './transport';
import { Batcher } from './batcher';
import { wrapAnthropic } from './wrappers/anthropic';
import { wrapOpenAI } from './wrappers/openai';

const DEFAULT_ENDPOINT = 'https://watchtower.dev/api/v1';

export class WatchTower {
  readonly sessionId: string;
  private agentId: string;
  private transport: Transport;
  private batcher: Batcher;

  constructor(config: WatchTowerConfig) {
    if (!config.apiKey) throw new Error('WatchTower: apiKey is required');
    if (!config.agentId) throw new Error('WatchTower: agentId is required');

    this.sessionId = config.sessionId ?? `sess_${randomBytes(12).toString('hex')}`;
    this.agentId = config.agentId;
    const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;

    this.transport = new Transport(config.apiKey, endpoint, {
      maxBufferSize: config.maxBufferSize ?? 1000,
      onDrop: config.onDrop,
    });

    this.batcher = new Batcher({
      batchSize: config.batchSize ?? 50,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      onFlush: (events) => this.transport.send(events),
    });
  }

  wrap<T>(client: T): T {
    const onEvent = (event: EventPayload) => this.batcher.add(event);

    // Detect Anthropic client (has client.messages.create)
    if ((client as any)?.messages?.create) {
      return wrapAnthropic(client, this.sessionId, this.agentId, onEvent) as T;
    }

    // Detect OpenAI client (has client.chat.completions.create)
    if ((client as any)?.chat?.completions?.create) {
      return wrapOpenAI(client, this.sessionId, this.agentId, onEvent) as T;
    }

    throw new Error(
      'WatchTower: Unsupported client. Pass an Anthropic or OpenAI client instance.'
    );
  }

  async flush(): Promise<void> {
    await this.batcher.flush();
  }

  destroy(): void {
    this.batcher.destroy();
  }
}
