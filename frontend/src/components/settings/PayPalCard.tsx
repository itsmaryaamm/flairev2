import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { Spinner } from '../Spinner'

type Status = { configured: boolean; sandbox: boolean; receiver_set: boolean; webhook_url_path: string }
type Test = { ok: boolean; message: string; sandbox?: boolean; payouts_enabled?: boolean | null; receiver_set?: boolean; receiver?: string | null }

/** Connections card: PayPal sandbox. The keys live on the server; this proves they work without moving money. */
export function PayPalCard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [result, setResult] = useState<Test | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get<Status>('/paypal/status').then((r) => setStatus(r.data)).catch(() => undefined)
  }, [])

  const test = async () => {
    setBusy(true)
    try {
      const { data } = await api.post<Test>('/paypal/test')
      setResult(data)
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null
  return (
    <section className="card p-5" aria-label="PayPal sandbox">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">PayPal sandbox</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Approved purchases are paid out through the PayPal Payouts API. Sandbox only, so no real money moves.
          </p>
        </div>
        <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${status.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {status.configured ? 'Keys set' : 'Not set up'}
        </span>
      </div>
      {!status.configured && (
        <p className="text-sm mt-3 text-neutral-700">
          Add PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_RECEIVER_EMAIL on the server, then test the connection here.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary text-sm" onClick={test} disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} Test PayPal connection
        </button>
        <span className="text-xs text-neutral-500">Webhook address: <code className="font-mono">{status.webhook_url_path}</code></span>
      </div>
      {result && (
        <div className={`mt-3 text-sm flex items-start gap-2 ${result.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">
          {result.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <div>
            {result.message}
            {result.ok && result.receiver_set === false && <div className="text-amber-700">PAYPAL_RECEIVER_EMAIL is missing, so payouts have nobody to pay.</div>}
            {result.ok && result.payouts_enabled === null && <div className="text-neutral-600">Make sure Payouts is ticked in the sandbox app features.</div>}
            {result.ok && result.receiver && <div className="text-neutral-600">Merchant (sandbox receiver): {result.receiver}</div>}
          </div>
        </div>
      )}
    </section>
  )
}
