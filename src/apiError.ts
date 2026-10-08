/** Turn JSON and Supabase API errors into short, actionable text (not [object Object]). */
export function readableApiError(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (trimmed === '[object Object]') return ''
    return trimmed.length > 450 ? `${trimmed.slice(0, 450)}…` : trimmed
  }
  if (value instanceof Error) return readableApiError(value.message, depth + 1)
  if (!value || typeof value !== 'object' || depth > 3) return ''
  const fields = value as Record<string, unknown>
  for (const key of ['message', 'error_description', 'error', 'details', 'hint']) {
    const found = readableApiError(fields[key], depth + 1)
    if (found) return found
  }
  return ''
}
