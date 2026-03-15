import { randomUUID } from 'crypto';
import type { EventPayload } from '../types';

type OnEvent = (event: EventPayload) => void;

export interface WrapperConfig {
  provider: 'openai' | 'anthropic';
  getMethod: (client: any) => (...args: any[]) => Promise<any>;
  setMethod: (wrappedClient: any, wrapped: (...args: any[]) => Promise<any>) => void;
  cloneClient: (client: any) => any;
  getTokens: (response: any) => { inputTokens: number; outputTokens: number };
}

export function createWrapper(
  client: any,
  sessionId: string,
  agentId: string,
  onEvent: OnEvent,
  config: WrapperConfig
): any {
  const original = config.getMethod(client);
  const wrappedClient = config.cloneClient(client);

  const wrappedMethod = async function (params: any, options?: any) {
    if (params?.stream === true) {
      throw new Error(
        'WatchTower does not yet support streaming. Set stream: false or call watchtower.passthrough(client) for unmonitored access.'
      );
    }

    const start = Date.now();
    const eventId = randomUUID();

    try {
      const response = await original(params, options);
      const latencyMs = Date.now() - start;
      const { inputTokens, outputTokens } = config.getTokens(response);

      onEvent({
        eventId,
        sessionId,
        agentId,
        provider: config.provider,
        model: response.model || params.model,
        inputTokens,
        outputTokens,
        latencyMs,
        requestBody: params,
        responseBody: response,
        isError: false,
        errorMessage: null,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const latencyMs = Date.now() - start;

      onEvent({
        eventId,
        sessionId,
        agentId,
        provider: config.provider,
        model: params.model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        requestBody: params,
        responseBody: {},
        isError: true,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  };

  config.setMethod(wrappedClient, wrappedMethod);
  return wrappedClient;
}
