let context: AudioContext | null = null

export function prepareCompletionChime() {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume().catch(() => undefined)
  } catch {
    // Audio is optional; completion notices still appear when unavailable.
  }
}

export function playCompletionChime(volume = 100) {
  try {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100
    if (!normalizedVolume) return
    context ??= new AudioContext()
    const audio = context
    const play = () => {
      const master = audio.createGain()
      master.gain.setValueAtTime(0.55 * normalizedVolume, audio.currentTime)
      master.connect(audio.destination)

      ;[880, 1174].forEach((frequency, index) => {
        const start = audio.currentTime + index * 0.12
        const oscillator = audio.createOscillator()
        const envelope = audio.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, start)
        envelope.gain.setValueAtTime(0.0001, start)
        envelope.gain.linearRampToValueAtTime(0.45, start + 0.025)
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
        oscillator.connect(envelope)
        envelope.connect(master)
        oscillator.start(start)
        oscillator.stop(start + 0.31)
      })
    }

    if (audio.state === 'suspended') void audio.resume().then(play).catch(() => undefined)
    else play()
  } catch {
    // Audio is optional; completion notices still appear when unavailable.
  }
}
