import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { api } from '../lib/api'
import { useFetch } from '../lib/useFetch'
import { useT } from '../lib/i18n'
import { normalizeConnectorInfo } from '../lib/onboarding'
import type { ConnectorDetails } from '../lib/onboarding'
import { ErrorNote } from './ErrorNote'
import { Spinner } from './Spinner'

export type AiClient = 'claude' | 'chatgpt'

/** Loads GET /connector-info with translated fallbacks for fields an older backend does not return. */
export function useConnectorDetails() {
  const t = useT()
  return useFetch<ConnectorDetails>(
    () =>
      api.get('/connector-info').then((r) =>
        normalizeConnectorInfo(r.data, {
          claude: [t('connect.claude1'), t('connect.claude2'), t('connect.claude3'), t('connect.claude4'), t('connect.claude5'), t('connect.claude6'), t('connect.claude7')],
          chatgpt: [t('connect.gpt1'), t('connect.gpt2'), t('connect.gpt3'), t('connect.gpt4'), t('connect.gpt5'), t('connect.gpt6'), t('connect.gpt7')],
          instructions: t('connect.defaultInstructions'),
        }),
      ),
    [],
  )
}

type Step = { text: string; copy?: { label: string; value: string }; link?: { label: string; href: string } }

function CopyChip({ label, value }: { label: string; value: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      dir="ltr"
      className="mt-2 w-full flex items-center justify-between gap-3 rounded-input border border-line-strong bg-lavender px-3.5 py-2.5 text-start hover:border-brand transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
        <span className="block truncate font-mono text-[13px] text-ink">{value}</span>
      </span>
      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-bold ${copied ? 'bg-success text-white' : 'bg-brand text-white'}`}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? t('common.copied') : t('common.copy')}
      </span>
    </button>
  )
}

function Guide({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3.5 rounded-card border border-line bg-white p-4">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white text-sm font-bold tnum">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] leading-snug text-ink font-medium pt-1">{s.text}</div>
            {s.link && (
              <a href={s.link.href} target="_blank" rel="noreferrer" className="btn-primary mt-3 inline-flex">
                {s.link.label} <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {s.copy && <CopyChip label={s.copy.label} value={s.copy.value} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * "Connect your AI": the easiest possible guide. Pick ChatGPT or Claude, then follow big numbered steps with
 * one-tap copy for the name and the address and a button that opens the right page. Shared by setup and Connections.
 */
export function ConnectAiPanel({ className = '' }: { className?: string }) {
  const t = useT()
  const info = useConnectorDetails()
  const [tab, setTab] = useState<AiClient>('chatgpt')

  if (info.loading && !info.data) {
    return (
      <div className={`flex items-center gap-2 text-sm text-neutral-500 py-2 ${className}`}>
        <Spinner /> {t('settings.loadingConnector')}
      </div>
    )
  }
  if (info.error && !info.data) return <ErrorNote message={info.error} className={className} />
  const d = info.data
  if (!d) return null

  const name = { label: t('guide.nameLabel'), value: 'Flaire' }
  const url = { label: t('guide.urlLabel'), value: d.mcp_url }
  const gpt: Step[] = [
    { text: t('guide.gpt1'), link: { label: t('guide.openChatgpt'), href: 'https://chatgpt.com/plugins' } },
    { text: t('guide.gpt2') },
    { text: t('guide.gpt3'), copy: name },
    { text: t('guide.gpt4'), copy: url },
    { text: t('guide.gpt5') },
    { text: t('guide.gpt6') },
  ]
  const claude: Step[] = [
    { text: t('guide.cl1'), link: { label: t('guide.openClaude'), href: 'https://claude.ai/customize/connectors' } },
    { text: t('guide.cl2') },
    { text: t('guide.cl3'), copy: name },
    { text: t('guide.cl4'), copy: url },
    { text: t('guide.cl5') },
    { text: t('guide.cl6') },
  ]

  const tabBtn = (value: AiClient, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      className={`flex-1 rounded-pill px-4 py-2.5 text-[15px] font-semibold transition-colors ${tab === value ? 'bg-white text-brand shadow-card' : 'text-neutral-600 hover:text-ink'}`}
    >
      {label}
    </button>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      <p className="text-sm text-neutral-600">{t('guide.intro')}</p>
      <div role="tablist" className="flex rounded-pill border border-line bg-lavender p-1">
        {tabBtn('chatgpt', 'ChatGPT')}
        {tabBtn('claude', 'Claude')}
      </div>
      <Guide steps={tab === 'chatgpt' ? gpt : claude} />
      <p className="text-xs text-neutral-500">{t('guide.stuck')}</p>
    </div>
  )
}
