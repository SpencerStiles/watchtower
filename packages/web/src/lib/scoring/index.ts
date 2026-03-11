import type { ScoringFlag, ScoringContext, AgentConfig } from './types';
import { scoreLayer1 } from './layer1';
import { scoreLayer2 } from './layer2';

export type { ScoringFlag, ScoringContext, AgentConfig };

const SEVERITY_DEDUCTIONS: Record<string, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 50,
};

export function scoreEvent(ctx: ScoringContext): { score: number; flags: ScoringFlag[] } {
  const flags = [...scoreLayer1(ctx), ...scoreLayer2(ctx)];

  let score = 100;
  for (const flag of flags) {
    score -= SEVERITY_DEDUCTIONS[flag.severity] ?? 0;
  }

  return { score: Math.max(0, score), flags };
}

export function calculateConversationScore(eventScores: number[]): number {
  if (eventScores.length === 0) return 100;
  return Math.round(eventScores.reduce((a, b) => a + b, 0) / eventScores.length);
}

export function updateAgentScore(currentScore: number | null, newConversationScore: number, alpha = 0.3): number {
  if (currentScore === null) return newConversationScore;
  return Math.round(alpha * newConversationScore + (1 - alpha) * currentScore);
}

export function extractResponseText(responseBody: unknown, provider: string): string {
  if (provider === 'anthropic') {
    const body = responseBody as { content?: unknown };
    const content = body?.content;
    if (Array.isArray(content)) {
      return content
        .filter((c: { type?: string }) => c.type === 'text')
        .map((c: { text?: string }) => c.text ?? '')
        .join('\n');
    }
  }
  if (provider === 'openai') {
    const body = responseBody as { choices?: unknown };
    const choices = body?.choices;
    if (Array.isArray(choices)) {
      return choices.map((c: { message?: { content?: string } }) => c.message?.content || '').join('\n');
    }
  }
  return '';
}
