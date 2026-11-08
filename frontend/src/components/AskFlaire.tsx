import { useEffect, useState } from 'react'
import { ArrowUp, MessageCircle, X } from 'lucide-react'
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
        <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Flaire"
          className="md:hidden fixed z-40 inset-x-3 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] h-14 ps-5 pe-2 rounded-full bg-white border border-line-strong flex items-center text-start shadow-[0_6px_20px_rgba(22,17,43,.08)]"
        >
          <span className="flex-1 text-neutral-500 text-[16px]">{t('phone.askAnything')}</span>
          <span className="h-10 w-10 rounded-full bg-brand inline-flex items-center justify-center"><ArrowUp className="h-5 w-5 text-white" /></span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Flaire"
          className="hidden md:inline-flex fixed z-40 end-7 bottom-7 items-center gap-2 h-12 px-4 rounded-full bg-ink text-white text-sm font-semibold shadow-[0_8px_24px_rgba(22,17,43,.28)] hover:bg-brand transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          Ask Flaire
        </button>
        </>
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
