import type { Sentiment, Severity, BuyingSignal, Persona, TargetMarket } from "../types/domain.ts";

export interface AIEvidence {
  excerpt: string;
  charOffset: number;
  charLength: number;
  confidence: number;
}

export interface AIPain {
  description: string;
  severity: Severity;
  targetMarket: TargetMarket;
  evidenceIndices: number[];
}

export interface AIClassificationResult {
  sentiment: Sentiment;
  persona: Persona;
  buyingSignals: BuyingSignal[];
  evidence: AIEvidence[];
  pains: AIPain[];
}
