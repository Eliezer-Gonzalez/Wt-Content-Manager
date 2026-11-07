import { Hammer } from 'lucide-react'

type Props = { t: (key: string) => string }

export function SoundComingSoon({ t }: Props) {
  return <section className="grid flex-1 place-items-center px-6 text-center">
    <div className="flex flex-col items-center gap-5 text-[#bdc99e]">
      <span className="relative block size-16">
        <Hammer size={64} strokeWidth={1.4} className="animate-hammer-strike origin-[8%_90%]" aria-hidden="true" />
        <span className="absolute bottom-0 left-1 h-px w-14 bg-[#59654d]" aria-hidden="true" />
      </span>
      <h1 className="m-0 font-display text-4xl font-semibold tracking-wide">{t('underConstruction')}</h1>
    </div>
  </section>
}
