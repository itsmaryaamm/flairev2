import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import { sar } from '../lib/money'
import type { PurchaseRequest } from '../types'
import { NeedsYou } from '../components/home/NeedsYou'
import { ErrorNote } from '../components/ErrorNote'
import { PayPalApprove } from '../components/PayPalApprove'
import { ActivityRow } from '../components/activity/ActivityRow'

/** Approvals: what is waiting for a person (calm when empty), then the decisions already made. */
export default function ApprovalsPage() {
  const { company } = useAuth()
  const [search, setSearch] = useSearchParams()
  const decideId = Number(search.get('decide')) || null
  const approvals = useFetch(() => api.get<PurchaseRequest[]>('/approvals').then((r) => r.data), [])
  const reqs = useFetch(() => api.get<PurchaseRequest[]>('/purchase-requests', { params: { limit: 100 } }).then((r) => r.data), [])
  const waiting = approvals.data ?? []
  const decided = useMemo(
    () => (reqs.data ?? []).filter((r) => r.status !== 'pending_approval' && r.status !== 'awaiting_paypal' && (r.approved_by || r.status === 'denied' || r.status === 'rejected')).slice(0, 25),
    [reqs.data],
  )
  const refresh = useCallback(() => {
    void approvals.refetch()
    void reqs.refetch()
  }, [approvals.refetch, reqs.refetch]) // eslint-disable-line react-hooks/exhaustive-deps
  const clearDecide = useCallback(() => {
    if (!search.has('decide')) return
    const n = new URLSearchParams(search)
    n.delete('decide')
    setSearch(n, { replace: true })
  }, [search, setSearch])

  return (
    <div className="flex flex-col gap-5 max-w-[900px]">
      {approvals.error && !approvals.data && <ErrorNote message={approvals.error} />}
      <NeedsYou
        items={waiting}
        loading={approvals.loading && !approvals.data}
        killSwitch={!!company?.kill_switch}
        onDecided={refresh}
        decideId={decideId}
        onDecideHandled={clearDecide}
        title="Waiting for you"
        emptyView={
          <div className="rounded-[18px] bg-[#F1E6FD] px-5 py-4 text-[15px] text-[#2E0F6B]">
            <b>Nothing waiting for you.</b> <span className="text-neutral-600">A request shows up here the moment an AI employee needs a person. Approving asks for your password.</span>
          </div>
        }
      />
      <PayPalApprove items={reqs.data ?? []} />
      <section className="rounded-[20px] bg-white border border-[#EFEBE4] overflow-hidden">
        <div className="flex items-center justify-between px-[22px] pt-5 pb-2">
          <h2 className="font-display text-[18px] font-semibold">Recent decisions</h2>
          <Link to="/spending" className="text-[14px] font-semibold text-brand">All spending</Link>
        </div>
        {decided.length === 0 ? (
          <div className="px-[22px] pb-6 text-[14.5px] text-neutral-500">No decisions yet. {sar(0)} approved.</div>
        ) : (
          <ul className="divide-y divide-line">
            {decided.map((r) => (
              <ActivityRow key={r.id} request={r} transaction={null} onChanged={refresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
