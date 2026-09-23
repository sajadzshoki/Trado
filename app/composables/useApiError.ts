export function useApiError() {
  const { t, te } = useI18n()

  function payload(error: unknown) {
    if (!error || typeof error !== 'object' || !('data' in error)) return null
    const data = error.data
    if (!data || typeof data !== 'object') return null
    if ('data' in data && data.data && typeof data.data === 'object') return data.data as Record<string, unknown>
    return data as Record<string, unknown>
  }

  function codeOf(error: unknown) {
    const body = payload(error)
    if (body && typeof body.code === 'string') return body.code
    if (error && typeof error === 'object' && 'statusMessage' in error && typeof error.statusMessage === 'string' && !error.statusMessage.includes(' ')) {
      return error.statusMessage
    }
    if (error && typeof error === 'object' && 'data' in error && error.data && typeof error.data === 'object' && 'statusMessage' in error.data && typeof error.data.statusMessage === 'string') {
      return error.data.statusMessage
    }
    return null
  }

  function fieldCode(error: unknown) {
    const body = payload(error)
    const fields = body?.fields
    if (!fields || typeof fields !== 'object') return null
    const code = Object.values(fields).find(value => typeof value === 'string')
    return typeof code === 'string' ? code : null
  }

  function message(error: unknown) {
    const field = fieldCode(error)
    if (field && te(`validation.${field}`)) return t(`validation.${field}`)
    const code = codeOf(error)
    if (code && te(`errors.${code}`)) return t(`errors.${code}`)
    return t('errors.generic')
  }

  return { message, codeOf }
}
