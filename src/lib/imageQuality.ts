export type ImageQualityMode = 'optimized' | 'high'

export function imageSourceForQuality(
  preview: string,
  fullResolution: string | undefined,
  quality: ImageQualityMode,
): string {
  return quality === 'high' ? fullResolution || preview : preview
}
