import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, History, Scale, ShieldCheck, Store, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFetch } from '../lib/useFetch'
import { useT } from '../lib/i18n'
import { sar } from '../lib/money'
import { hasAdminView } from '../lib/view'
import type { Agent, DashboardSummary } from '../types'
import { CompanyCard } from '../components/settings/CompanyCard'
import { NotificationsCard } from '../components/settings/NotificationsCard'
import { SecurityCard } from '../components/settings/SecurityCard'
import { ApprovalRulesCard, SupplierPolicyCard } from '../components/settings/PolicyCards'
import { AdvancedCard } from '../components/settings/AdvancedCard'
import { DangerZoneCard } from '../components/settings/DangerZoneCard'
import { KillSwitchPanel } from '../components/KillSwitchPanel'
import TeamPage from './TeamPage'
import PolicyPage from './PolicyPage'

type Tab = { key: string; label: string; icon: LucideIcon; ids: string[]; admin?: boolean; body: ReactNode }

function Budgets() {
  const summary = useFetch(() => api.get<DashboardSummary>('/dashboard/summary').then((r) => r.data), [])
  const agents = useFetch(() => api.get<Agent[]>('/agents').then((r) => r.data), [])
  const cap = summary.data?.totals.budget_total ?? 0
  const spent = summary.data?.totals.spent_this_period ?? 0
  const none = <span className="text-neutral-400">Not set</span>
  return (
    <div id="budgets" className="space-y-5 scroll-mt-20">
      <section className="rounded-[20px] bg-white border border-[#EFEBE4] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[14px] text-neutral-500">Company monthly budget</div>
          <div className="font-display text-[34px] font-semibold tracking-tightest tnum">{sar(cap)}</div>
          <div className="text-[13.5px] text-neutral-500 tnum">{sar(spent)} authorized · {sar(Math.max(0, cap - spent))} left</div>
        </div>
        <a href="#advanced" className="btn-secondary h-11 px-5 rounded-xl">Change budget</a>
      </section>
      <section className="rounded-[20px] bg-white border border-[#EFEBE4] overflow-x-auto">
        <table className="w-full min-w-[640px] text-[14.5px]">
          <thead>
            <tr className="text-start text-[12px] uppercase tracking-[.04em] text-neutral-500 bg-[#FAF8F4]">
              {['Employee', 'Card', 'Monthly', 'Per purchase', 'Asks you from'].map((h) => <th key={h} className="text-start font-semibold px-5 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1EDE6]">
            {(agents.data ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-[#FAF8F4]">
                <td className="px-5 py-3.5"><Link to={`/employees/${a.id}`} className="font-semibold hover:text-brand">{a.name}</Link></td>
                <td className="px-5 py-3.5 tnum whitespace-nowrap">{a.card ? `•••• ${a.card.last4}` : 'None'}</td>
                <td className="px-5 py-3.5 tnum whitespace-nowrap">{a.monthly_limit ? sar(a.monthly_limit) : none}</td>
                <td className="px-5 py-3.5 tnum whitespace-nowrap">{a.per_transaction_limit ? sar(a.per_transaction_limit) : none}</td>
                <td className="px-5 py-3.5 tnum whitespace-nowrap">{a.approval_threshold ? sar(a.approval_threshold) : none}</td>
              </tr>
            ))}
            {(agents.data ?? []).length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-neutral-500">No AI employees yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}

const TABS: Tab[] = [
  { key: 'budgets', label: 'Budgets & limits', icon: Wallet, ids: ['budgets'], body: <Budgets /> },
  { key: 'rules', label: 'Approval rules', icon: Scale, ids: ['rules', 'approvals', 'chains'], body: <ApprovalRulesCard /> },
  { key: 'suppliers', label: 'Suppliers', icon: Store, ids: ['suppliers'], body: <SupplierPolicyCard /> },
  { key: 'security', label: 'Security', icon: ShieldCheck, ids: ['security', 'killswitch'], body: (<><SecurityCard /><KillSwitchPanel /></>) },
  { key: 'people', label: 'People & roles', icon: Users, ids: ['people', 'delegation'], body: <TeamPage /> },
  { key: 'history', label: 'Policy history', icon: History, ids: ['history', 'versions', 'pending'], admin: true, body: <PolicyPage /> },
  { key: 'company', label: 'Company', icon: Building2, ids: ['company', 'notifications', 'advanced', 'danger'], body: (<><CompanyCard /><NotificationsCard /><AdvancedCard /><DangerZoneCard /></>) },
]

const tabForHash = (hash: string) => TABS.find((x) => x.ids.includes(hash.replace('#', '')))?.key

/** Controls: one section at a time. Old /settings, /team and /policy links land on the right section. */
export default function ControlsPage() {
  const t = useT()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const tabs = TABS.filter((x) => !x.admin || hasAdminView(user?.role))
  const [active, setActive] = useState(() => tabForHash(location.hash) ?? 'budgets')

  useEffect(() => {
    const key = tabForHash(location.hash)
    if (key) setActive(key)
    const id = location.hash.replace('#', '')
    if (!id) return
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  const pick = (key: string) => {
    setActive(key)
    if (location.hash) navigate('/controls', { replace: true })
  }
  const current = tabs.find((x) => x.key === active) ?? tabs[0]

  return (
    <div className="max-w-[1100px]">
      <h1 className="md:hidden font-display text-[28px] font-bold tracking-tightest mb-4">{t('nav.settings')}</h1>
      <div className="md:hidden space-y-2 mb-4">
        {[{ to: '/employees', l: t('nav.employees') }, { to: '/connections', l: 'Connections' }].map((x) => (
          <Link key={x.to} to={x.to} className="card-lg px-5 py-4 flex items-center gap-3 hover:bg-lavender">
            <span className="font-bold flex-1">{x.l}</span>
            <ChevronRight className="h-4 w-4 text-neutral-400 rtl-flip" />
          </Link>
        ))}
      </div>
      <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 items-start">
        <nav aria-label="Controls" className="-mx-4 px-4 md:mx-0 md:px-0 mb-4 md:mb-0 flex md:flex-col gap-1.5 md:gap-1 overflow-x-auto md:overflow-visible [scrollbar-width:none] md:sticky md:top-24">
          {tabs.map((x) => {
            const on = x.key === current.key
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => pick(x.key)}
                aria-current={on ? 'page' : undefined}
                className={`shrink-0 inline-flex items-center gap-2.5 rounded-[10px] px-3.5 h-11 text-[15px] font-medium transition-colors whitespace-nowrap ${on ? 'bg-white text-ink shadow-[0_0_0_1px_#EFEBE4]' : 'text-neutral-600 hover:bg-white/70 hover:text-ink'}`}
              >
                <x.icon className={`h-[18px] w-[18px] ${on ? 'text-brand' : 'text-neutral-500'}`} strokeWidth={1.7} />
                {x.label}
              </button>
            )
          })}
        </nav>
        <div className="space-y-5 min-w-0">{current.body}</div>
      </div>
    </div>
  )
}
