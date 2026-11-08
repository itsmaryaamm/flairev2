import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Share, SquarePlus, X, MoreVertical, Download } from 'lucide-react'
import { useView } from '../../lib/view'

const KEY = 'flaire:getapp-dismissed'

function standalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="h-6 w-6 shrink-0 rounded-full bg-ink text-white text-xs font-semibold inline-flex items-center justify-center">{n}</span>
      <span className="flex-1 text-sm text-ink">{children}</span>
      <span className="h-9 w-9 shrink-0 rounded-lg border border-line-strong bg-white inline-flex items-center justify-center text-brand">{icon}</span>
    </li>
  )
}

/** Desktop: a QR code that opens this same app on a phone. Phone (not installed): the Add to Home Screen steps. Dismissible. */
export function GetTheApp() {
  const { phone } = useView()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const [qr, setQr] = useState<string>('')
  useEffect(() => {
    if (phone) return
    QRCode.toDataURL(window.location.origin + '/?app=1', { margin: 1, width: 220, color: { dark: '#16112B', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => undefined)
  }, [phone])

  if (hidden || (phone && standalone())) return null
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // ignore
    }
    setHidden(true)
  }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)

  return (
    <section className="card-lg p-5 relative">
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute top-3 end-3 h-9 w-9 rounded-full inline-flex items-center justify-center text-neutral-500 hover:bg-lavender">
        <X className="h-4 w-4" />
      </button>
      {phone ? (
        <>
          <h2 className="text-base font-semibold">Add Flaire to your Home Screen</h2>
          <p className="text-sm text-neutral-600 mt-0.5">Approve in one tap, and get an alert the moment an AI employee needs you.</p>
          <ol className="mt-2 divide-y divide-line">
            {ios ? (
              <>
                <Step n={1} icon={<Share className="h-4 w-4" />}>Tap Share in Safari</Step>
                <Step n={2} icon={<SquarePlus className="h-4 w-4" />}>Choose Add to Home Screen</Step>
                <Step n={3} icon={<span className="text-xs font-bold">F</span>}>Open Flaire from your Home Screen and allow notifications</Step>
              </>
            ) : (
              <>
                <Step n={1} icon={<MoreVertical className="h-4 w-4" />}>Tap the menu in Chrome</Step>
                <Step n={2} icon={<Download className="h-4 w-4" />}>Choose Install app</Step>
                <Step n={3} icon={<span className="text-xs font-bold">F</span>}>Open Flaire and allow notifications</Step>
              </>
            )}
          </ol>
        </>
      ) : (
        <div className="flex items-center gap-5">
          <div className="h-[110px] w-[110px] shrink-0 rounded-lg border border-line bg-white p-1.5">{qr && <img src={qr} alt="QR code that opens Flaire on your phone" className="h-full w-full" />}</div>
          <div className="min-w-0 pe-8">
            <h2 className="text-base font-semibold">Get Flaire on your phone</h2>
            <p className="text-sm text-neutral-600 mt-1">Scan with your phone camera. Approve requests in one tap and get a notification the moment an AI employee needs you.</p>
          </div>
        </div>
      )}
    </section>
  )
}
