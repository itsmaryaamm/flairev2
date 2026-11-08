import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, MessageCircle, Search } from 'lucide-react'

const ITEMS: { label: string; to?: string; ask?: boolean }[] = [
  { label: 'Overview', to: '/' },
  { label: 'AI workforce', to: '/employees' },
  { label: 'Spending', to: '/spending' },
  { label: 'Approvals', to: '/approvals' },
  { label: 'Finance', to: '/finance' },
  { label: 'Connections', to: '/connections' },
  { label: 'Controls: budgets and limits', to: '/controls#budgets' },
  { label: 'Controls: approval rules', to: '/controls#rules' },
  { label: 'Controls: trusted suppliers', to: '/controls#suppliers' },
  { label: 'Controls: security and kill switch', to: '/controls#security' },
  { label: 'Controls: people and roles', to: '/controls#people' },
  { label: 'Controls: policy history', to: '/controls#history' },
  { label: 'Ask Flaire a question', ask: true },
]

/** ⌘K / Ctrl+K: jump anywhere, or open Ask Flaire. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const list = ITEMS.filter((x) => x.label.toLowerCase().includes(q.trim().toLowerCase()))

  useEffect(() => {
    if (open) {
      setQ('')
      setI(0)
      window.setTimeout(() => input.current?.focus(), 20)
    }
  }, [open])
  useEffect(() => setI(0), [q])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const go = (x?: (typeof ITEMS)[number]) => {
    if (!x) return
    onClose()
    if (x.ask) window.dispatchEvent(new Event('flaire:ask'))
    else if (x.to) navigate(x.to)
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh] px-4" role="dialog" aria-modal="true" aria-label="Jump to">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="relative w-full max-w-[560px] rounded-2xl bg-white shadow-2xl border border-line overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          <Search className="h-4 w-4 text-neutral-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(v + 1, list.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(v - 1, 0)) }
              if (e.key === 'Enter') go(list[i])
            }}
            placeholder="Jump to a page or ask Flaire"
            className="flex-1 bg-transparent outline-none text-[15px]"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-500">Nothing matches. Try Ask Flaire.</li>}
          {list.map((x, n) => (
            <li key={x.label}>
              <button type="button" onMouseEnter={() => setI(n)} onClick={() => go(x)} className={`w-full flex items-center gap-3 rounded-lg px-3 h-11 text-[15px] text-start ${n === i ? 'bg-[#F1E6FD] text-[#5B2A9E]' : ''}`}>
                {x.ask ? <MessageCircle className="h-4 w-4" /> : <span className="w-4" />}
                <span className="flex-1">{x.label}</span>
                {n === i && <CornerDownLeft className="h-4 w-4 opacity-60" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
