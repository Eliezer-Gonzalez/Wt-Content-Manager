export function PostDetailSkeleton({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="my-6 animate-pulse space-y-4">
    <span className="sr-only">{label}</span>
    <div className="h-4 w-2/3 rounded-sm bg-[#343d32]"/>
    <div className="h-64 w-full bg-[#2a3129]"/>
    <div className="h-64 w-full bg-[#2a3129]"/>
    <div className="h-4 w-full rounded-sm bg-[#30382e]"/>
    <div className="h-4 w-4/5 rounded-sm bg-[#30382e]"/>
  </div>
}
