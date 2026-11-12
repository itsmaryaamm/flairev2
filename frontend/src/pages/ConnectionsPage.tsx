import { Link } from 'react-router-dom'
import { ConnectClaudeCard } from '../components/settings/ConnectClaudeCard'
import { PAYPAL_ONLY } from '../lib/flags'
import { PayPalCard } from '../components/settings/PayPalCard'
import { PaymentsCard } from '../components/settings/PaymentsCard'
import { GetTheApp } from '../components/home/GetTheApp'

/** Connections: connect Claude or ChatGPT once, payments, and the phone app. */
export default function ConnectionsPage() {
  return (
    <div className="max-w-[900px] space-y-5">
      <p className="text-[14.5px] text-neutral-600">
        An <b>AI employee</b> is the financial identity: card, limits and history. An <b>AI app</b> is where it runs, like Claude or ChatGPT. You pick the employee when you connect. To see or revoke an app for one employee, open it under <Link to="/employees" className="text-brand font-semibold">AI workforce</Link>.
      </p>
      <ConnectClaudeCard />
      <PayPalCard />
      {!PAYPAL_ONLY && <PaymentsCard />}
      <GetTheApp />
    </div>
  )
}
