import type { EventPayload } from '../types';
import { createWrapper } from './create-wrapper';

type OnEvent = (event: EventPayload) => void;

export function wrapAnthropic(client: any, sessionId: string, agentId: string, onEvent: OnEvent): any {
  return createWrapper(client, sessionId, agentId, onEvent, {
    provider: 'anthropic',
    getMethod: (c) => c.messages.create.bind(c.messages),
    setMethod: (wrappedClient, wrapped) => {
      wrappedClient.messages.create = wrapped;
    },
    cloneClient: (c) => {
      const cloned = Object.create(c);
      cloned.messages = Object.create(c.messages);
      return cloned;
    },
    getTokens: (response) => ({
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    }),
  });
}
