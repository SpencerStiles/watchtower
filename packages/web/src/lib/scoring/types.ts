import { FlagCategory, Severity } from '@prisma/client';

export interface ScoringFlag {
  category: FlagCategory;
  severity: Severity;
  reason: string;
  layer: number;
}

export interface AgentConfig {
  blockedKeywords?: string[];
  requiredKeywords?: string[];
  maxResponseLength?: number;
}

export interface ScoringContext {
  responseText: string;
  isError: boolean;
  errorMessage: string | null;
  agentConfig: AgentConfig;
  recentResponseLengths?: number[];
}
