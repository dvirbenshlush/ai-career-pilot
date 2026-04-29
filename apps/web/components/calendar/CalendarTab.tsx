'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Loader2, ChevronLeft, ChevronRight, Plus, Trash2,
  GraduationCap, ExternalLink, CalendarDays, Clock, MapPin, Download,
} from 'lucide-react'

interface Interview {
  id: string
  job_opportunity_id: string | null
  title: string
  company: string | null
  interview_date: string
  interview_time: string | null
  location: string | null
  notes: string | null
  created_at: string
  job?: { id: string; title: string; company: string | null; url: string | null } | null
}

interface SavedJobOption {
  id: string
  title: string
  company: string | null
}

const WEEKDAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const MONTHS_HE   = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function pad2(n: number) { return n.toString().padStart(2, '0') }

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDow   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (number | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(d)
  return grid
}

export function CalendarTab() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [interviews,   setInterviews]   = useState<Interview[]>([])
  const [loadingMonth, setLoadingMonth] = useState(true)

  // Add dialog
  const [addOpen,      setAddOpen]      = useState(false)
  const [addDate,      setAddDate]      = useState('')
  const [addTime,      setAddTime]      = useState('')
  const [addTitle,     setAddTitle]     = useState('')
  const [addCompany,   setAddCompany]   = useState('')
  const [addLocation,  setAddLocation]  = useState('')
  const [addNotes,     setAddNotes]     = useState('')
  const [addJobId,     setAddJobId]     = useState('')
  const [addMode,      setAddMode]      = useState<'job' | 'manual'>('job')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)
  const [savedJobs,    setSavedJobs]    = useState<SavedJobOption[]>([])
  const [jobsLoading,  setJobsLoading]  = useState(false)

  // Detail dialog
  const [detailOpen,       setDetailOpen]       = useState(false)
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null)

  // Prep dialog
  const [prepOpen,      setPrepOpen]      = useState(false)
  const [prepLoading,   setPrepLoading]   = useState(false)
  const [prepQuestions, setPrepQuestions] = useState<{ category: string; question: string }[]>([])
  const [prepError,     setPrepError]     = useState<string | null>(null)
  const [prepForId,     setPrepForId]     = useState<string | null>(null)

  // CV download
  const [cvLoading, setCvLoading] = useState(false)
  const [cvError,   setCvError]   = useState<string | null>(null)

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true)
    try {
      const res  = await fetch(`/api/interviews?year=${year}&month=${month + 1}`)
      const data = await res.json() as { interviews?: Interview[] }
      setInterviews(data.interviews ?? [])
    } finally {
      setLoadingMonth(false)
    }
  }, [year, month])

  useEffect(() => { loadMonth() }, [loadMonth])

  const loadJobs = async () => {
    if (savedJobs.length > 0) return
    setJobsLoading(true)
    try {
      const res  = await fetch('/api/jobs/saved')
      const data = await res.json() as { jobs?: SavedJobOption[] }
      setSavedJobs(data.jobs ?? [])
    } finally {
      setJobsLoading(false)
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  // ── Add dialog ───────────────────────────────────────────────────────────────

  const openAdd = (day?: number) => {
    const d = day
      ? `${year}-${pad2(month + 1)}-${pad2(day)}`
      : `${year}-${pad2(month + 1)}-${pad2(today.getDate())}`
    setAddDate(d)
    setAddTime('')
    setAddTitle('')
    setAddCompany('')
    setAddLocation('')
    setAddNotes('')
    setAddJobId('')
    setAddMode('job')
    setSaveError(null)
    setAddOpen(true)
    loadJobs()
  }

  const handleJobSelect = (jobId: string) => {
    setAddJobId(jobId)
    const job = savedJobs.find(j => j.id === jobId)
    if (job) {
      setAddTitle(job.title)
      setAddCompany(job.company ?? '')
    } else {
      setAddTitle('')
      setAddCompany('')
    }
  }

  const handleSave = async () => {
    if (!addDate || !addTitle.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const res  = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_opportunity_id: addJobId || null,
          title:          addTitle.trim(),
          company:        addCompany.trim() || null,
          interview_date: addDate,
          interview_time: addTime || null,
          location:       addLocation.trim() || null,
          notes:          addNotes.trim() || null,
        }),
      })
      const data = await res.json() as { interview?: Interview; error?: string }
      if (!res.ok || !data.interview) { setSaveError(data.error ?? 'שגיאה בשמירה'); return }
      setInterviews(prev => [...prev, data.interview!])
      setAddOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    await fetch(`/api/interviews/${id}`, { method: 'DELETE' })
    setInterviews(prev => prev.filter(i => i.id !== id))
    setDetailOpen(false)
  }

  // ── Download tailored CV ─────────────────────────────────────────────────────

  const downloadCv = async (iv: Interview) => {
    setCvLoading(true)
    setCvError(null)
    try {
      const res  = await fetch('/api/jobs/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle:       iv.title,
          company:        iv.company,
          jobDescription: iv.notes || iv.title,
          language:       'he',
        }),
      })
      const data = await res.json() as { pdfBase64?: string; tailoredText?: string; userName?: string; error?: string }

      if (!res.ok || (!data.pdfBase64 && !data.tailoredText)) {
        setCvError(data.error === 'noResume'
          ? 'לא נמצאו קורות חיים — העלה קורות חיים בעמוד Resume תחילה'
          : (data.error ?? 'שגיאה ביצירת קורות חיים'))
        return
      }

      if (data.pdfBase64) {
        const bytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0))
        const blob  = new Blob([bytes], { type: 'application/pdf' })
        const url   = URL.createObjectURL(blob)
        const a     = document.createElement('a')
        a.href      = url
        a.download  = data.userName ? `${data.userName} - קורות חיים.pdf` : 'קורות חיים.pdf'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } finally {
      setCvLoading(false)
    }
  }

  // ── Interview prep ───────────────────────────────────────────────────────────

  const openPrep = async (iv: Interview) => {
    setPrepOpen(true)
    if (prepForId === iv.id && prepQuestions.length > 0) return
    setPrepForId(iv.id)
    setPrepLoading(true)
    setPrepError(null)
    setPrepQuestions([])
    try {
      const res  = await fetch('/api/jobs/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle: iv.title, company: iv.company, snippet: iv.notes }),
      })
      const data = await res.json() as { questions?: { category: string; question: string }[]; error?: string }
      if (!res.ok || !data.questions) { setPrepError(data.error ?? 'שגיאה'); return }
      setPrepQuestions(data.questions)
    } catch {
      setPrepError('שגיאת רשת — נסה שוב')
    } finally {
      setPrepLoading(false)
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const grid   = getMonthGrid(year, month)
  const byDay  = interviews.reduce<Record<number, Interview[]>>((acc, iv) => {
    const d = new Date(iv.interview_date + 'T00:00:00').getDate()
    ;(acc[d] ??= []).push(iv)
    return acc
  }, {})
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  const CAT_COLORS: Record<string, string> = {
    'טכני':       'text-blue-700 bg-blue-50 border-blue-200',
    'התנהגותי':   'text-purple-700 bg-purple-50 border-purple-200',
    'חברה':       'text-emerald-700 bg-emerald-50 border-emerald-200',
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="חודש קודם"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {MONTHS_HE[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="חודש הבא"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <Button size="sm" variant="outline" onClick={goToday}>היום</Button>
          )}
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="h-4 w-4 mr-1" /> הוסף ראיון
          </Button>
        </div>
      </div>

      {/* ── Calendar grid ── */}
      {loadingMonth ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden select-none">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-muted/30 border-b">
            {WEEKDAYS_HE.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {grid.map((day, i) => {
              const isLastCol      = (i + 1) % 7 === 0
              const dateStr        = day ? `${year}-${pad2(month + 1)}-${pad2(day)}` : ''
              const isToday        = dateStr === todayStr
              const dayInterviews  = day ? (byDay[day] ?? []) : []
              const showMax        = 3
              const overflow       = dayInterviews.length - showMax

              return (
                <div
                  key={i}
                  onClick={() => day && openAdd(day)}
                  className={[
                    'min-h-[90px] sm:min-h-[100px] p-1 border-b border-r transition-colors',
                    isLastCol    ? 'border-r-0' : '',
                    day          ? 'cursor-pointer hover:bg-muted/30' : 'bg-muted/10 pointer-events-none',
                  ].join(' ')}
                >
                  {day && (
                    <>
                      <span className={[
                        'inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full',
                        isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                      ].join(' ')}>
                        {day}
                      </span>

                      <div className="mt-0.5 space-y-0.5">
                        {dayInterviews.slice(0, showMax).map(iv => (
                          <button
                            key={iv.id}
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedInterview(iv)
                              setDetailOpen(true)
                            }}
                            className="w-full text-right text-xs bg-indigo-100 text-indigo-800 rounded px-1.5 py-0.5 truncate hover:bg-indigo-200 transition-colors"
                            title={`${iv.title}${iv.company ? ` — ${iv.company}` : ''}${iv.interview_time ? ` ${iv.interview_time.slice(0, 5)}` : ''}`}
                          >
                            {iv.interview_time && (
                              <span className="font-semibold ml-0.5">{iv.interview_time.slice(0, 5)} </span>
                            )}
                            {iv.title}
                          </button>
                        ))}
                        {overflow > 0 && (
                          <p className="text-xs text-muted-foreground px-1.5">+{overflow} נוספים</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {interviews.length === 0 && !loadingMonth && (
        <p className="text-center text-sm text-muted-foreground py-4">
          אין ראיונות מתוכננים לחודש זה. לחץ על יום בלוח השנה או על &quot;הוסף ראיון&quot;.
        </p>
      )}

      {/* ── Add dialog ── */}
      <Dialog open={addOpen} onOpenChange={o => { if (!saving) setAddOpen(o) }}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הוסף ראיון ללוח השנה</DialogTitle>
            <DialogDescription>ניתן לחבר את הראיון למשרה שמורה או להזין פרטים ידנית</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {/* Mode toggle */}
            <div className="flex gap-2">
              {(['job', 'manual'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setAddMode(m); if (m === 'manual') { setAddJobId(''); setAddTitle(''); setAddCompany('') } }}
                  className={[
                    'flex-1 py-2 px-3 text-sm rounded-md border transition-colors',
                    addMode === m
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-medium'
                      : 'bg-muted border-border text-muted-foreground hover:bg-muted/70',
                  ].join(' ')}
                >
                  {m === 'job' ? '📌 מהמשרות שלי' : '✏️ ידני'}
                </button>
              ))}
            </div>

            {/* Job picker */}
            {addMode === 'job' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">משרה</label>
                {jobsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען...
                  </div>
                ) : (
                  <select
                    value={addJobId}
                    onChange={e => handleJobSelect(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">בחר משרה...</option>
                    {savedJobs.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.title}{j.company ? ` — ${j.company}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Title / company */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">תפקיד *</label>
                <Input
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                  placeholder="מפתח Backend..."
                  readOnly={addMode === 'job' && !!addJobId}
                  className={addMode === 'job' && addJobId ? 'bg-muted/40' : ''}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">חברה</label>
                <Input
                  value={addCompany}
                  onChange={e => setAddCompany(e.target.value)}
                  placeholder="Google..."
                  readOnly={addMode === 'job' && !!addJobId}
                  className={addMode === 'job' && addJobId ? 'bg-muted/40' : ''}
                />
              </div>
            </div>

            {/* Date / time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">תאריך *</label>
                <Input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">שעה</label>
                <Input type="time" value={addTime} onChange={e => setAddTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">מיקום</label>
              <Input value={addLocation} onChange={e => setAddLocation(e.target.value)} placeholder="Zoom / כתובת..." />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">הערות</label>
              <Textarea
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                placeholder="פרטים נוספים..."
                className="min-h-[60px] resize-none text-sm"
              />
            </div>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}

            <Button
              className="w-full"
              disabled={saving || !addDate || !addTitle.trim()}
              onClick={handleSave}
            >
              {saving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> שומר...</>
                : <><CalendarDays className="h-4 w-4 mr-2" /> הוסף ללוח השנה</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail dialog ── */}
      {selectedInterview && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent showCloseButton className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-600" />
                {selectedInterview.title}
              </DialogTitle>
              {selectedInterview.company && (
                <DialogDescription>{selectedInterview.company}</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-3 pt-1">
              {/* Date / time */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  {new Date(selectedInterview.interview_date + 'T00:00:00').toLocaleDateString('he-IL', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
                {selectedInterview.interview_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 shrink-0" />
                    {selectedInterview.interview_time.slice(0, 5)}
                  </span>
                )}
              </div>

              {/* Location */}
              {selectedInterview.location && (
                <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  {selectedInterview.location}
                </p>
              )}

              {/* Notes */}
              {selectedInterview.notes && (
                <div
                  className="bg-muted/40 rounded-md p-3 text-sm text-muted-foreground whitespace-pre-wrap"
                  dir="rtl"
                >
                  {selectedInterview.notes}
                </div>
              )}

              {/* Actions for job-linked interviews */}
              {selectedInterview.job_opportunity_id && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">פעולות</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                      onClick={() => openPrep(selectedInterview)}
                    >
                      <GraduationCap className="h-3.5 w-3.5 mr-1" /> הכנה לראיון
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      disabled={cvLoading}
                      onClick={() => downloadCv(selectedInterview)}
                    >
                      {cvLoading
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> מייצר...</>
                        : <><Download className="h-3.5 w-3.5 mr-1" /> קו&quot;ח מותאם PDF</>
                      }
                    </Button>
                    {selectedInterview.job?.url && (
                      <a href={selectedInterview.job.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> מודעת המשרה
                        </Button>
                      </a>
                    )}
                  </div>
                  {cvError && <p className="text-xs text-destructive">{cvError}</p>}
                </div>
              )}

              {/* Delete */}
              <div className="flex justify-end pt-1 border-t">
                <button
                  onClick={() => handleDelete(selectedInterview.id)}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors mt-2"
                >
                  <Trash2 className="h-3.5 w-3.5" /> מחק ראיון
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Interview prep dialog ── */}
      <Dialog open={prepOpen} onOpenChange={setPrepOpen}>
        <DialogContent showCloseButton className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
              הכנה לראיון — {selectedInterview?.title}
            </DialogTitle>
            {selectedInterview?.company && (
              <DialogDescription>{selectedInterview.company}</DialogDescription>
            )}
          </DialogHeader>

          {prepLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> מכין שאלות מותאמות...
            </div>
          )}

          {prepError && (
            <p className="text-sm text-destructive py-4 text-center">{prepError}</p>
          )}

          {!prepLoading && !prepError && prepQuestions.length > 0 && (
            <div className="space-y-3 pt-1">
              {prepQuestions.map((q, idx) => (
                <div key={idx} className="border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${CAT_COLORS[q.category] ?? 'text-gray-700 bg-gray-50 border-gray-200'}`}>
                      {q.category}
                    </span>
                    <p className="text-sm font-medium leading-snug">{q.question}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
