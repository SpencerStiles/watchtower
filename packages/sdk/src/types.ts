export interface WatchTowerConfig {
  apiKey: string;
  agentId: string;
  endpoint?: string;
  sessionId?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxBufferSize?: number;
  onError?: (error: Error) => void;
  onDrop?: (droppedCount: number) => void;
}

export interface EventPayload {
  eventId: string;
  sessionId: string;
  agentId: string;
  provider: 'anthropic' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  requestBody: unknown;
  responseBody: unknown;
  isError: boolean;
  errorMessage: string | null;
  timestamp: string;
}
