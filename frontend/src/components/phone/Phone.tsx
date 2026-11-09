import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ThemeToggle } from '../ThemeToggle'
import { sar } from '../../lib/money'
import { useT, LanguageSwitch } from '../../lib/i18n'
import { useAuth } from '../../lib/auth'
import { timeAgo } from '../../lib/useFetch'
import type { PurchaseRequest } from '../../types'

/** Soft colors for the dark spending card, and stronger ones for dots on light rows. Both keyed by employee id. */
const SOFT = ['#FFB38A', '#5ED6D0', '#FF9CC8', '#8EC5FF', '#FFD66B', '#9BE3B0']
const DOT = ['#D2468C', '#0E8F9C', '#C98A00', '#3B6FE0', '#7B2FF2', '#0F7A55']
export const softColor = (id: number) => SOFT[Math.abs(id) % SOFT.length]
export const dotColor = (id: number) => DOT[Math.abs(id) % DOT.length]

export function SandboxBadge() {
  return <span className="rounded-[4px] bg-[#FBBF24] text-[#3B2A00] px-2.5 py-[3px] text-xs font-semibold">Sandbox</span>
}

/** "Good evening, Maryam" with the company above and the Sandbox badge and mark on the end side. */
export function PhoneGreeting() {
  const { user, company } = useAuth()
  const t = useT()
  const h = new Date().getHours()
  const key = h < 12 ? 'phone.goodMorning' : h < 18 ? 'phone.goodAfternoon' : 'phone.goodEvening'
  const first = (user?.full_name ?? '').trim().split(/\s+/)[0] || ''
  return (
    <header className="flex items-start justify-between gap-3 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <div className="min-w-0">
        <div className="text-sm text-neutral-500 truncate">{company?.name}</div>
        <h1 className="font-display text-[30px] leading-[1.1] font-bold tracking-tightest mt-1">{t(key, { name: first })}</h1>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
        <div className="flex items-center gap-2">
          <LanguageSwitch className="h-9 items-center" />
          <ThemeToggle className="h-9 w-9" />
        </div>
        <SandboxBadge />
      </div>
    </header>
  )
}

export function PhoneAllClear({ pending }: { pending: number }) {
  const t = useT()
  return (
    <section className="rounded-[18px] bg-[#F1E8FF] px-4 py-4">
      <div className="flex items-center justify-between text-[13px] text-brand-dark font-semibold">
        <span>{t('phone.waiting')}</span>
        <span className="font-medium text-neutral-600 tnum">{t('phone.nRequests', { n: pending })}</span>
      </div>
      <div className="font-display text-[26px] font-bold tracking-tightest mt-1">{t('phone.allClear')}</div>
      <div className="text-[13px] text-neutral-600 mt-0.5">{t('phone.allClearSub')}</div>
    </section>
  )
}

export function PhoneSpend({ spent, budget, parts }: { spent: number; budget: number; parts: { id: number; name: string; spent: number }[] }) {
  const t = useT()
  const used = parts.filter((p) => p.spent > 0).sort((a, b) => b.spent - a.spent)
  const total = used.reduce((a, p) => a + p.spent, 0)
  const left = Math.max(0, budget - spent)
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
  return (
    <section className="rounded-[22px] p-5 text-white" style={{ background: 'linear-gradient(165deg,#7B2FF2 0%,#5A1FC4 55%,#3A1486 100%)' }}>
      <div className="flex items-center justify-between text-[13px] text-white/80">
        <span>{t('phone.simulated')}</span>
        <span className="tnum">{t('phone.ofAmount', { amount: sar(budget) })}</span>
      </div>
      <div className="font-display text-[38px] leading-tight font-bold tracking-tightest tnum mt-1">{sar(spent)}</div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/20" role="img" aria-label={`${sar(spent)} of ${sar(budget)}`}>
        {total > 0 &&
          used.map((p) => <span key={p.id} style={{ width: `${(p.spent / Math.max(budget, total)) * 100}%`, background: softColor(p.id) }} />)}
      </div>
      <ul className="mt-4 space-y-2">
        {used.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 text-[15px]">
            <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: softColor(p.id) }} />
            <span className="flex-1 truncate">{p.name}</span>
            <span className="font-semibold tnum">{sar(p.spent)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-[13px]">
        <span className="text-white/80 tnum">{t('phone.leftUsed', { left: sar(left), pct })}</span>
        <Link to="/employees" className="font-semibold inline-flex items-center gap-0.5">
          {t('phone.allEmployees')} <ChevronRight className="h-4 w-4 rtl-flip" />
        </Link>
      </div>
    </section>
  )
}

/** The one short line under a request: what a person did, or what Flaire did. */
export function useOutcome() {
  const { user } = useAuth()
  const t = useT()
  return (r: PurchaseRequest): { text: string; cls: string; strike: boolean } => {
    if (r.status === 'denied' || r.status === 'rejected') return { text: t('phone.blocked'), cls: 'text-danger', strike: true }
    if (r.status === 'pending_approval') return { text: t('phone.waitingYou'), cls: 'text-[#9A4A06]', strike: false }
    if (r.status === 'failed') return { text: t('phone.failed'), cls: 'text-danger', strike: false }
    if (r.approved_by) {
      return r.approved_by.id === user?.id
        ? { text: t('phone.youApproved'), cls: 'text-brand-dark', strike: false }
        : { text: t('phone.approvedBy', { name: r.approved_by.full_name }), cls: 'text-brand-dark', strike: false }
    }
    return { text: t('phone.authorized'), cls: 'text-success', strike: false }
  }
}

/** Phone request rows: a dot for who asked, merchant and employee on the left, amount and outcome on the end side. */
export function PhoneRows({ items, plain = false }: { items: PurchaseRequest[]; plain?: boolean }) {
  const outcome = useOutcome()
  return (
    <ul className={plain ? 'space-y-2.5' : 'divide-y divide-line'}>
      {items.map((r) => {
        const o = outcome(r)
        return (
          <li key={r.id} className={plain ? 'flex items-center gap-3 rounded-[14px] bg-white px-4 min-h-[68px] py-3' : 'flex items-center gap-3 min-h-[60px] py-2.5'}>
            {plain && <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: dotColor(r.agent_id) }} />}
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-semibold truncate">{r.merchant}</div>
              <div className="text-[13px] text-neutral-500 truncate">{plain ? r.agent_name : `${r.agent_name} · ${o.text}`}</div>
            </div>
            <div className="text-end">
              <div className={`text-[16px] font-semibold tnum ${o.strike ? 'line-through text-neutral-400' : ''}`}>{sar(r.amount)}</div>
              {plain && <div className={`text-[13px] font-semibold ${o.cls}`}>{o.text}</div>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function PhoneRecent({ items }: { items: PurchaseRequest[] }) {
  const t = useT()
  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-bold">{t('phone.recent')}</h2>
        <Link to="/spending" className="text-[13px] font-semibold text-brand">{t('common.seeAll')}</Link>
      </div>
      {items.length === 0 ? <div className="py-6 text-center text-sm text-neutral-500">{t('home.noRequestsYet')}</div> : <PhoneRows items={items} />}
    </section>
  )
}

export { timeAgo }
