export type DebugLogger = (event: string, payload?: unknown) => void

function toTimestamp() {
  return new Date().toISOString()
}

export function createDebugLogger(
  namespace: string,
  enabled = false,
): DebugLogger {
  if (!enabled) {
    return () => {
      // no-op
    }
  }

  return (event, payload) => {
    if (payload === undefined) {
      console.log(`[${toTimestamp()}] [${namespace}] ${event}`)
      return
    }

    console.log(`[${toTimestamp()}] [${namespace}] ${event}`, payload)
  }
}
