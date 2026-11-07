type Props = { label: string }

export function PostCardSkeleton({ label }: Props) {
  return <div role="status" aria-label={label} className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[720px]:gap-2.5 max-[420px]:grid-cols-1">
    <span className="sr-only">{label}</span>
    {Array.from({ length: 6 }, (_, index) => <article key={index} aria-hidden="true" className="animate-pulse border border-[#30372f] bg-wt-panel">
      <div className="h-[154px] bg-[#2a3129] max-[720px]:h-[132px] max-[420px]:h-[170px]"/>
      <div className="space-y-3 p-3"><div className="h-5 w-4/5 rounded-sm bg-[#343d32]"/><div className="h-3 w-2/5 rounded-sm bg-[#30382e]"/><div className="mt-4 h-px w-full bg-[#333a32]"/><div className="h-3 w-1/2 rounded-sm bg-[#30382e]"/></div>
    </article>)}
  </div>
}
