type ModelPricing = { inputPer1M: number; outputPer1M: number };

const MODEL_COSTS: Record<string, ModelPricing> = {
  'claude-opus-4-6': { inputPer1M: 1500, outputPer1M: 7500 },
  'claude-sonnet-4-6': { inputPer1M: 300, outputPer1M: 1500 },
  'claude-haiku-4-5': { inputPer1M: 80, outputPer1M: 400 },
  'gpt-4o': { inputPer1M: 250, outputPer1M: 1000 },
  'gpt-4o-mini': { inputPer1M: 15, outputPer1M: 60 },
  'gpt-4.1': { inputPer1M: 200, outputPer1M: 800 },
  'gpt-4.1-mini': { inputPer1M: 40, outputPer1M: 160 },
  'gpt-4.1-nano': { inputPer1M: 10, outputPer1M: 40 },
};

export function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_COSTS[model];
  if (!pricing) return 0;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Math.round(inputCost + outputCost);
}
