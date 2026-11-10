import { ExternalLink } from 'lucide-react'
import { sar } from '../lib/money'
import type { PurchaseRequest } from '../types'

type Order = { id: string; approve_url: string; usd: string }
const orderOf = (r: PurchaseRequest): Order | null => ((r.decision as unknown as { paypal_order?: Order } | null)?.paypal_order) ?? null

/** Purchases a person already approved in Flaire that now wait for the approver to confirm them in PayPal. */
export function PayPalApprove({ items }: { items: PurchaseRequest[] }) {
  const rows = items.filter((r) => r.status === 'awaiting_paypal' && orderOf(r))
  if (rows.length === 0) return null
  return (
    <section className="rounded-[20px] border border-[#D9C2FA] bg-[#F1E6FD] px-[22px] py-5" aria-label="Approve in PayPal">
      <h2 className="font-display text-[18px] font-semibold text-[#2E0F6B]">Finish in PayPal</h2>
      <p className="text-[14px] text-neutral-700 mt-1">Flaire approved these. PayPal asks you to confirm the payment with your PayPal login. Nothing is paid until you do.</p>
      <ul className="mt-3 divide-y divide-[#D9C2FA]">
        {rows.map((r) => {
          const o = orderOf(r)!
          return (
            <li key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{r.merchant} <span className="text-neutral-500 font-normal">by {r.agent_name}</span></div>
                <div className="text-[13px] text-neutral-600">{sar(r.amount)} (USD {o.usd} at PayPal sandbox)</div>
              </div>
              <a className="btn-primary text-sm" href={o.approve_url}>
                Approve in PayPal <ExternalLink className="h-4 w-4" />
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
