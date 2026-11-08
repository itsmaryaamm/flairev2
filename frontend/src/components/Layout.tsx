import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Search, Plus, LayoutGrid, Users, CreditCard, ShieldCheck, Landmark, Plug, SlidersHorizontal, Server, ShieldAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useT } from '../lib/i18n'
import { useView, hasAdminView } from '../lib/view'
import type { PurchaseRequest } from '../types'
import { KillSwitchBanner } from './KillSwitchBanner'
import { useKillSwitch } from './KillSwitchPanel'
import { AskFlaire } from './AskFlaire'
import { UserRow } from './AccountMenu'
import { CommandPalette } from './CommandPalette'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; admin?: boolean }

export const OPERATE: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/employees', label: 'AI workforce', icon: Users },
  { to: '/spending', label: 'Spending', icon: CreditCard },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
]
export const MANAGE: NavItem[] = [
  { to: '/finance', label: 'Finance', icon: Landmark, admin: true },
  { to: '/connections', label: 'Connections', icon: Plug },
  { to: '/controls', label: 'Controls', icon: SlidersHorizontal },
]
const PLATFORM_NAV: NavItem = { to: '/platform', label: 'Platform', icon: Server }

/** Phone tabs: the simplest app. */
const PHONE_TABS: { to: string; key: string; end?: boolean }[] = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/spending', key: 'nav.activity' },
  { to: '/controls', key: 'nav.settings' },
]

const TITLES: { match: (p: string) => boolean; title: string; sub: string }[] = [
  { match: (p) => p === '/', title: 'Overview', sub: 'Authority left, what needs you, what happened' },
  { match: (p) => p.startsWith('/employees/'), title: 'AI employee', sub: 'Card, limits and history' },
  { match: (p) => p.startsWith('/employees'), title: 'AI workforce', sub: 'Every AI employee, its card and its limits' },
  { match: (p) => p.startsWith('/spending'), title: 'Spending', sub: 'Every request and what Flaire decided' },
  { match: (p) => p.startsWith('/approvals'), title: 'Approvals', sub: 'Requests that need a person, and past decisions' },
  { match: (p) => p.startsWith('/finance'), title: 'Finance', sub: 'Month close, VAT and exports' },
  { match: (p) => p.startsWith('/connections'), title: 'Connections', sub: 'Connect Claude or ChatGPT, payments and the phone app' },
  { match: (p) => p.startsWith('/controls'), title: 'Controls', sub: 'Budgets, rules, security and people' },
  { match: (p) => p.startsWith('/platform'), title: 'Platform', sub: 'Flaire staff console' },
]

/** Small kill switch state pill. Red when ON. Tapping opens the shared reason / confirm modal. */
export function KillSwitchPill({ className = '' }: { className?: string }) {
  const { on, openModal, modal } = useKillSwitch()
  const t = useT()
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={openModal}
        className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold transition-colors ${
          on ? 'bg-danger border-danger text-white hover:bg-[#C8262E]' : 'bg-white border-line-strong text-neutral-600 hover:bg-lavender'
        } ${className}`}
        title={on ? t('kill.onHint') : t('kill.offHint')}
      >
        {on ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5 text-success" />}
        {on ? t('kill.on') : t('kill.off')}
      </button>
      {modal}
    </>
  )
}

/** "My view | Admin view" segmented toggle. Desktop only, and only for roles that have an admin view. */
export function ViewToggle({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { mode, canSwitch, setMode } = useView()
  const t = useT()
  if (!canSwitch) return null
  const btn = (value: 'my' | 'admin', label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`rounded-pill ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-xs'} font-semibold transition-colors whitespace-nowrap ${
        mode === value ? 'bg-brand-light text-brand' : 'text-neutral-600 hover:bg-lavender'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className={`inline-flex rounded-pill border border-line bg-white p-0.5 ${className}`} role="group" aria-label={t('view.label')}>
      {btn('my', t('view.my'))}
      {btn('admin', t('view.admin'))}
    </div>
  )
}

/**
 * One responsive shell. Desktop (md and up): sticky sidebar (Operate / Manage), sticky header with the sandbox pill, Ask Flaire and Connect AI.
 * Phones: three bottom tabs (Home, Activity, Settings), Ask Flaire bar above them.
 */
