import { FlagCategory, Severity } from '@prisma/client';
import type { ScoringFlag, ScoringContext } from './types';

const AI_LEAK_PATTERNS = [
  'as an ai language model',
  'as a large language model',
  'i don\'t have access to',
  'i cannot browse the internet',
  'my training data',
  'i was trained',
  'as an artificial intelligence',
];

export function scoreLayer1(ctx: ScoringContext): ScoringFlag[] {
  const flags: ScoringFlag[] = [];
  const lower = ctx.responseText.toLowerCase();

  if (ctx.isError) {
    flags.push({
      category: 'TOOL_FAILURE' as FlagCategory,
      severity: (ctx.errorMessage?.includes('timeout') ? 'HIGH' : 'MEDIUM') as Severity,
      reason: `Error: ${ctx.errorMessage || 'Unknown error'}`,
      layer: 1,
    });
  }

  if (!ctx.isError && ctx.responseText.trim().length === 0) {
    flags.push({
      category: 'ANOMALY' as FlagCategory,
      severity: 'HIGH' as Severity,
      reason: 'Empty response returned',
      layer: 1,
    });
  }

  for (const pattern of AI_LEAK_PATTERNS) {
    if (lower.includes(pattern)) {
      flags.push({
        category: 'HALLUCINATION' as FlagCategory,
        severity: 'MEDIUM' as Severity,
        reason: `AI identity leak detected: "${pattern}"`,
        layer: 1,
      });
      break;
    }
  }

  if (ctx.agentConfig.blockedKeywords) {
    for (const keyword of ctx.agentConfig.blockedKeywords) {
      if (lower.includes(keyword.toLowerCase())) {
        flags.push({
          category: 'OFF_BRAND' as FlagCategory,
          severity: 'MEDIUM' as Severity,
          reason: `Blocked keyword detected: "${keyword}"`,
          layer: 1,
        });
      }
    }
  }

  if (ctx.agentConfig.requiredKeywords && !ctx.isError && ctx.responseText.length > 0) {
    for (const keyword of ctx.agentConfig.requiredKeywords) {
      if (!lower.includes(keyword.toLowerCase())) {
        flags.push({
          category: 'POLICY_VIOLATION' as FlagCategory,
          severity: 'LOW' as Severity,
          reason: `Required keyword missing: "${keyword}"`,
          layer: 1,
        });
      }
    }
  }

  return flags;
}
