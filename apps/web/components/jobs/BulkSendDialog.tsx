'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, Send, CheckSquare, Square, Clock, CalendarDays, Inbox, X } from 'lucide-react'

interface JobRow {
  id:                 string
  title:              string
  company:            string | null
  contact_email:      string
  snippet:            string | null
  application_status: string | null
}

type Gender = 'male' | 'female'

function getStoredGender(): Gender | null {
  try { return localStorage.getItem('userGender') as Gender | null } catch { return null }
}

function pad2(n: number) { return n.toString().padStart(2, '0') }

function localDatetimeDefault(): string {
  const d  = new Date()
  d.setMinutes(d.getMinutes() + 60)  // default: 1 hour from now
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function BulkSendDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [jobs,         setJobs]         = useState<JobRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [scheduledAt,  setScheduledAt]  = useState(localDatetimeDefault())
  const [lang,         setLang]         = useState<'he' | 'en'>('he')
  const [gender,       setGender]       = useState<Gender>('male')
  const [genderPicker, setGenderPicker] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)

  // Pending scheduled sends
  const [pendingSends,        setPendingSends]        = useState<{id:string;job_title:string;company:string|null;contact_email:string;scheduled_at:string;status:string;error:string|null}[]>([])
  const [loadingPending,      setLoadingPending]      = useState(false)
  const [cancellingId,        setCancellingId]        = useState<string | null>(null)
  const [showPending,         setShowPending]         = useState(false)

  useEffect(() => {
    if (!open) return
    const g = getStoredGender()
    if (g) { setGender(g); setGenderPicker(false) }
    else setGenderPicker(true)
    setSaved(false)
    setSaveError(null)
    setSelected(new Set())
    setScheduledAt(localDatetimeDefault())
    loadJobs()
    loadPending()
  }, [open])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/jobs/saved')
      const data = await res.json() as { jobs?: JobRow[] }
      // Jobs with an email that are not yet applied/offer
      const eligible = (data.jobs ?? []).filter(j => {
        const email = extractEmail(j)
        if (!email) return false
        const s = j.application_status
        return s !== 'applied' && s !== 'offer'
      })
      setJobs(eligible)
    } finally {
      setLoading(false)
    }
  }

  const loadPending = async () => {
    setLoadingPending(true)
    try {
      const res  = await fetch('/api/jobs/schedule-send')
      const data = await res.json() as { sends?: typeof pendingSends }
      setPendingSends(data.sends ?? [])
    } finally {
      setLoadingPending(false)
    }
  }

  const extractEmail = (j: JobRow): string | null => {
    if (j.contact_email) return j.contact_email
    return null
  }

  const allSelected = jobs.length > 0 && selected.size === jobs.length

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(jobs.map(j => j.id)))
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const pickGender = (g: Gender) => {
    try { localStorage.setItem('userGender', g) } catch { /* ignore */ }
    setGender(g)
    setGenderPicker(false)
  }

  const handleSchedule = async () => {
    if (selected.size === 0) return
    const scheduledUtc = new Date(scheduledAt).toISOString()
    setSaving(true)
    setSaveError(null)
    try {
      const sends = jobs
        .filter(j => selected.has(j.id))
        .map(j => ({
          jobId:        j.id,
          jobTitle:     j.title,
          company:      j.company,
          contactEmail: extractEmail(j)!,
          snippet:      j.snippet,
        }))

      const res  = await fetch('/api/jobs/schedule-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sends, scheduledAt: scheduledUtc, language: lang, gender }),
      })
      const data = await res.json() as { count?: number; error?: string }
      if (!res.ok) { setSaveError(data.error ?? 'שגיאה'); return }
      setSaved(true)
      setSelected(new Set())
      loadPending()
    } finally {
      setSaving(false)
    }
  }

  const cancelSend = async (id: string) => {
    setCancellingId(id)
    try {
      await fetch('/api/jobs/schedule-send', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setPendingSends(prev => prev.filter(s => s.id !== id))
    } finally {
      setCancellingId(null)
    }
  }

  const pendingCount = pendingSends.filter(s => s.status === 'pending').length

  return (
    <Dialog open={open} onOpenChange={o => { if (!saving) onClose(); if (!o) onClose() }}>
      <DialogContent showCloseButton className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-600" />
            שליחת קו&quot;ח מרובה
          </DialogTitle>
          <DialogDescription>
            בחר משרות עם מייל שעדיין לא הוגשו ותזמן שליחה אוטומטית
          </DialogDescription>
        </DialogHeader>

        {/* Gender picker */}
        {genderPicker && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-medium">בחר מין לניסוח מכתב הכיסוי</p>
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={() => pickGender('male')}>👨 זכר</Button>
              <Button className="flex-1" size="sm" variant="outline" onClick={() => pickGender('female')}>👩 נקבה</Button>
            </div>
          </div>
        )}

        {!genderPicker && (
          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">

            {/* Settings row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Language */}
              <div className="flex gap-1">
                {(['he', 'en'] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${lang === l ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-medium' : 'bg-muted border-border text-muted-foreground hover:bg-muted/70'}`}
                  >{l === 'he' ? 'עברית' : 'English'}</button>
                ))}
              </div>
              {/* Gender quick switch */}
              <div className="flex gap-1">
                {(['male', 'female'] as const).map(g => (
                  <button key={g} onClick={() => pickGender(g)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${gender === g ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-medium' : 'bg-muted border-border text-muted-foreground hover:bg-muted/70'}`}
                  >{g === 'male' ? '👨 זכר' : '👩 נקבה'}</button>
                ))}
              </div>
              {/* Datetime picker */}
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Job list */}
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
                אין משרות עם מייל שעדיין לא הוגשו
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
                  <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
                    {allSelected
                      ? <CheckSquare className="h-4 w-4 text-indigo-600" />
                      : <Square className="h-4 w-4" />
                    }
                  </button>
                  <span className="text-xs font-medium text-muted-foreground">
                    {selected.size > 0 ? `${selected.size} נבחרו מתוך ${jobs.length}` : `${jobs.length} משרות זמינות`}
                  </span>
                </div>
                {/* Rows */}
                <div className="divide-y max-h-64 overflow-y-auto">
                  {jobs.map(j => {
                    const email = extractEmail(j)!
                    const isSelected = selected.has(j.id)
                    return (
                      <div
                        key={j.id}
                        onClick={() => toggle(j.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${isSelected ? 'bg-indigo-50/60' : ''}`}
                      >
                        <span className="shrink-0 text-muted-foreground">
                          {isSelected
                            ? <CheckSquare className="h-4 w-4 text-indigo-600" />
                            : <Square className="h-4 w-4" />
                          }
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{j.title}</p>
                          {j.company && <p className="text-xs text-muted-foreground truncate">{j.company}</p>}
                        </div>
                        <span className="text-xs text-blue-600 shrink-0 max-w-[150px] truncate">{email}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}

            {saved && (
              <p className="text-sm text-green-700 font-medium flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {`תוזמנה שליחה ל-${selected.size || ''} משרות בשעה ${new Date(scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            )}

            {/* Schedule button */}
            <Button
              className="w-full"
              disabled={saving || selected.size === 0 || !scheduledAt}
              onClick={handleSchedule}
            >
              {saving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> מתזמן...</>
                : <><Clock className="h-4 w-4 mr-2" /> תזמן שליחה ל-{selected.size} משרות</>
              }
            </Button>

            {/* Pending sends */}
            {(pendingSends.length > 0 || loadingPending) && (
              <div className="border-t pt-3 space-y-2">
                <button
                  onClick={() => setShowPending(p => !p)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Clock className="h-3.5 w-3.5" />
                  שליחות מתוזמנות ({pendingCount} ממתינות)
                  <span className="ml-1">{showPending ? '▲' : '▼'}</span>
                </button>

                {showPending && (
                  <div className="space-y-1.5">
                    {pendingSends.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-xs rounded-md border px-2.5 py-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'sent' ? 'bg-green-500' : s.status === 'failed' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                        <span className="flex-1 truncate font-medium">{s.job_title}{s.company ? ` — ${s.company}` : ''}</span>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(s.scheduled_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {s.status === 'pending' && (
                          <button
                            onClick={() => cancelSend(s.id)}
                            disabled={cancellingId === s.id}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                            title="בטל"
                          >
                            {cancellingId === s.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <X className="h-3 w-3" />
                            }
                          </button>
                        )}
                        {s.status === 'failed' && s.error && (
                          <span className="text-destructive truncate max-w-[100px]" title={s.error}>שגיאה</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
