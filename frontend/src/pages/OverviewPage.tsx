import { useMemo } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { sar } from '../lib/money'
import type { DashboardSummary, PurchaseRequest } from '../types'
import { ErrorNote } from '../components/ErrorNote'
import { PageLoader } from '../components/Spinner'
import { useOutcome } from '../components/phone/Phone'

const SEG = ['#FFFFFF', '#CDB3FF', '#9FD4FF', '#FFC9A8', '#A8EBD9', '#FFB8D9']

type Exception = { key: string; title: string; body: string; cta: string; to: string }

/** Desktop Overview: authority left, what needs a person, what is unusual, what just happened. */
export default function OverviewPage() {
  const [search] = useSearchParams()
  const decideId = Number(search.get('decide')) || null
  const outcome = useOutcome()

  const summary = useFetch(() => api.get<DashboardSummary>('/dashboard/summary').then((r) => r.data), [])
  const approvals = useFetch(() => api.get<PurchaseRequest[]>('/approvals').then((r) => r.data), [])
  const reqs = useFetch(() => api.get<PurchaseRequest[]>('/purchase-requests', { params: { limit: 200 } }).then((r) => r.data), [])

  const totals = summary.data?.totals
  const agents = summary.data?.agents ?? []
  const cap = totals?.budget_total ?? 0
  const spent = totals?.spent_this_period ?? 0
  const left = Math.max(0, cap - spent)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const month = new Date().toLocaleString(undefined, { month: 'long' })
  const blocked = useMemo(
    () => (reqs.data ?? []).filter((r) => (r.status === 'denied' || r.status === 'rejected') && new Date(r.created_at).getTime() >= monthStart).reduce((a, r) => a + r.amount, 0),
    [reqs.data, monthStart],
  )
  const waiting = approvals.data ?? []
  const waitingTotal = waiting.reduce((a, r) => a + r.amount, 0)

  const exceptions = useMemo<Exception[]>(() => {
    const out: Exception[] = []
    for (const a of agents) {
      if (a.spent_this_period > 0 && !a.card && !a.monthly_limit)
        out.push({ key: `nolimit-${a.id}`, title: `${a.name} has no card and no limit of its own`, body: `It spent ${sar(a.spent_this_period)}${cap ? `, ${Math.round((a.spent_this_period / cap) * 100)}% of the company cap` : ''}.`, cta: 'Set limit', to: `/employees/${a.id}` })
    }
    const big = (reqs.data ?? []).find((r) => (r.status === 'denied' || r.status === 'rejected') && r.amount >= 5 * Math.max(1, agents.find((a) => a.id === r.agent_id)?.approval_threshold ?? 1))
    if (big) out.push({ key: `big-${big.id}`, title: `${sar(big.amount)} attempt by ${big.agent_name}`, body: `Flaire refused it. That is far above its approval line.`, cta: 'Review', to: '/spending' })
    if (cap > 0 && spent / cap >= 0.9) out.push({ key: 'cap', title: `Company cap ${Math.round((spent / cap) * 100)}% used`, body: `${sar(left)} left under the simulated monthly cap.`, cta: 'Change cap', to: '/controls#budgets' })
    return out.slice(0, 3)
  }, [agents, reqs.data, cap, spent, left])

  if (decideId) return <Navigate to={`/approvals?decide=${decideId}`} replace />
  if (summary.loading && !summary.data) return <PageLoader />
  const recent = (summary.data?.recent_requests ?? []).slice(0, 4)
  const used = agents.filter((a) => a.spent_this_period > 0)
  const denom = Math.max(cap, used.reduce((a, x) => a + x.spent_this_period, 0)) || 1

  return (
    <div className="flex flex-col gap-5">
      {summary.error && !summary.data && <ErrorNote message={summary.error} />}
      <div className="flex flex-wrap gap-5 items-stretch">
        <section className="flex-[2.2_1_600px] rounded-[22px] p-7 text-white" style={{ background: 'linear-gradient(135deg,#8A2FE6 0%,#6A22C9 42%,#2E0F6B 100%)' }}>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[14px] text-[#EEE7FF]">Simulated spending · {month} · of {sar(cap)} cap</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[#EEE7FF] text-[28px] -translate-y-3 inline-block">SAR</span>
                <span className="font-display text-[clamp(44px,4.6vw,64px)] leading-none font-semibold tracking-[-0.04em] tnum">{Math.round(left / 100).toLocaleString()}</span>
                <span className="text-[#EEE7FF] text-[18px]">remaining</span>
              </div>
              <p className="mt-3 text-[14px] text-[#EEE7FF] max-w-[460px]">Remaining under the company's simulated monthly cap. An employee's own limit and approval rules can still block a request.</p>
            </div>
            <div className="flex gap-8 text-[14px]">
              <div><div className="text-[#EEE7FF]">Authorized</div><div className="font-display text-[22px] font-semibold tnum">{sar(spent)}</div></div>
              <div><div className="text-[#FFD0CA]">Blocked</div><div className="font-display text-[22px] font-semibold tnum text-[#FFD0CA]">{sar(blocked)}</div></div>
            </div>
          </div>
          <div className="mt-6 flex h-2.5 gap-[2px] rounded-full overflow-hidden" style={{ background: 'repeating-linear-gradient(45deg,rgba(255,255,255,.16) 0 4px,transparent 4px 8px)' }} role="img" aria-label={`${sar(spent)} of ${sar(cap)}`}>
            {used.map((a, i) => <span key={a.id} style={{ width: `${(a.spent_this_period / denom) * 100}%`, background: SEG[i % SEG.length] }} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-[#EEE7FF]">
            {used.map((a, i) => <span key={a.id} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SEG[i % SEG.length] }} />{a.name} <b className="text-white tnum">{sar(a.spent_this_period)}</b></span>)}
          </div>
        </section>

        <section className="flex-[1_1_300px] rounded-[22px] bg-[#F1E6FD] p-6 flex flex-col">
          <div className="text-[14px] text-[#5B2A9E] font-semibold flex justify-between"><span>Waiting for you</span><span className="tnum font-medium text-neutral-600">{waiting.length} {waiting.length === 1 ? 'request' : 'requests'}</span></div>
          {waiting.length === 0 ? (
            <>
              <div className="font-display text-[26px] font-semibold text-[#2E0F6B] mt-2">All clear</div>
              <div className="text-[14px] text-neutral-600 mt-1">{sar(0)} pending · no holds older than 24h</div>
              <Link to="/approvals" className="mt-auto pt-4 text-[14px] font-semibold text-[#5B2A9E] inline-flex items-center gap-0.5">Recent decisions <ChevronRight className="h-4 w-4 rtl-flip" /></Link>
            </>
          ) : (
            <>
              <div className="font-display text-[26px] font-semibold text-[#2E0F6B] mt-2 tnum">{sar(waitingTotal)}</div>
              <div className="text-[14px] text-neutral-600 mt-1">{waiting[0].agent_name} asked for {waiting[0].merchant}{waiting.length > 1 ? ` and ${waiting.length - 1} more` : ''}</div>
              <Link to="/approvals" className="btn-primary mt-auto self-start h-11 px-5 rounded-xl">Review and decide</Link>
            </>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <section className="flex-[1.2_1_460px] rounded-[20px] bg-white border border-[#EFEBE4] shadow-[0_1px_2px_rgba(22,18,29,.04)]">
          <h2 className="px-[22px] pt-5 pb-2 font-display text-[18px] font-semibold">Needs attention</h2>
          {exceptions.length === 0 ? (
            <div className="px-[22px] pb-6 text-[14.5px] text-neutral-500">Nothing unusual. Limits and cards look set up.</div>
          ) : (
            <ul className="divide-y divide-[#F1EDE6]">
              {exceptions.map((x) => (
                <li key={x.key} className="flex items-center gap-4 px-[22px] py-3.5">
                  <span className="h-2 w-2 rounded-full bg-[#C98A00] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold">{x.title}</div>
                    <div className="text-[14px] text-neutral-500">{x.body}</div>
                  </div>
                  <Link to={x.to} className="btn-secondary h-10 px-4 rounded-xl shrink-0">{x.cta}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex-[1_1_380px] rounded-[20px] bg-white border border-[#EFEBE4] shadow-[0_1px_2px_rgba(22,18,29,.04)]">
          <div className="flex items-center justify-between px-[22px] pt-5 pb-2">
            <h2 className="font-display text-[18px] font-semibold">Recent</h2>
            <Link to="/spending" className="text-[14px] font-semibold text-brand">See all</Link>
          </div>
          {recent.length === 0 ? (
            <div className="px-[22px] pb-6 text-[14.5px] text-neutral-500">No requests yet. Connect an AI to get started.</div>
          ) : (
            <ul className="divide-y divide-[#F1EDE6]">
              {recent.map((r) => {
                const o = outcome(r)
                return (
                  <li key={r.id} className="flex items-center gap-3 px-[22px] py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold truncate">{r.merchant}</div>
                      <div className="text-[13.5px] text-neutral-500 truncate">{r.agent_name} · <span className={o.cls}>{o.text}</span></div>
                    </div>
                    <div className={`text-[15px] font-semibold tnum ${o.strike ? 'line-through text-neutral-400' : ''}`}>{sar(r.amount)}</div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

    </div>
  )
}
