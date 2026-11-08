import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Camera, LogOut, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import { useToast } from '../lib/toast'
import { Modal } from './Modal'
import { Spinner } from './Spinner'
import { ErrorNote } from './ErrorNote'

export function initialsOf(name: string | undefined, email: string | undefined): string {
  const src = (name ?? '').trim() || (email ?? '').split('@')[0] || '?'
  const parts = src.split(/[\s._-]+/).filter(Boolean)
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2)).toUpperCase()
}

export function Avatar({ size = 36, className = '' }: { size?: number; className?: string }) {
  const { user } = useAuth()
  return user?.avatar ? (
    <img src={user.avatar} alt="" style={{ width: size, height: size }} className={`rounded-full object-cover shrink-0 ${className}`} />
  ) : (
    <span style={{ width: size, height: size, fontSize: size * 0.36 }} className={`rounded-full bg-brand text-white font-bold inline-flex items-center justify-center shrink-0 ${className}`}>
      {initialsOf(user?.full_name, user?.email)}
    </span>
  )
}

/** Shrinks a chosen photo to a 256px square JPEG so it stays well under the 150 KB limit. */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const ctx = c.getContext('2d')
      if (!ctx) return reject(new Error('Could not read the photo'))
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file is not a photo we can read'))
    }
    img.src = url
  })
}

/** Click your name: edit your name and photo, or sign out. Role and email are shown, not editable. */
export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const t = useT()
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<string | null | undefined>(undefined) // undefined = unchanged, null = removed
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(user?.full_name ?? '')
      setPhoto(undefined)
      setError(null)
    }
  }, [open, user?.full_name])

  const shown = photo === undefined ? user?.avatar : photo
  const dirty = name.trim() !== (user?.full_name ?? '') || photo !== undefined

  const choose = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    try {
      setPhoto(await shrink(f))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that photo')
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Name cannot be empty')
    setBusy(true)
    setError(null)
    try {
      await api.patch('/auth/me', {
        full_name: name.trim(),
        ...(photo === null ? { remove_avatar: true } : photo ? { avatar: photo } : {}),
      })
      await refresh()
      toast.success('Profile saved')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Your profile" size="sm">
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-4">
          {shown ? (
            <img src={shown} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span className="h-20 w-20 rounded-full bg-brand text-white text-2xl font-bold inline-flex items-center justify-center">{initialsOf(name, user?.email)}</span>
          )}
          <div className="flex flex-col gap-2">
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
            <button type="button" className="btn-secondary text-xs h-9" onClick={() => file.current?.click()}>
              <Camera className="h-4 w-4" /> {shown ? 'Change photo' : 'Add photo'}
            </button>
            {shown && (
              <button type="button" className="text-xs font-semibold text-neutral-500 hover:text-danger inline-flex items-center gap-1" onClick={() => setPhoto(null)}>
                <Trash2 className="h-3.5 w-3.5" /> Remove photo
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="pf-name">Name</label>
          <input id="pf-name" className="input h-11" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="label">Email</div>
            <div className="text-neutral-600 truncate" title={user?.email}>{user?.email}</div>
          </div>
          <div>
            <div className="label">Role</div>
            <div className="text-neutral-600">{user?.role ? t(`role.${user.role}`) : ''}</div>
          </div>
        </div>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy || !dirty}>
            {busy && <Spinner className="h-4 w-4" />} {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** The user row at the bottom of the sidebar: a button that opens the profile, plus sign out. */
export function UserRow({ onLogout }: { onLogout: () => void }) {
  const { user, company } = useAuth()
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2.5 flex-1 min-w-0 rounded-lg p-1.5 -m-1.5 text-start hover:bg-[#E4E0D7] transition-colors" aria-label="Edit your profile">
          <Avatar size={36} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold truncate">{user?.full_name || company?.name}</span>
            <span className="block text-[12px] text-neutral-500 truncate">{user?.role ? t(`role.${user.role}`) : user?.email}{user?.totp_enabled ? ' · 2FA on' : ''}</span>
          </span>
        </button>
        <button onClick={onLogout} className="btn-ghost p-2 shrink-0" aria-label={t('auth.signOut')} title={t('auth.signOut')}>
          <LogOut className="h-4 w-4 rtl-flip" />
        </button>
      </div>
      <ProfileModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
