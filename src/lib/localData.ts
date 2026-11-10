const localDataKeys = [
  'wt-content-manager-library-v1',
  'wt-content-manager-game-path',
  'wt-content-manager-searches',
  'wt-content-manager-home-sections-v1',
  'wt-content-manager-game-setup-seen',
  'wt-content-manager-independent-notice-v4',
  'wt-content-manager-language',
  'wt-content-manager-image-quality-v1',
] as const

export function resetLocalData(): void {
  for (const key of localDataKeys) localStorage.removeItem(key)
}
