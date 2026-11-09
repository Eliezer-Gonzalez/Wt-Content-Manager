import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'

type Props = {
  content: string
  children: ReactElement<{ 'aria-describedby'?: string; className?: string; children?: ReactNode }>
  className?: string
  placement?: 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
}

/** A small app-themed tooltip that appears on hover and keyboard focus. */
export function AppTooltip({ content, children, className = '', placement = 'top', align = 'center' }: Props) {
  const tooltipId = useId()
  const describedBy = [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' ')
  const existingClasses = `${children.props.className ?? ''} ${className}`
  const hasPositioning = /(?:^|\s)(?:static|fixed|absolute|relative|sticky)(?:\s|$)/.test(existingClasses)
  const anchorClass = hasPositioning ? '' : 'relative'
  const placementClass = placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
  const alignmentClass = align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'

  return cloneElement(children, {
    'aria-describedby': describedBy,
    className: `${children.props.className ?? ''} group/tooltip ${anchorClass} ${className}`.trim(),
    children: <>
      {children.props.children}
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none invisible absolute z-50 w-max max-w-64 whitespace-normal break-words [overflow-wrap:anywhere] border border-wt-line bg-wt-panel px-2.5 py-1.5 font-sans text-xs leading-4 text-[#d3d9ca] opacity-0 shadow-xl transition-[opacity,visibility] duration-150 group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 ${placementClass} ${alignmentClass}`}
      >
        {content}
      </span>
    </>,
  })
}
