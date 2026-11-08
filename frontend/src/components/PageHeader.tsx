import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 md:justify-end md:mb-4">
      <div className="md:hidden">
        <h1 className="text-[24px] md:text-[28px] leading-tight font-semibold tracking-tightest">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-600 mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:pt-2 md:pt-0">{actions}</div>}
    </div>
  )
}
