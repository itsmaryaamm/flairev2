import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Building2, ChevronRight, CreditCard, Plug, Scale, ShieldCheck, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { CompanyCard } from '../components/settings/CompanyCard'
import { ConnectClaudeCard } from '../components/settings/ConnectClaudeCard'
import { PaymentsCard } from '../components/settings/PaymentsCard'
import { NotificationsCard } from '../components/settings/NotificationsCard'
import { SecurityCard } from '../components/settings/SecurityCard'
import { ApprovalRulesCard, SupplierPolicyCard } from '../components/settings/PolicyCards'
import { AdvancedCard } from '../components/settings/AdvancedCard'
import { DangerZoneCard } from '../components/settings/DangerZoneCard'
import { useT } from '../lib/i18n'

type Tab = { key: string; label: string; icon: LucideIcon; ids: string[]; body: ReactNode }

const TABS: Tab[] = [
  { key: 'company', label: 'Company', icon: Building2, ids: ['company'], body: <CompanyCard /> },
  { key: 'connect', label: 'Connect AI', icon: Plug, ids: ['connect'], body: <ConnectClaudeCard /> },
  { key: 'payments', label: 'Payments', icon: CreditCard, ids: ['payments'], body: <PaymentsCard /> },
  {
    key: 'rules',
    label: 'Rules',
    icon: Scale,
    ids: ['suppliers', 'approvals'],
    body: (
      <>
        <SupplierPolicyCard />
        <ApprovalRulesCard />
      </>
    ),
  },
  { key: 'notifications', label: 'Notifications', icon: Bell, ids: ['notifications'], body: <NotificationsCard /> },
  { key: 'security', label: 'Security', icon: ShieldCheck, ids: ['security'], body: <SecurityCard /> },
  {
    key: 'advanced',
    label: 'Advanced',
    icon: Wrench,
    ids: ['advanced', 'danger'],
    body: (
      <>
        <AdvancedCard />
        <DangerZoneCard />
      </>
    ),
  },
]

const tabForHash = (hash: string) => TABS.find((t) => t.ids.includes(hash.replace('#', '')))?.key

/** Settings: one section at a time, with an icon list on the side (a scrolling strip on phones). Old deep links like /settings#connect still land on the right section. */
export default function SettingsPage() {
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const [active, setActive] = useState(() => tabForHash(location.hash) ?? 'company')

  useEffect(() => {
    const key = tabForHash(location.hash)
    if (key) setActive(key)
    const id = location.hash.replace('#', '')
    if (!id) return
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  const pick = (key: string) => {
    setActive(key)
    if (location.hash) navigate('/settings', { replace: true })
  }
  const current = TABS.find((x) => x.key === active) ?? TABS[0]

  return (
    <div className="max-w-[1000px]">
      <PageHeader title={t('nav.settings')} />
      <Link to="/employees" className="md:hidden card-lg px-5 py-4 mb-4 flex items-center gap-3 hover:bg-lavender">
        <span className="font-bold flex-1">{t('nav.employees')}</span>
        <ChevronRight className="h-4 w-4 text-neutral-400 rtl-flip" />
      </Link>
      <div className="md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-8 items-start">
        <nav aria-label={t('nav.settings')} className="-mx-4 px-4 md:mx-0 md:px-0 mb-4 md:mb-0 flex md:flex-col gap-1.5 md:gap-1 overflow-x-auto md:overflow-visible [scrollbar-width:none] md:sticky md:top-8">
          {TABS.map((x) => {
            const on = x.key === current.key
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => pick(x.key)}
                aria-current={on ? 'page' : undefined}
                className={`shrink-0 inline-flex items-center gap-2.5 rounded-lg px-3 h-10 text-sm font-semibold transition-colors ${on ? 'bg-white text-ink shadow-[0_0_0_1px_#E3DFEE]' : 'text-neutral-600 hover:bg-white/70 hover:text-ink'}`}
              >
                <x.icon className={`h-[18px] w-[18px] ${on ? 'text-brand' : 'text-neutral-500'}`} />
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
