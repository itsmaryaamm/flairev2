import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUpRight, Bell, Download, MoreVertical, Share, SquarePlus, X } from 'lucide-react'
import { usePush } from '../../lib/usePush'
import { useT } from '../../lib/i18n'
import { Spinner } from '../Spinner'

const SEEN = 'flaire:install-seen'
const NOTIF = 'flaire:notif-asked'
type Evt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const get = (k: string) => {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}
const set = (k: string) => {
  try {
    localStorage.setItem(k, '1')
  } catch {
    // ignore
  }
}

/** Phone only. Step 1: install as an app (first visit). Step 2: one big button to turn notifications on. */
export function InstallSheet() {
  const t = useT()
  const { state, busy, toggle, ios, standalone } = usePush()
  const [seen, setSeen] = useState(() => get(SEEN))
  const [asked, setAsked] = useState(() => get(NOTIF))
  const [evt, setEvt] = useState<Evt | null>(null)

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault()
      setEvt(e as Evt)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  const closeInstall = () => {
    set(SEEN)
    setSeen(true)
  }
  const closeNotif = () => {
    set(NOTIF)
    setAsked(true)
  }

  if (!standalone && !seen) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 p-3" role="dialog" aria-label={t('install.title')}>
        <div className="mx-auto max-w-md rounded-2xl bg-white shadow-2xl border border-line p-5 relative">
          <button type="button" onClick={closeInstall} aria-label={t('common.close')} className="absolute top-3 end-3 h-8 w-8 rounded-full inline-flex items-center justify-center text-neutral-500">
            <X className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-bold pe-8">{t('install.title')}</h2>
          <p className="text-sm text-neutral-600 mt-1">{t('install.why')}</p>
          {ios ? (
            <ol className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2"><Share className="h-4 w-4 text-brand shrink-0" /> {t('install.ios1')}</li>
              <li className="flex items-center gap-2"><SquarePlus className="h-4 w-4 text-brand shrink-0" /> {t('install.ios2')}</li>
            </ol>
          ) : evt ? (
            <button type="button" className="btn-primary w-full mt-3" onClick={async () => { await evt.prompt(); closeInstall() }}>
              <Download className="h-4 w-4" /> {t('install.button')}
            </button>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2"><MoreVertical className="h-4 w-4 text-brand shrink-0" /> {t('install.and1')}</li>
              <li className="flex items-center gap-2"><Download className="h-4 w-4 text-brand shrink-0" /> {t('install.and2')}</li>
            </ol>
          )}
          <div className="mt-3 flex justify-center text-brand motion-safe:animate-bounce" aria-hidden>
            {ios ? <ArrowDown className="h-7 w-7" /> : <ArrowUpRight className="h-7 w-7" />}
          </div>
        </div>
      </div>
    )
  }

  if ((standalone || !ios) && state === 'off' && !asked) {
    return (
      <div className="rounded-2xl bg-brand-light border border-line p-4 flex items-center gap-3">
        <Bell className="h-6 w-6 text-brand shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{t('install.notifTitle')}</div>
          <div className="text-xs text-neutral-600">{t('install.notifWhy')}</div>
        </div>
        <button type="button" className="btn-primary text-xs shrink-0" disabled={busy} onClick={async () => { await toggle(); closeNotif() }}>
          {busy && <Spinner className="h-3.5 w-3.5" />} {t('install.notifButton')}
        </button>
      </div>
    )
  }
  return null
}
