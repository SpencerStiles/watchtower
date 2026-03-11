import type { EventPayload } from '../types';

type OnEvent = (event: EventPayload) => void;

export function wrapAnthropic(client: any, sessionId: string, onEvent: OnEvent): any {
  const originalCreate = client.messages.create.bind(client.messages);

  const wrappedClient = Object.create(client);
  wrappedClient.messages = Object.create(client.messages);

  wrappedClient.messages.create = async function (params: any, options?: any) {
    const start = Date.now();
    try {
      const response = await originalCreate(params, options);
      const latencyMs = Date.now() - start;

      onEvent({
        sessionId,
        provider: 'anthropic',
        model: response.model || params.model,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
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
        sessionId,
        provider: 'anthropic',
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

  return wrappedClient;
}
