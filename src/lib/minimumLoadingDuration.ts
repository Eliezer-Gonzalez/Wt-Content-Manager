const MINIMUM_LOADING_DURATION_MS = 1000

export async function waitForMinimumLoadingDuration(startedAt: number, minimumDurationMs = MINIMUM_LOADING_DURATION_MS) {
  const remaining = minimumDurationMs - (Date.now() - startedAt)
  if (remaining > 0) {
    await new Promise<void>(resolve => window.setTimeout(resolve, remaining))
  }
}
