import { GoogleGenerativeAI } from '@google/generative-ai'

const MAX_TOKENS_PER_RUN = 50000
let tokensUsed = 0
let totalCalls = 0
let totalInputTokens = 0
let totalOutputTokens = 0

function getKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
  ].filter((k): k is string => Boolean(k))
  if (keys.length === 0) throw new Error('No GEMINI_API_KEY set')
  return keys
}

export class AllKeysRateLimitedError extends Error {
  constructor() {
    super('ALL_KEYS_RATE_LIMITED')
    this.name = 'AllKeysRateLimitedError'
  }
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests')
  )
}

// In-memory per-run rate limit tracking (reset each GitHub Actions job)
const rateLimitedKeys = new Set<number>()

async function callGemini(prompt: string): Promise<string> {
  if (tokensUsed >= MAX_TOKENS_PER_RUN) {
    throw new Error(`Token budget exhausted: ${tokensUsed}/${MAX_TOKENS_PER_RUN}`)
  }

  const keys = getKeys()

  for (let i = 0; i < keys.length; i++) {
    if (rateLimitedKeys.has(i)) continue

    try {
      const client = new GoogleGenerativeAI(keys[i])
      const model = client.getGenerativeModel({ model: 'gemini-3.6-flash' })
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const inputEst = Math.ceil(prompt.length / 4)
      const outputEst = Math.ceil(text.length / 4)
      tokensUsed += inputEst + outputEst
      totalInputTokens += inputEst
      totalOutputTokens += outputEst
      totalCalls++
      console.log(`  [Key ${i + 1}] Tokens used this run: ~${tokensUsed}/${MAX_TOKENS_PER_RUN}`)
      return text
    } catch (err) {
      if (isRateLimitError(err)) {
        console.log(`  [Key ${i + 1}] Rate limited. Trying next key...`)
        rateLimitedKeys.add(i)
        continue
      }
      // Non-rate-limit error — rethrow immediately
      throw err
    }
  }

  // Every key was rate limited
  throw new AllKeysRateLimitedError()
}

function parseJson(text: string): { files: { path: string; content: string }[] } {
  // Strip markdown code fences if Gemini wraps response in ```json ... ```
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  // Try to extract the outermost JSON object
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Gemini response has no JSON object. Response was:\n${text.slice(0, 500)}`)
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed.files)) {
      throw new Error('Gemini JSON missing "files" array')
    }
    return parsed
  } catch (err) {
    throw new Error(`Gemini returned invalid JSON: ${err instanceof Error ? err.message : err}\nRaw: ${jsonMatch[0].slice(0, 300)}`)
  }
}

const AGENT_RULES = `
You are an autonomous feature builder for the 365 project.

RULES:
1. Implement ONLY the specified feature. Nothing else.
2. Do NOT modify or remove any existing features.
3. Do NOT change project architecture.
4. Do NOT change configuration files unless required by this feature.
5. Create the feature as a self-contained module.
6. Follow existing code patterns and conventions.
7. Write clean, readable TypeScript.
8. Add a Vitest unit test for the feature.
9. Return ONLY a JSON object with file changes. No explanation, no markdown, no extra text.
10. New pages go to: apps/web/app/tools/[feature-slug]/page.tsx
11. New API logic goes to: apps/api/src/features/[feature-slug]/

Response format (strict JSON, no markdown fences):
{
  "files": [
    {
      "path": "relative/path/from/repo/root",
      "content": "full file content as string"
    }
  ]
}
`

export async function generateFeature(
  featureSpec: string,
  existingCode: string,
): Promise<{ files: { path: string; content: string }[] }> {
  const prompt = `${AGENT_RULES}

Feature to implement:
${featureSpec}

Existing relevant code for context:
${existingCode}

Return only the JSON object with file changes.`

  const text = await callGemini(prompt)
  return parseJson(text)
}

export async function fixError(
  errorMessage: string,
  currentCode: string,
): Promise<{ files: { path: string; content: string }[] }> {
  const prompt = `${AGENT_RULES}

The following build/lint/test error occurred. Fix it without changing anything unrelated.

Error:
${errorMessage.slice(0, 3000)}

Current code:
${currentCode}

Return only the JSON object with the fixed file changes.`

  const text = await callGemini(prompt)
  return parseJson(text)
}

export function getTokensUsed(): number {
  return tokensUsed
}

export function getRateLimitedKeyCount(): number {
  return rateLimitedKeys.size
}

export function getTotalKeyCount(): number {
  return getKeys().length
}

export function getGeminiStats() {
  return {
    tokensUsed,
    tokenBudget: MAX_TOKENS_PER_RUN,
    tokenBudgetRemaining: Math.max(0, MAX_TOKENS_PER_RUN - tokensUsed),
    totalCalls,
    totalInputTokens,
    totalOutputTokens,
    rateLimitedKeys: rateLimitedKeys.size,
    totalKeys: getKeys().length,
  }
}
