import { Link } from 'react-router-dom'
import { sar } from '../../lib/money'
import { useT } from '../../lib/i18n'
import type { FeeStatement } from '../../types'

export const EMP_COLORS = ['#7B2FF2', '#0E8F9C', '#C98A00', '#D2468C', '#3B6FE0', '#0F7A55']

type Part = { name: string; spent: number }

/** Spending this month: donut and per-employee amounts, each colored by who spent it. */
export function MonthCard({ spent, budget, fees, parts = [] }: { spent: number; budget: number; fees: FeeStatement | null; parts?: Part[] }) {
  const t = useT()
  const remaining = Math.max(0, budget - spent)
  const used = parts.filter((p) => p.spent > 0)
  const total = used.reduce((a, p) => a + p.spent, 0) || spent
  const R = 52
  const C = 2 * Math.PI * R
  let off = 0
  return (
    <section className="card-lg p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{t('home.thisMonth')}</h2>
        <span className="stamp bg-[#FBDDB0] text-[#6B3A00]">Simulated</span>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" role="img" aria-label={`${sar(spent)} spent of ${sar(budget)}`}>
            <circle cx="66" cy="66" r={R} fill="none" stroke="#F4F2F9" strokeWidth="16" />
            {total > 0 &&
              used.map((p, i) => {
                const len = (p.spent / Math.max(budget, total)) * C
                const el = <circle key={p.name} cx="66" cy="66" r={R} fill="none" stroke={EMP_COLORS[i % EMP_COLORS.length]} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />
                off += len
                return el
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-xl font-bold tracking-tightest tnum">{sar(spent, { compact: true })}</div>
            <div className="text-[11px] text-neutral-500">spent</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl font-bold tracking-tightest tnum">{sar(remaining, { compact: true })}</div>
          <div className="text-xs text-neutral-500">{t('home.leftOf', { amount: sar(budget, { compact: true }) })}</div>
          <ul className="mt-3 space-y-1.5">
            {used.slice(0, 4).map((p, i) => (
              <li key={p.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: EMP_COLORS[i % EMP_COLORS.length] }} />
                <span className="truncate flex-1">{p.name}</span>
                <span className="font-semibold tnum">{sar(p.spent, { compact: true })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs">
        <span className="text-neutral-500">{t('home.feeThisMonth')}</span>
        <Link to="/activity" className="font-semibold tnum text-ink hover:text-brand">
          {sar(fees?.fees ?? 0)}
          {fees && fees.fee_rate_bps > 0 && <span className="text-neutral-400 font-normal"> ({(fees.fee_rate_bps / 100).toFixed(2)}%)</span>}
        </Link>
      </div>
    </section>
  )
}
