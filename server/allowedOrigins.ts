const DEFAULT_ALLOWED_ORIGIN = 'http://localhost:3000'

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizeOrigin(value: string): string | null {
  const trimmed = trimTrailingSlashes(value.trim())
  if (!trimmed) {
    return null
  }

  if (trimmed === '*') {
    return '*'
  }

  try {
    return trimTrailingSlashes(new URL(trimmed).origin).toLowerCase()
  } catch {
    return null
  }
}

function wildcardOriginToRegExp(pattern: string): RegExp {
  const escapedPattern = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
  const regexSource = escapedPattern.replace(/\*/g, '.+')
  return new RegExp(`^${regexSource}$`, 'i')
}

function matchesAllowedOrigin(normalizedOrigin: string, allowedOrigin: string): boolean {
  const wildcardPattern = trimTrailingSlashes(allowedOrigin.trim()).toLowerCase()
  if (wildcardPattern === '*') {
    return true
  }

  if (wildcardPattern.includes('*')) {
    if (!wildcardPattern.includes('://')) {
      return false
    }
    return wildcardOriginToRegExp(wildcardPattern).test(normalizedOrigin)
  }

  const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin)
  return normalizedAllowedOrigin === normalizedOrigin
}

export function parseAllowedOrigins(
  value: string | undefined,
  fallback: string = DEFAULT_ALLOWED_ORIGIN
): string[] {
  const source = value && value.trim() ? value : fallback
  return source
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (allowedOrigins.some((entry) => entry.trim() === '*')) {
    return true
  }

  const normalizedOrigin = normalizeOrigin(origin || '')
  if (!normalizedOrigin) {
    return false
  }

  return allowedOrigins.some((allowedOrigin) => matchesAllowedOrigin(normalizedOrigin, allowedOrigin))
}

export function formatAllowedOrigins(allowedOrigins: string[]): string {
  const normalized = allowedOrigins
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (normalized.length === 0) {
    return DEFAULT_ALLOWED_ORIGIN
  }

  return normalized.join(', ')
}
