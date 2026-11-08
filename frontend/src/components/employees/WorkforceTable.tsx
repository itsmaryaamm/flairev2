import { Link } from 'react-router-dom'
import { sar } from '../../lib/money'
import type { Agent } from '../../types'
import { dotColor } from '../phone/Phone'

const TILE = ['#3E8FE0', '#D9774A', '#1F8A8A', '#C94F8A', '#7A2AD8', '#0F7A55']

function status(a: Agent): { text: string; cls: string; action: string; primary: boolean } {
  if (a.status !== 'active') return { text: 'Paused', cls: 'text-[#8A5600]', action: 'Open', primary: false }
  if (!a.card && !a.monthly_limit) return { text: 'No card or limit', cls: 'text-[#C2362B]', action: 'Issue card', primary: true }
  if (!a.last_active_at) return { text: 'Not connected', cls: 'text-[#8A5600]', action: 'Connect', primary: true }
  return { text: 'Active', cls: 'text-[#17835F]', action: 'Open', primary: false }
}

/** Desktop workforce: one row per AI employee. */
export function WorkforceTable({ agents }: { agents: Agent[] }) {
  const setup = agents.filter((a) => status(a).primary).length
  const connected = agents.filter((a) => a.last_active_at).length
  return (
    <div>
      <p className="text-[14.5px] text-neutral-600 mb-3">{agents.length} employees · {connected} connected · {setup} need setup</p>
      <div className="rounded-[20px] bg-white border border-[#EFEBE4] overflow-x-auto shadow-[0_1px_2px_rgba(22,18,29,.04)]">
        <table className="w-full min-w-[720px] text-[14.5px]">
          <thead>
            <tr className="bg-[#FAF8F4] text-[12px] uppercase tracking-[.04em] text-neutral-500">
              {['Employee', 'Card', 'Spent this month', 'Status', ''].map((h) => <th key={h} className="text-start font-semibold px-5 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1EDE6]">
            {agents.map((a) => {
              const s = status(a)
              const pct = a.monthly_limit ? Math.min(100, Math.round((a.spent_this_period / a.monthly_limit) * 100)) : null
              return (
                <tr key={a.id} className="hover:bg-[#FAF8F4]">
                  <td className="px-5 py-3.5">
                    <Link to={`/employees/${a.id}`} className="flex items-center gap-3">
                      <span className="h-[38px] w-[38px] rounded-[10px] text-white font-semibold inline-flex items-center justify-center" style={{ background: TILE[Math.abs(a.id) % TILE.length] }}>{a.name.slice(0, 1).toUpperCase()}</span>
                      <span><span className="block font-semibold">{a.name}</span><span className="block text-[13px] text-neutral-500">{a.department_name}</span></span>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 tnum">{a.card ? `•••• ${a.card.last4}` : <span className="text-neutral-400">None</span>}</td>
                  <td className="px-5 py-3.5 min-w-[170px]">
                    <div className="font-semibold tnum">{sar(a.spent_this_period)}</div>
                    {pct !== null ? (
                      <div className="mt-1 flex items-center gap-2"><span className="h-[5px] w-24 rounded-full bg-[#EFEBE4] overflow-hidden"><span className="block h-full bg-brand" style={{ width: `${pct}%` }} /></span><span className="text-[12.5px] text-neutral-500 tnum">{pct}% of limit</span></div>
                    ) : <div className="text-[12.5px] text-neutral-400">No monthly limit</div>}
                  </td>
                  <td className={`px-5 py-3.5 font-semibold ${s.cls}`}>{s.text}</td>
                  <td className="px-5 py-3.5 text-end">
                    <Link to={`/employees/${a.id}`} className={s.primary ? 'btn-primary h-10 px-4 rounded-xl' : 'btn-secondary h-10 px-4 rounded-xl'}>{s.action}</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
export { dotColor }
