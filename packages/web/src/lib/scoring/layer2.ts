import type { ScoringFlag, ScoringContext } from './types';

const HEDGING_PATTERNS = [
  'i think', 'i believe', 'it seems', 'possibly', 'perhaps',
  'i\'m not sure', 'i\'m not certain', 'it\'s possible that',
];

const NEGATIVE_SENTIMENT = [
  'terrible', 'awful', 'horrible', 'worst', 'angry', 'frustrated',
  'unacceptable', 'ridiculous', 'disappointed', 'furious',
];

export function scoreLayer2(ctx: ScoringContext): ScoringFlag[] {
  const flags: ScoringFlag[] = [];
  const lower = ctx.responseText.toLowerCase();

  if (ctx.isError || ctx.responseText.length === 0) return flags;

  if (ctx.recentResponseLengths && ctx.recentResponseLengths.length >= 5) {
    const avg = ctx.recentResponseLengths.reduce((a, b) => a + b, 0) / ctx.recentResponseLengths.length;
    const ratio = ctx.responseText.length / avg;

    if (ratio < 0.1 && ctx.responseText.length < 50) {
      flags.push({
        category: 'ANOMALY',
        severity: 'MEDIUM',
        reason: `Unusually short response (${ctx.responseText.length} chars vs avg ${Math.round(avg)})`,
        layer: 2,
      });
    } else if (ratio > 5) {
      flags.push({
        category: 'ANOMALY',
        severity: 'LOW',
        reason: `Unusually long response (${ctx.responseText.length} chars vs avg ${Math.round(avg)})`,
        layer: 2,
      });
    }
  }

  let hedgeCount = 0;
  for (const pattern of HEDGING_PATTERNS) {
    if (lower.includes(pattern)) hedgeCount++;
  }
  if (hedgeCount >= 3) {
    flags.push({
      category: 'HALLUCINATION',
      severity: 'LOW',
      reason: `Excessive hedging detected (${hedgeCount} hedging phrases)`,
      layer: 2,
    });
  }

  let negCount = 0;
  for (const word of NEGATIVE_SENTIMENT) {
    if (lower.includes(word)) negCount++;
  }
  if (negCount >= 2) {
    flags.push({
      category: 'SENTIMENT_NEGATIVE',
      severity: 'MEDIUM',
      reason: `Negative sentiment detected (${negCount} negative indicators)`,
      layer: 2,
    });
  }

  const sentences = ctx.responseText.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 10);
  const sentenceCounts = new Map<string, number>();
  for (const s of sentences) {
    sentenceCounts.set(s, (sentenceCounts.get(s) || 0) + 1);
  }
  for (const [, count] of sentenceCounts) {
    if (count >= 3) {
      flags.push({
        category: 'ANOMALY',
        severity: 'HIGH',
        reason: `Repetition detected: sentence repeated ${count} times`,
        layer: 2,
      });
      break;
    }
  }

  return flags;
}
