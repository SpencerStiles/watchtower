import type { EventPayload } from '../types';

type OnEvent = (event: EventPayload) => void;

export function wrapOpenAI(client: any, sessionId: string, onEvent: OnEvent): any {
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  const wrappedClient = Object.create(client);
  wrappedClient.chat = Object.create(client.chat);
  wrappedClient.chat.completions = Object.create(client.chat.completions);

  wrappedClient.chat.completions.create = async function (params: any, options?: any) {
    const start = Date.now();
    try {
      const response = await originalCreate(params, options);
      const latencyMs = Date.now() - start;

      onEvent({
        sessionId,
        provider: 'openai',
        model: response.model || params.model,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
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
        provider: 'openai',
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
