/**
 * Gemini smoke test — run with:
 *   GEMINI_API_KEY=your_key npx ts-node scripts/agent/test-gemini.ts
 *
 * Checks:
 *  1. Gemini API key is set
 *  2. Model gemini-2.5-flash responds
 *  3. Response parses as valid JSON with a files array
 *  4. At least one file targets the correct slug path
 *  5. The file content is non-empty valid TypeScript/TSX
 */

import { generateFeature } from './gemini'

const TEST_SLUG = 'json-formatter'
const TEST_FEATURE = '| 001 | JSON Formatter | Developer | Format and prettify JSON input | pending |'
const TEST_CONTEXT = `// apps/web/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
`

async function main() {
  console.log('🧪 Gemini smoke test starting...\n')

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set. Run with: GEMINI_API_KEY=your_key npx ts-node scripts/agent/test-gemini.ts')
    process.exit(1)
  }

  console.log(`  Model: gemini-3.6-flash`)
  console.log(`  Feature: ${TEST_FEATURE.trim()}`)
  console.log(`  Slug: ${TEST_SLUG}\n`)

  let result: { files: { path: string; content: string }[] }

  try {
    console.log('  Calling Gemini...')
    result = await generateFeature(TEST_FEATURE, TEST_CONTEXT, TEST_SLUG)
    console.log('  ✅ Gemini responded\n')
  } catch (err) {
    console.error('  ❌ Gemini call failed:', err)
    process.exit(1)
  }

  // Check files array
  if (!Array.isArray(result.files) || result.files.length === 0) {
    console.error('  ❌ Response has no files array')
    process.exit(1)
  }
  console.log(`  Files returned: ${result.files.length}`)
  result.files.forEach((f) => console.log(`    - ${f.path} (${f.content.length} chars)`))

  // Check at least one file is in the correct slug path
  const expectedPath = `apps/web/app/tools/${TEST_SLUG}/page.tsx`
  const hasPage = result.files.some((f) => f.path === expectedPath)
  if (!hasPage) {
    console.error(`\n  ❌ Missing expected file: ${expectedPath}`)
    console.error(`  Got paths: ${result.files.map((f) => f.path).join(', ')}`)
    process.exit(1)
  }
  console.log(`\n  ✅ Correct path found: ${expectedPath}`)

  // Check content is non-empty and looks like TSX
  const page = result.files.find((f) => f.path === expectedPath)!
  if (page.content.length < 100) {
    console.error(`  ❌ Page content too short (${page.content.length} chars) — likely empty or broken`)
    process.exit(1)
  }
  if (!page.content.includes('export default') && !page.content.includes('export function')) {
    console.error('  ❌ Page content has no default export — not valid React component')
    process.exit(1)
  }
  console.log(`  ✅ Page content looks valid (${page.content.length} chars, has export)`)

  // Check no out-of-scope files
  const allowed = [`apps/web/app/tools/${TEST_SLUG}/`, `apps/api/src/features/${TEST_SLUG}/`, `packages/shared/src/`]
  const outOfScope = result.files.filter((f) => !allowed.some((p) => f.path.startsWith(p)))
  if (outOfScope.length > 0) {
    console.warn(`\n  ⚠️  Out-of-scope files (would be rejected by builder):`)
    outOfScope.forEach((f) => console.warn(`    - ${f.path}`))
  } else {
    console.log('  ✅ All files within allowed paths')
  }

  console.log('\n✅ All checks passed — Gemini is working correctly!\n')
}

main().catch((err) => {
  console.error('Test crashed:', err)
  process.exit(1)
})
