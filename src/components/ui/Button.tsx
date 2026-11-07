import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'icon' | 'quiet'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'min-h-11 bg-olive px-4 py-2 text-sm font-semibold text-[#1c2319] hover:bg-[#bdc99e] disabled:cursor-not-allowed disabled:opacity-55',
  secondary: 'min-h-10 border border-wt-line bg-wt-panel px-3 py-2 text-sm text-[#c1c6b8] hover:border-[#717d5b] hover:bg-[#252b24] disabled:cursor-not-allowed disabled:opacity-55',
  icon: 'inline-flex size-9 items-center justify-center border border-transparent text-[#a5ad9a] hover:border-wt-line hover:bg-wt-panel hover:text-[#e7e8df]',
  quiet: 'min-h-10 px-3 py-2 text-sm text-[#aeb89b] hover:bg-wt-panel2 hover:text-[#e7e8df]',
}

export function Button({ variant = 'secondary', className = '', type = 'button', children, ...props }: Props) {
  return <button type={type} className={`inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive ${variants[variant]} ${className}`} {...props}>{children}</button>
}
