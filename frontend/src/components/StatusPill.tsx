import type { ReactNode } from 'react'
import { translate } from '../lib/i18n'
import { moneyLocale } from '../lib/money'

export type PillTone = 'green' | 'amber' | 'red' | 'neutral' | 'blue' | 'mint' | 'lavender'

const toneClasses: Record<PillTone, string> = {
  green: 'text-[#0F7A55] [--d:#12A36F]',
  mint: 'text-[#0F7A55] [--d:#12A36F]',
  amber: 'text-[#9A4A06] [--d:#E08A1E]',
  red: 'text-[#B3202A] [--d:#E0313A]',
  lavender: 'text-brand-dark [--d:#7B2FF2]',
  neutral: 'text-neutral-600 [--d:#A49CB8]',
  blue: 'text-brand-dark [--d:#7B2FF2]',
}

/** Maps any status string from the API onto a visual tone. */
export function toneFor(status: string | null | undefined): PillTone {
  switch (status) {
    case 'approved':
    case 'completed':
    case 'settled':
    case 'authorized':
    case 'active':
    case 'ok':
      return 'green'
    case 'pending_approval':
    case 'awaiting_paypal':
    case 'pending':
    case 'paused':
      return 'amber'
    case 'denied':
    case 'rejected':
    case 'failed':
    case 'declined':
    case 'reversed':
    case 'frozen':
    case 'broken':
      return 'red'
    case 'auto_approved':
      return 'lavender'
    default:
      return 'neutral'
  }
}

const LABELS: Record<string, string> = {
  completed: 'Sandbox authorized',
  settled: 'Sandbox authorized',
  authorized: 'Authorized',
  approved: 'Approved',
  pending_approval: 'Waiting for you',
  awaiting_paypal: 'Approve in PayPal',
  pending: 'Waiting for you',
  denied: 'Blocked',
  rejected: 'Blocked',
  declined: 'Blocked',
  failed: 'Payment failed',
  auto_approved: 'Auto-approved',
  reversed: 'Reversed',
  active: 'Active',
  paused: 'Paused',
  frozen: 'Frozen',
}

export function labelFor(status: string | null | undefined): string {
  const loc = moneyLocale()
  if (!status) return translate(loc, 'status.unknown')
  const key = `status.${status}`
  const hit = translate(loc, key)
  if (hit !== key) return hit
  const known = LABELS[status]
  if (known) return known
  const plain = status.replace(/_/g, ' ')
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

export function StatusPill({
  status,
  tone,
  children,
  className = '',
  dot = true,
}: {
  status?: string | null
  tone?: PillTone
  children?: ReactNode
  className?: string
  dot?: boolean
}) {
  const t = tone ?? toneFor(status)
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap ${toneClasses[t]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[var(--d)]" />}
      {children ?? labelFor(status)}
    </span>
  )
}
