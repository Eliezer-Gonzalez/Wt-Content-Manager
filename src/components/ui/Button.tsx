import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'icon' | 'quiet'
type Size = 'sm' | 'md'

type Props = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-olive font-semibold text-[#1c2319] hover:bg-[#bdc99e] disabled:cursor-not-allowed disabled:opacity-55',
  secondary: 'border border-[#4d5945] bg-[#252c23] text-[#dce1d2] hover:border-[#67775b] hover:bg-[#30382c] active:bg-[#1f251d] disabled:cursor-not-allowed disabled:opacity-55',
  danger: 'border border-[#644b42] bg-[#2a201d] text-[#e0c1b5] hover:border-[#80605a] hover:bg-[#3a2c27] active:bg-[#241a17] disabled:cursor-not-allowed disabled:opacity-55',
  icon: 'border border-transparent text-[#a5ad9a] hover:border-wt-line hover:bg-wt-panel hover:text-[#e7e8df]',
  quiet: 'text-[#aeb89b] hover:bg-wt-panel2 hover:text-[#e7e8df]',
}

const sizeStyles: Record<Size, Record<Variant, string>> = {
  sm: {
    primary: 'min-h-8 px-2.5 py-1 text-xs',
    secondary: 'min-h-8 px-2.5 py-1 text-xs',
    danger: 'min-h-8 px-2.5 py-1 text-xs',
    icon: 'size-7',
    quiet: 'min-h-8 px-2.5 py-1 text-xs',
  },
  md: {
    primary: 'min-h-11 px-4 py-2 text-sm',
    secondary: 'min-h-10 px-3 py-2 text-sm',
    danger: 'min-h-10 px-3 py-2 text-sm',
    icon: 'size-9',
    quiet: 'min-h-10 px-3 py-2 text-sm',
  },
}

// Tailwind resolves conflicts by CSS order, not class order, so a caller's className can lose
// against variant/size classes. This maps a class to a "conflict group" (modifiers + property)
// so base classes the caller overrides are dropped. Classes outside these groups never conflict.
function conflictKey(token: string): string | null {
  const index = token.lastIndexOf(':')
  const modifiers = token.slice(0, index + 1)
  const utility = token.slice(index + 1).replace(/^!/, '')
  const spacing = /^(min-h|px|py|size|gap)-/.exec(utility)
  if (spacing) return `${modifiers}${spacing[1]}`
  if (utility.startsWith('bg-')) return `${modifiers}bg`
  if (/^border(-\d+)?$/.test(utility)) return `${modifiers}border-width`
  if (/^border-(\[#|wt-|olive|transparent|white|black|[a-z]+-\d{2,3})/.test(utility)) return `${modifiers}border-color`
  if (/^text-(xs|sm|base|lg|xl|\[\d+px\])$/.test(utility)) return `${modifiers}text-size`
  if (/^text-(\[#|wt-|olive|white|black|transparent|[a-z]+-\d{2,3})/.test(utility)) return `${modifiers}text-color`
  return null
}

function resolveClasses(base: string, extra: string): string {
  const overridden = new Set(extra.split(/\s+/).map(conflictKey).filter((key): key is string => key !== null))
  const kept = base.split(/\s+/).filter(token => token && !overridden.has(conflictKey(token) ?? ''))
  return [...kept, extra].join(' ').trim()
}

const baseStyles = 'inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#87976a]'

/** `className` is for layout additions; any variant/size class it conflicts with is dropped in its favor. */
export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', children, ...props }: Props) {
  return (
    <button
      type={type}
      className={resolveClasses(`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size][variant]}`, className)}
      {...props}
    >
      {children}
    </button>
  )
}

