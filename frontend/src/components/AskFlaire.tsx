import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { AssistantPanel } from './home/AssistantPanel'
import { useT } from '../lib/i18n'

/** Floating Ask Flaire: opens the assistant as a bottom sheet on phones and a side panel on desktop. */
export function AskFlaire() {
  const [open, setOpen] = useState(false)
  const t = useT()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Flaire"
          className="fixed z-40 end-4 md:end-7 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-7 inline-flex items-center gap-2 h-12 md:h-14 px-5 rounded-pill bg-brand text-white font-semibold shadow-[0_14px_34px_rgba(123,47,242,.45)] hover:bg-brand-dark transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          Ask Flaire
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Ask Flaire">
          <button type="button" aria-label={t('common.close')} className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 md:inset-x-auto md:end-0 md:top-0 md:w-[460px] max-h-[88vh] md:max-h-none h-[88vh] md:h-full bg-white rounded-t-[22px] md:rounded-none md:border-s border-line shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div>
                <div className="font-display text-xl font-bold tracking-tightest">Ask Flaire</div>
                <div className="text-xs text-neutral-500">Answers come from your own records.</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')} className="h-11 w-11 rounded-full border border-line-strong inline-flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5">
              <AssistantPanel onDecided={() => undefined} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
