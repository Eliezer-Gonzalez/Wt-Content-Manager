const MINIMUM_LOADING_DURATION_MS = 1000

export async function waitForMinimumLoadingDuration(startedAt: number) {
  const remaining = MINIMUM_LOADING_DURATION_MS - (Date.now() - startedAt)
  if (remaining > 0) {
    await new Promise<void>(resolve => window.setTimeout(resolve, remaining))
  }
}
