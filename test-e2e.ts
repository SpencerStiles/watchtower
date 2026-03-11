import { WatchTower } from './packages/sdk/src';

const wt = new WatchTower({
  apiKey: 'wt_seed_key_alpha_000000000000000000000000000000000000000000000000',
  agentId: 'seed_agent_alpha',
  endpoint: 'http://localhost:3000/api/v1',
});

const mockClient = {
  messages: {
    create: async (params: any) => ({
      model: params.model,
      content: [{ type: 'text', text: 'Hello! I am your AI assistant.' }],
      usage: { input_tokens: 50, output_tokens: 100 },
    }),
  },
};

const monitored = wt.wrap(mockClient);

async function run() {
  for (let i = 0; i < 10; i++) {
    await monitored.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Test message ${i}` }],
    });
  }
  await wt.flush();
  console.log('Sent 10 test events');
  wt.destroy();
}

run();
