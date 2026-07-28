import type { AIClassificationResult } from "./types.ts";
import type { Sentiment, Severity, BuyingSignal, Persona, TargetMarket } from "../types/domain.ts";

export type ClassifierService = (title: string, body: string) => Promise<AIClassificationResult>;

export function createSimulatedClassifier(): ClassifierService {
  return async (title: string, body: string): Promise<AIClassificationResult> => {
    const combined = `${title}\n${body}`.toLowerCase();

    const sentiment: Sentiment = detectSentiment(combined);
    const persona: Persona = detectPersona(combined);
    const buyingSignals: BuyingSignal[] = detectBuyingSignals(combined);
    const evidence = extractEvidence(title, body);
    const pains = extractPains(combined, evidence.length);

    return { sentiment, persona, buyingSignals, evidence, pains };
  };
}

function detectSentiment(text: string): Sentiment {
  const negativeWords = [
    "frustrating", "broken", "nightmare", "awful", "terrible", "painful",
    "hate", "impossible", "unusable", "buggy", "crash", "fail", "useless",
    "waste", "horrible", "sucks", "dread", "slow", "annoying", "difficult",
  ];
  const positiveWords = [
    "amazing", "great", "love", "excellent", "fantastic", "wonderful",
    "brilliant", "perfect", "best", "awesome", "beautiful", "fast",
  ];

  const negCount = negativeWords.filter((w) => text.includes(w)).length;
  const posCount = positiveWords.filter((w) => text.includes(w)).length;

  if (negCount >= 3 && posCount === 0) return "very_negative";
  if (negCount >= 1 && posCount === 0) return "negative";
  if (posCount >= 3 && negCount === 0) return "very_positive";
  if (posCount >= 1 && negCount === 0) return "positive";
  return "neutral";
}

function detectPersona(text: string): Persona {
  if (/developer|engineer|coder|programmer|dev\b|full.?stack|frontend|backend/.test(text)) {
    return { role: "developer", description: "Software developer or engineer" };
  }
  if (/devops|sre|infra|platform engineer|sysadmin|system administrator/.test(text)) {
    return { role: "devops engineer", description: "DevOps or infrastructure engineer" };
  }
  if (/founder|startup|saas|indie hacker|solopreneur|cto|ceo/.test(text)) {
    return { role: "founder", description: "Startup founder or entrepreneur" };
  }
  if (/designer|ux|ui|product designer/.test(text)) {
    return { role: "designer", description: "Product or UX designer" };
  }
  if (/manager|pm|product manager|team lead|engineering manager/.test(text)) {
    return { role: "engineering manager", description: "Engineering or product manager" };
  }
  return { role: "unknown", description: "" };
}

function detectBuyingSignals(text: string): BuyingSignal[] {
  const signals: BuyingSignal[] = [];

  if (/looking for (a|an|alternative|way|tool|solution|something)/.test(text)) {
    signals.push({ indicator: "looking_for_solution", description: "Actively searching for a solution or alternative" });
  }
  if (/pay|subscribe|worth it|pricing|afford|budget|willing to pay/.test(text)) {
    signals.push({ indicator: "willing_to_pay", description: "Expressed willingness to pay for a solution" });
  }
  if (/switch|migrate|replace|move away|ditch/.test(text)) {
    signals.push({ indicator: "replacement_intent", description: "Intending to switch or replace current tool" });
  }
  if (/manual|workaround|hack|spreadsheet|excel|built (my|our) own/.test(text)) {
    signals.push({ indicator: "manual_workaround", description: "Using manual processes or custom workarounds" });
  }
  if (/tried|evaluat|compare|versus|vs\./.test(text)) {
    signals.push({ indicator: "evaluating_options", description: "Evaluating or comparing solutions" });
  }

  return signals;
}

function extractEvidence(_title: string, body: string): { excerpt: string; charOffset: number; charLength: number; confidence: number }[] {
  const results: { excerpt: string; charOffset: number; charLength: number; confidence: number }[] = [];

  const painPhrases = [
    /\b(frustrat\w+|broken|nightmare|awful|terrible|pain\w*|hate|impossible|unusable|buggy|crash\w*|fail\w*|useless|waste|horrible|sucks|dread|slow|annoying|difficult)\b/gi,
    /(can'?t|cannot|won'?t|doesn'?t)\s+(?!help|wait|believe)[\w\s']+/gi,
    /(wish|need|want)\s+[\w\s']+/gi,
  ];

  for (const pattern of painPhrases) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      results.push({
        excerpt: match[0],
        charOffset: match.index,
        charLength: match[0].length,
        confidence: 0.85,
      });
    }
  }

  return results.slice(0, 5);
}

function extractPains(text: string, evidenceCount: number): { description: string; severity: Severity; targetMarket: TargetMarket; evidenceIndices: number[] }[] {
  const pains: { description: string; severity: Severity; targetMarket: TargetMarket; evidenceIndices: number[] }[] = [];

  if (/deploy|ci.?cd|pipeline|release|ship/i.test(text)) {
    pains.push({
      description: "Deployment workflows are unreliable and time-consuming",
      severity: "high",
      targetMarket: { segment: "development teams", description: "Teams deploying web applications and services" },
      evidenceIndices: evidenceCount > 0 ? [0] : [],
    });
  }

  if (/test|debug|bug|error|fail|crash|broken/i.test(text)) {
    pains.push({
      description: "Debugging and testing processes are inefficient and frustrating",
      severity: "medium",
      targetMarket: { segment: "software developers", description: "Developers building and maintaining software" },
      evidenceIndices: evidenceCount > 0 ? [Math.min(0, evidenceCount - 1)] : [],
    });
  }

  if (/api|integrat|connect|third.?party|sdk/i.test(text)) {
    pains.push({
      description: "API and third-party integrations are complex and poorly documented",
      severity: "medium",
      targetMarket: { segment: "integration engineers", description: "Engineers integrating multiple services" },
      evidenceIndices: evidenceCount > 0 ? [Math.min(0, evidenceCount - 1)] : [],
    });
  }

  if (/perf|slow|optimiz|latency|load|scale/i.test(text)) {
    pains.push({
      description: "Application performance degradation under load causes user frustration",
      severity: "high",
      targetMarket: { segment: "SaaS companies", description: "Companies running web applications at scale" },
      evidenceIndices: evidenceCount > 0 ? [Math.min(0, evidenceCount - 1)] : [],
    });
  }

  if (/auth|login|permission|access|security|role|rbac/i.test(text)) {
    pains.push({
      description: "Authentication and authorization systems are complex to implement and maintain",
      severity: "medium",
      targetMarket: { segment: "security-conscious teams", description: "Teams requiring robust access control" },
      evidenceIndices: evidenceCount > 0 ? [Math.min(0, evidenceCount - 1)] : [],
    });
  }

  if (/document|onboard|learn|tutorial|guide/i.test(text)) {
    pains.push({
      description: "Poor documentation and onboarding makes tools hard to adopt",
      severity: "low",
      targetMarket: { segment: "new developers", description: "Developers learning new tools and platforms" },
      evidenceIndices: evidenceCount > 0 ? [Math.min(0, evidenceCount - 1)] : [],
    });
  }

  if (pains.length === 0) {
    pains.push({
      description: "General frustration with current tooling or workflow",
      severity: "low",
      targetMarket: { segment: "general users", description: "General users of software tools" },
      evidenceIndices: evidenceCount > 0 ? [0] : [],
    });
  }

  return pains;
}
