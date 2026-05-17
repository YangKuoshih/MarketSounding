/**
 * Reaction parser and validator for dealer agent LLM output.
 * Clamps scores, validates structure, and verifies position shift arithmetic.
 */

export interface Reaction {
  ratePathView: string;
  balanceSheetView: string;
  riskAssetView: string;
  keyConcerns: string[];
  hawkishDovishScore: number;
  confidence: number;
  reasoningMd: string;
  positionShift?: number;
  influencedBy?: string[];
  keyQuote?: string;
}

export interface ParseResult {
  success: true;
  reaction: Reaction;
}

export interface ParseError {
  success: false;
  error: string;
  rawText: string;
}

export type ParseOutcome = ParseResult | ParseError;

/**
 * Parse and validate a raw LLM response into a structured Reaction.
 * Clamps numeric values, validates required fields, and verifies position shift arithmetic.
 *
 * @param raw - Raw text response from Bedrock
 * @param priorHdScore - Prior round H/D score for position shift verification (null for round 1)
 * @returns ParseOutcome indicating success with validated reaction or failure with error details
 */
export function parseReactionResponse(raw: string, priorHdScore: number | null): ParseOutcome {
  const parsed = extractJson(raw);
  if (!parsed) {
    return { success: false, error: 'Failed to parse JSON from response', rawText: raw };
  }

  // Validate required string fields
  const ratePathView = validateNonEmptyString(parsed.ratePathView, 'ratePathView');
  if (!ratePathView) {
    return { success: false, error: 'Missing or empty required field: ratePathView', rawText: raw };
  }

  const balanceSheetView = validateNonEmptyString(parsed.balanceSheetView, 'balanceSheetView');
  if (!balanceSheetView) {
    return {
      success: false,
      error: 'Missing or empty required field: balanceSheetView',
      rawText: raw,
    };
  }

  const riskAssetView = validateNonEmptyString(parsed.riskAssetView, 'riskAssetView');
  if (!riskAssetView) {
    return { success: false, error: 'Missing or empty required field: riskAssetView', rawText: raw };
  }

  const reasoningMd = validateNonEmptyString(parsed.reasoningMd, 'reasoningMd');
  if (!reasoningMd) {
    return { success: false, error: 'Missing or empty required field: reasoningMd', rawText: raw };
  }

  // Validate keyConcerns (1-3 items)
  const keyConcerns = validateKeyConcerns(parsed.keyConcerns);
  if (!keyConcerns) {
    return {
      success: false,
      error: 'keyConcerns must be an array of 1-3 non-empty strings',
      rawText: raw,
    };
  }

  // Clamp numeric scores
  const hawkishDovishScore = clamp(toNumber(parsed.hawkishDovishScore, 0), -1, 1);
  const confidence = clamp(toNumber(parsed.confidence, 0.5), 0, 1);

  // Validate and compute position shift
  let positionShift: number | undefined;
  if (priorHdScore !== null) {
    const reportedShift = parsed.positionShift;
    const computedShift = hawkishDovishScore - priorHdScore;

    if (typeof reportedShift === 'number') {
      // Verify reported shift matches computed shift within tolerance
      if (Math.abs(reportedShift - computedShift) <= 0.001) {
        positionShift = reportedShift;
      } else {
        // Use computed value — the arithmetic is authoritative
        positionShift = computedShift;
      }
    } else {
      positionShift = computedShift;
    }
  }

  // Optional fields
  const influencedBy = validateInfluencedBy(parsed.influencedBy);
  const keyQuote = typeof parsed.keyQuote === 'string' && parsed.keyQuote.trim().length > 0
    ? parsed.keyQuote.trim()
    : undefined;

  const reaction: Reaction = {
    ratePathView,
    balanceSheetView,
    riskAssetView,
    keyConcerns,
    hawkishDovishScore,
    confidence,
    reasoningMd,
    positionShift,
    influencedBy,
    keyQuote,
  };

  return { success: true, reaction };
}

/**
 * Build a retry prompt when the initial response was malformed.
 */
export function buildRetryPrompt(error: string, originalPrompt: string): string {
  return `${originalPrompt}

IMPORTANT: Your previous response was malformed. Error: "${error}"

You MUST respond with ONLY a valid JSON object with these exact fields:
{
  "ratePathView": "string - your view on the rate path",
  "balanceSheetView": "string - your view on balance sheet policy",
  "riskAssetView": "string - your view on risk assets",
  "keyConcerns": ["string array with 1-3 key concerns"],
  "hawkishDovishScore": number between -1 (very dovish) and +1 (very hawkish),
  "confidence": number between 0 (no confidence) and 1 (very confident),
  "reasoningMd": "string - 2-3 paragraphs of reasoning in markdown",
  "positionShift": number or null (change from prior round H/D score),
  "influencedBy": ["array of persona IDs that influenced your view"] or null,
  "keyQuote": "one sentence explaining your shift or stance"
}

Respond with ONLY the JSON object. No markdown formatting, no explanation outside the JSON.`;
}

// --- Internal helpers ---

function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through
  }

  // Try extracting from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through
    }
  }

  // Try finding a JSON object in the text
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

function validateNonEmptyString(value: unknown, _fieldName: string): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function validateKeyConcerns(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const filtered = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());

  if (filtered.length < 1 || filtered.length > 3) {
    // If more than 3, take first 3
    if (filtered.length > 3) {
      return filtered.slice(0, 3);
    }
    return null;
  }
  return filtered;
}

function validateInfluencedBy(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );
  return filtered.length > 0 ? filtered : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
}