export function Layout() {
  const { user, company, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()
  const pending = useFetch(() => api.get<PurchaseRequest[]>('/approvals').then((r) => r.data), [location.pathname])
  const pendingCount = pending.data?.length ?? 0
  const admin = hasAdminView(user?.role)
  const operate = OPERATE
  const manage = useMemo(() => [...MANAGE.filter((n) => !n.admin || admin), ...(user?.is_platform_admin ? [PLATFORM_NAV] : [])], [admin, user?.is_platform_admin])
  const [palette, setPalette] = useState(false)
  const { on: killOn, openModal, modal: killModal } = useKillSwitch()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const doLogout = async () => {
    await logout()
    navigate('/login')
  }

  const immersive = location.pathname === '/' || location.pathname === '/spending'
  const head = TITLES.find((x) => x.match(location.pathname)) ?? TITLES[0]

  const navLink = (n: NavItem) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        `flex items-center gap-3 h-[38px] rounded-[10px] px-2.5 text-[15px] font-medium transition-colors ${isActive ? 'bg-[#F1E6FD] text-[#5B2A9E]' : 'text-[#443E50] hover:bg-[#E4E0D7]'}`
      }
    >
      <n.icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
      {n.label}
      {n.to === '/approvals' && pendingCount > 0 && <span className="ms-auto h-2 w-2 rounded-full bg-brand" aria-label={`${pendingCount} waiting`} />}
    </NavLink>
  )
  const group = (label: string) => <div className="px-2.5 pt-3 pb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-[#8A8494]">{label}</div>

  return (
    <div className="min-h-screen flex flex-col">
      <div className="hidden md:block h-[3px] bg-[#F2C14E] sticky top-0 z-40" aria-hidden="true" />
      <div role="status" className={`${immersive ? 'hidden' : 'flex md:hidden'} bg-[#F1E8FF] text-ink text-[13px] font-medium items-center justify-center gap-2.5 min-h-9 px-3 py-1 text-center`}>
        <b className="rounded-[4px] bg-[#FBBF24] text-[#3B2A00] px-2 py-0.5 text-[11px]">Sandbox</b>
        <span>No real money moves.</span>
      </div>
      <KillSwitchBanner />
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col w-[244px] shrink-0 border-e border-[#E2DED5] bg-[#EFECE5] sticky top-[3px] h-[calc(100vh-3px)] overflow-y-auto [scrollbar-width:none] px-3.5 py-[18px]">
          <div className="flex items-center gap-2.5 px-1.5 pb-3">
            <img src="/flaire-mark.png" alt="" className="h-9 w-9 object-contain" />
            <div className="leading-tight">
              <div className="font-display text-[19px] font-semibold tracking-tight">Flaire</div>
              <div className="text-[13px] text-[#6F6878]">{company?.name} · SAR</div>
            </div>
          </div>
          <nav className="flex-1">
            {group('Operate')}
            <div className="space-y-0.5">{operate.map(navLink)}</div>
            {group('Manage')}
            <div className="space-y-0.5">{manage.map(navLink)}</div>
          </nav>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-white border border-[#EFEBE4] px-3 py-2.5 flex items-center gap-2">
              <ShieldAlert className={`h-4 w-4 ${killOn ? 'text-danger' : 'text-neutral-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">Kill switch</div>
                <div className="text-[12px] text-neutral-500">{killOn ? 'On. All spending is stopped.' : 'Off. Spending is allowed.'}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={killOn}
                aria-label="Kill switch"
                onClick={openModal}
                className={`relative h-6 w-10 rounded-full transition-colors ${killOn ? 'bg-danger' : 'bg-[#D9D4E3]'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${killOn ? 'start-[18px]' : 'start-0.5'}`} />
              </button>
            </div>
            <UserRow onLogout={doLogout} />
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header */}
          <header className="hidden md:flex sticky top-[3px] z-30 items-center gap-4 bg-[rgba(247,245,241,.86)] backdrop-blur-[14px] px-10 py-3.5">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[26px] leading-tight font-semibold tracking-tightest truncate">{head.title}</h1>
              <p className="text-[14px] text-[#6F6878] truncate">{head.sub}</p>
            </div>
            <span title="Everything here is simulated. No real money moves, and no real card is charged." className="rounded-full bg-[#FBF0D9] text-[#5E4300] text-[13px] font-semibold px-3.5 h-9 inline-flex items-center gap-2 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-[#C98A00]" /> Sandbox · simulated
            </span>
            <button type="button" onClick={() => setPalette(true)} className="hidden lg:inline-flex items-center gap-2 h-10 w-[230px] rounded-xl border border-[#E2DED5] bg-white px-3 text-[14px] text-neutral-500 hover:border-brand">
              <Search className="h-4 w-4" /> <span className="flex-1 text-start">Ask Flaire</span>
              <kbd className="rounded bg-[#F1EEE8] px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600">⌘K</kbd>
            </button>
            <NavLink to="/connections" className="btn-primary h-11 px-5 rounded-xl">
              <Plus className="h-4 w-4" /> Connect AI
            </NavLink>
          </header>

          {/* Phone top bar for pages that are not Home or Activity */}
          {!immersive && (
            <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-line px-4 h-14 flex items-center justify-between gap-2 pt-[env(safe-area-inset-top)]">
              <img src="/flaire-logo.png" alt="Flaire" className="h-6 w-auto shrink-0" />
              <button onClick={doLogout} className="text-[14px] font-semibold text-neutral-600">{t('auth.signOut')}</button>
            </header>
          )}

          <main className="flex-1 w-full max-w-[1760px] mx-auto px-4 py-5 md:px-10 md:pt-3 md:pb-10 pb-[calc(9rem+env(safe-area-inset-bottom))]">
            <Outlet />
          </main>
        </div>
      </div>

      <AskFlaire />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      {killModal}
      {/* Phone bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line grid grid-cols-3 h-[68px] pb-[env(safe-area-inset-bottom)]">
        {PHONE_TABS.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `relative flex items-center justify-center text-[15px] font-semibold ${isActive ? 'text-brand' : 'text-neutral-600'}`}>
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-0 h-[3px] w-9 rounded-b-full bg-brand" />}
                {t(n.key)}
                {n.to === '/' && pendingCount > 0 && <span className="ms-1.5 h-2 w-2 rounded-full bg-brand" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
