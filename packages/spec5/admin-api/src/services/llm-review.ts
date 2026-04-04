import { z } from 'zod';
import { adminApiConfig } from '../config';
import { LlmReviewResult } from '../types';
import { LlmPromptContext } from '../repositories/admin';

const llmReviewSchema = z.object({
  summary: z.string().min(1),
  top_signals: z
    .array(
      z.object({
        signal: z.string().min(1),
        explanation: z.string().min(1),
        severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      }),
    )
    .min(1)
    .max(3),
  recommendation: z.enum(['APPROVE', 'REJECT', 'REQUEST_MORE_INFO']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  reasoning: z.string().min(1),
});

export interface GeneratedLlmReview {
  available: boolean;
  provider: string;
  model: string;
  prompt: string;
  result?: LlmReviewResult;
  fallback_message?: string;
  raw_text?: string;
}

const systemPrompt = `You are an insurance fraud analyst reviewing a parametric income insurance claim for a Q-commerce delivery worker. You have access to device sensor data, behavioral signals, and fraud model output. Be precise and concise. Output ONLY valid JSON matching the schema below.

OUTPUT SCHEMA:
{
  "summary": "string (1-2 sentences, plain English)",
  "top_signals": [
    { "signal": "string", "explanation": "string", "severity": "HIGH|MEDIUM|LOW" }
  ],
  "recommendation": "APPROVE | REJECT | REQUEST_MORE_INFO",
  "confidence": "HIGH | MEDIUM | LOW",
  "reasoning": "string (2-3 sentences)"
}`;

const formatMap = (value: Record<string, unknown>): string => {
  const entries = Object.entries(value);
  if (!entries.length) return '- not available';
  return entries
    .map(([key, raw]) => {
      const numeric = Number(raw);
      if (Number.isFinite(numeric)) {
        return `- ${key}: ${numeric.toFixed(4)}`;
      }
      return `- ${key}: ${String(raw)}`;
    })
    .join('\n');
};

export const buildLlmPrompt = (context: LlmPromptContext): string => {
  const featureVector = context.feature_vector;

  return `CLAIM ID: ${context.claim_id}
WORKER: SafeRider Tier ${context.tier}, ${context.weeks_active} weeks active, ${context.prior_fraud_claims} prior fraud rejections
ZONE: ${context.h3_zone} (${context.city}), Loss Ratio: ${context.zone_loss_ratio}%
TRIGGER: ${context.trigger_type} at ${context.timestamp}
FRAUD SCORE: ${context.fraud_score} (RBA: ${context.rba_outcome})

SHAP BREAKDOWN:
${formatMap(context.shap_values)}

LAYER OUTCOMES:
${formatMap(context.layer_outcomes)}

SENSOR DATA:
- Accelerometer variance: ${featureVector.accelerometer_variance ?? 'n/a'}
- GNSS anomaly: ${featureVector.gnss_cn0_agc_anomaly ?? 'n/a'}
- Route linearity: ${featureVector.route_vector_linearity ?? 'n/a'}
- NTP delta: ${featureVector.gnss_ntp_time_delta ?? 'n/a'}s
- BSSIDs shared with other claimants: ${featureVector.device_proximity_graph_degree ?? 'n/a'}
- Mock location flag: ${featureVector.mock_location_flag ?? 'n/a'}`;
};

const extractJsonObject = (raw: string): Record<string, unknown> | null => {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const runGroq = async (prompt: string): Promise<{ parsed: LlmReviewResult | null; raw: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), adminApiConfig.llmTimeoutMs);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminApiConfig.llmApiKey}`,
      },
      body: JSON.stringify({
        model: adminApiConfig.llmModel,
        max_tokens: 700,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM upstream failed ${response.status}: ${errText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string | null };
      }>;
    };

    const rawText = payload.choices?.[0]?.message?.content ?? '';
    const parsedJson = extractJsonObject(rawText);
    if (!parsedJson) {
      return { parsed: null, raw: rawText };
    }

    const parsed = llmReviewSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { parsed: null, raw: rawText };
    }

    return { parsed: parsed.data, raw: rawText };
  } finally {
    clearTimeout(timer);
  }
};

export const generateLlmReview = async (context: LlmPromptContext): Promise<GeneratedLlmReview> => {
  const prompt = buildLlmPrompt(context);

  if (!adminApiConfig.llmApiKey) {
    return {
      available: false,
      provider: adminApiConfig.llmProvider,
      model: adminApiConfig.llmModel,
      prompt,
      fallback_message: 'AI summary unavailable — please review manually.',
    };
  }

  try {
    const run = await runGroq(prompt);
    if (!run.parsed) {
      return {
        available: false,
        provider: adminApiConfig.llmProvider,
        model: adminApiConfig.llmModel,
        prompt,
        fallback_message: 'AI summary unavailable — please review manually.',
        raw_text: run.raw,
      };
    }

    return {
      available: true,
      provider: adminApiConfig.llmProvider,
      model: adminApiConfig.llmModel,
      prompt,
      result: run.parsed,
      raw_text: run.raw,
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return {
      available: false,
      provider: adminApiConfig.llmProvider,
      model: adminApiConfig.llmModel,
      prompt,
      fallback_message: isAbort
        ? 'AI summary unavailable — please review manually.'
        : 'AI summary unavailable — please review manually.',
      raw_text: error instanceof Error ? error.message : 'unknown error',
    };
  }
};
