import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import { useView } from '../lib/view'
import { useT } from '../lib/i18n'
import type { AdminView, DashboardSummary, FeeStatement, MyView, PurchaseRequest } from '../types'
import { KillSwitchPill } from '../components/Layout'
import { ErrorNote } from '../components/ErrorNote'
import { GettingStartedCard } from '../components/dashboard/GettingStartedCard'
import { GetTheApp } from '../components/home/GetTheApp'
import { NeedsYou } from '../components/home/NeedsYou'
import { MonthCard } from '../components/home/MonthCard'
import { RecentActivity } from '../components/home/RecentActivity'
import { MyViewPanel } from '../components/home/MyViewPanel'
import { AdminBlock } from '../components/home/AdminBlock'
import { PhoneAllClear, PhoneGreeting, PhoneRecent, PhoneSpend } from '../components/phone/Phone'

const REFRESH_MS = 30_000

function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Home. Desktop serves both views (My view: what this person can act on; Admin view: the whole company).
 * Phone is the simplest app: company and kill switch, Needs you, This month, Recent activity.
 * A `?decide=<request id>` in the URL (push notification tap) opens the decision sheet for that request.
 */
export default function HomePage() {
  const { company } = useAuth()
  const t = useT()
  const { mode, phone } = useView()
  const admin = mode === 'admin'
  const [search, setSearch] = useSearchParams()
  const decideId = Number(search.get('decide')) || null

  const summary = useFetch(() => api.get<DashboardSummary>('/dashboard/summary').then((r) => r.data), [])
  const approvals = useFetch(() => (admin ? api.get<PurchaseRequest[]>('/approvals').then((r) => r.data) : Promise.resolve([])), [admin])
  const fees = useFetch(() => api.get<FeeStatement>('/fees/statement', { params: { month: thisMonth() } }).then((r) => r.data), [])
  const myView = useFetch(() => (admin ? Promise.resolve(null) : api.get<MyView>('/me/view').then((r) => r.data)), [admin])
  const adminView = useFetch(() => (admin && !phone ? api.get<AdminView>('/admin/view').then((r) => r.data) : Promise.resolve(null)), [admin, phone])

  const refreshAll = useCallback(() => {
    void summary.refetch()
    void approvals.refetch()
    void fees.refetch()
    void myView.refetch()
    void adminView.refetch()
  }, [summary.refetch, approvals.refetch, fees.refetch, myView.refetch, adminView.refetch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh every 30 s while visible, and when the tab becomes visible again.
  useEffect(() => {
    let timer: number | null = null
    const start = () => {
      if (timer === null) timer = window.setInterval(refreshAll, REFRESH_MS)
    }
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshAll()
        start()
      } else stop()
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshAll])

  const onDecided = useCallback(
    (result: PurchaseRequest) => {
      // Drop it from the list right away, then reload everything.
      if (!(result.needs_second_approver && result.status === 'pending_approval')) {
        approvals.setData((prev) => (prev ? prev.filter((r) => r.id !== result.id) : prev))
        myView.setData((prev) => (prev ? { ...prev, needs_me: prev.needs_me.filter((r) => r.id !== result.id) } : prev))
      }
      refreshAll()
    },
    [approvals.setData, myView.setData, refreshAll], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const clearDecide = useCallback(() => {
    if (!search.has('decide')) return
    const next = new URLSearchParams(search)
    next.delete('decide')
    setSearch(next, { replace: true })
  }, [search, setSearch])

  const totals = summary.data?.totals
  const recent = (summary.data?.recent_requests ?? []).slice(0, phone ? 5 : 6)
  const listError = admin ? approvals.error && !approvals.data : myView.error && !myView.data
  const error = listError ? (admin ? approvals.error : myView.error) : summary.error && !summary.data ? summary.error : null

  const needsItems = admin ? (approvals.data ?? []) : (myView.data?.needs_me ?? [])
  const needsLoading = admin ? approvals.loading && !approvals.data : myView.loading && !myView.data

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tightest truncate">{company?.name ?? 'Flaire'}</h1>
        {company?.kill_switch && company.kill_switch_reason && <div className="text-xs text-danger truncate mt-0.5">{company.kill_switch_reason}</div>}
      </div>
      <KillSwitchPill className="md:hidden" />
    </div>
  )

  const needsYou = (
    <NeedsYou
      items={needsItems}
      loading={needsLoading}
      killSwitch={!!company?.kill_switch}
      onDecided={onDecided}
      decideId={decideId}
      onDecideHandled={clearDecide}
    />
  )

  if (phone) {
    return (
      <div className="space-y-4 -mt-5">
        <PhoneGreeting />
        {error && <ErrorNote message={error} />}
        <NeedsYou
          items={needsItems}
          loading={needsLoading}
          killSwitch={!!company?.kill_switch}
          onDecided={onDecided}
          decideId={decideId}
          onDecideHandled={clearDecide}
          title={t('phone.waiting')}
          emptyView={<PhoneAllClear pending={0} />}
          hideHeader={needsItems.length === 0}
        />
        <PhoneSpend spent={totals?.spent_this_period ?? 0} budget={totals?.budget_total ?? 0} parts={(summary.data?.agents ?? []).map((a) => ({ id: a.id, name: a.name, spent: a.spent_this_period }))} />
        <PhoneRecent items={recent} />
        <GetTheApp />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {header}

      {admin && <GettingStartedCard />}
      {error && <ErrorNote message={error} />}
      {admin && adminView.error && !adminView.data && <ErrorNote message={adminView.error} />}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {needsYou}
          <GetTheApp />
          {!admin && myView.data && <MyViewPanel view={myView.data} />}
          {admin && adminView.data && <AdminBlock view={adminView.data} />}
        </div>
        <div className="space-y-5 min-w-0">
          <MonthCard spent={totals?.spent_this_period ?? 0} budget={totals?.budget_total ?? 0} fees={fees.data} parts={(summary.data?.agents ?? []).map((a) => ({ name: a.name, spent: a.spent_this_period }))} />
          <RecentActivity items={recent} />
        </div>
      </div>
    </div>
  )
}
