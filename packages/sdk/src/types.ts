export interface WatchTowerConfig {
  apiKey: string;
  agentId: string;
  endpoint?: string;
  sessionId?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxBufferSize?: number;
}

export interface EventPayload {
  sessionId: string;
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
