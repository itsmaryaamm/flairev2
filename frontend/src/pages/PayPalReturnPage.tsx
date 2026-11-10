import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { Spinner } from '../components/Spinner'
import type { PurchaseRequest } from '../types'

/** PayPal sends the approver back here. Flaire captures the order, which is what actually moves the (sandbox) money. */
export default function PayPalReturnPage() {
  const [search] = useSearchParams()
  const order = search.get('token')
  const cancelled = search.get('cancelled') === '1'
  const [state, setState] = useState<'working' | 'done' | 'error'>(cancelled || !order ? 'error' : 'working')
  const [msg, setMsg] = useState(cancelled ? 'You cancelled in PayPal. Nothing was paid. Open Approvals to try again.' : !order ? 'PayPal did not send an order reference.' : '')
  const [req, setReq] = useState<PurchaseRequest | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!order || cancelled || started.current) return
    started.current = true
    api.post<PurchaseRequest>('/paypal/checkout/capture', { order_id: order })
      .then((r) => { setReq(r.data); setState('done') })
      .catch((e) => { setMsg(errorMessage(e)); setState('error') })
  }, [order, cancelled])

  return (
    <div className="max-w-[560px] mx-auto mt-10 card p-8 text-center">
      {state === 'working' && (<><Spinner className="h-6 w-6 mx-auto" /><p className="mt-3 font-semibold">Confirming your payment with PayPal</p></>)}
      {state === 'done' && (
        <>
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
          <h1 className="text-xl font-bold mt-3">Paid through PayPal (sandbox)</h1>
          <p className="text-neutral-600 mt-1">{req ? `${req.merchant} was approved by you in Flaire and in PayPal.` : 'Done.'}</p>
        </>
      )}
      {state === 'error' && (
        <>
          <XCircle className="h-10 w-10 text-red-600 mx-auto" />
          <h1 className="text-xl font-bold mt-3">Not completed</h1>
          <p className="text-neutral-600 mt-1">{msg}</p>
        </>
      )}
      <div className="mt-5 flex justify-center gap-3">
        <Link to="/approvals" className="btn-secondary">Approvals</Link>
        <Link to="/spending" className="btn-primary">Spending</Link>
      </div>
    </div>
  )
}
