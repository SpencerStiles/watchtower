import type { EventPayload } from '../types';
import { createWrapper } from './create-wrapper';

type OnEvent = (event: EventPayload) => void;

export function wrapOpenAI(client: any, sessionId: string, agentId: string, onEvent: OnEvent): any {
  return createWrapper(client, sessionId, agentId, onEvent, {
    provider: 'openai',
    getMethod: (c) => c.chat.completions.create.bind(c.chat.completions),
    setMethod: (wrappedClient, wrapped) => {
      wrappedClient.chat.completions.create = wrapped;
    },
    cloneClient: (c) => {
      const cloned = Object.create(c);
      cloned.chat = Object.create(c.chat);
      cloned.chat.completions = Object.create(c.chat.completions);
      return cloned;
    },
    getTokens: (response) => ({
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    }),
  });
}
