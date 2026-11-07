import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'icon' | 'quiet'
type Size = 'sm' | 'md'

type Props = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-olive font-semibold text-[#1c2319] hover:bg-[#bdc99e] disabled:cursor-not-allowed disabled:opacity-55',
  secondary: 'border border-[#4d5945] bg-[#252c23] text-[#dce1d2] hover:border-[#67775b] hover:bg-[#30382c] active:bg-[#1f251d] disabled:cursor-not-allowed disabled:opacity-55',
  icon: 'border border-transparent text-[#a5ad9a] hover:border-wt-line hover:bg-wt-panel hover:text-[#e7e8df]',
  quiet: 'text-[#aeb89b] hover:bg-wt-panel2 hover:text-[#e7e8df]',
}

const sizeStyles: Record<Size, Record<Variant, string>> = {
  sm: {
    primary: 'min-h-8 px-2.5 py-1 text-xs',
    secondary: 'min-h-8 px-2.5 py-1 text-xs',
    icon: 'size-7',
    quiet: 'min-h-8 px-2.5 py-1 text-xs',
  },
  md: {
    primary: 'min-h-11 px-4 py-2 text-sm',
    secondary: 'min-h-10 px-3 py-2 text-sm',
    icon: 'size-9',
    quiet: 'min-h-10 px-3 py-2 text-sm',
  },
}

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', children, ...props }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87976a] ${variantStyles[variant]} ${sizeStyles[size][variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

