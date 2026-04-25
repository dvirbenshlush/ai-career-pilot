'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Loader2, ExternalLink, MapPin, DollarSign, Wifi, Sparkles,
  Trash2, Search, RefreshCw, Building2, ChevronDown, ChevronUp,
  Briefcase, Mail, Phone, Send, User, GraduationCap, CheckCircle2, Circle,
} from 'lucide-react'

type AppStatus = 'applied' | 'interviewing' | 'offer' | 'rejected'

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string; dot: string }> = {
  applied:      { label: 'Applied',      color: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-500' },
  interviewing: { label: 'Interviewing', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  offer:        { label: 'Offer',        color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  rejected:     { label: 'Rejected',     color: 'bg-red-100 text-red-700 border-red-200',      dot: 'bg-red-500' },
}

interface InterviewQuestion { category: 'טכני' | 'התנהגותי' | 'חברה'; question: string }
interface AnswerFeedback { score: number; analysis: string; improvements: string[] }

type Gender = 'male' | 'female'

function getStoredGender(): Gender | null {
  try { return localStorage.getItem('userGender') as Gender | null } catch { return null }
}

interface SavedJob {
  id: string
  title: string
  company: string
  location: string
  salary_range: string | null
  remote: boolean
  url: string
  match_score: number
  tags: string[]
  source: 'linkedin' | 'search' | 'whatsapp' | 'telegram' | string
  source_name: string | null
  snippet: string | null
  why_match: string | null
  experience_required: string | null
  contact: string | null
  raw_message: string | null
  poster_name: string | null
  found_at: string
  application_id: string | null
  application_status: AppStatus | null
}

// ── Source badge ──────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

const SOURCE_CONFIG: Record<string, { label: string; className: string; Icon: React.FC<{ className?: string }> | null }> = {
  linkedin: { label: 'LinkedIn', className: 'text-blue-700 bg-blue-50 border-blue-200', Icon: LinkedInIcon },
  whatsapp: { label: 'WhatsApp', className: 'text-green-700 bg-green-50 border-green-200', Icon: WhatsAppIcon },
  telegram: { label: 'Telegram', className: 'text-sky-700 bg-sky-50 border-sky-200', Icon: TelegramIcon },
  search: { label: 'חיפוש', className: 'text-purple-700 bg-purple-50 border-purple-200', Icon: null },
}

function SourceBadge({ source, sourceName }: { source: string; sourceName?: string | null }) {
  const cfg = SOURCE_CONFIG[source] ?? { label: source, className: 'text-gray-600 bg-gray-50 border-gray-200', Icon: null }
  const label = sourceName ? `${cfg.label} · ${sourceName}` : cfg.label
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.className}`}>
      {cfg.Icon && <cfg.Icon className="h-3 w-3" />}
      {label}
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}% התאמה</span>
}

function ContactChip({ contact }: { contact: string }) {
  const isEmail = contact.includes('@')
  const isPhone = /^[\d\s\+\-\(\)]{7,}$/.test(contact.trim())
  const isUrl = contact.startsWith('http')

  if (isEmail) return (
    <a href={`mailto:${contact}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
      <Mail className="h-3 w-3 shrink-0" />{contact}
    </a>
  )
  if (isUrl) return (
    <a href={contact} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate max-w-xs">
      <ExternalLink className="h-3 w-3 shrink-0" />{contact}
    </a>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Phone className="h-3 w-3 shrink-0" />{contact}
    </span>
  )
}

function StatusPicker({
  jobId, applicationId, currentStatus, onChange,
}: {
  jobId: string
  applicationId: string | null
  currentStatus: AppStatus | null
  onChange: (status: AppStatus, newAppId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const select = async (status: AppStatus) => {
    setOpen(false)
    setLoading(true)
    try {
      if (applicationId) {
        await fetch(`/api/applications/${applicationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        onChange(status, applicationId)
      } else {
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_opportunity_id: jobId, status }),
        })
        const data = await res.json() as { application?: { id: string } }
        onChange(status, data.application?.id ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  const cfg = currentStatus ? STATUS_CONFIG[currentStatus] : null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border transition-colors ${
          cfg ? cfg.color : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'
        }`}
      >
        {loading
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <span className={`h-2 w-2 rounded-full shrink-0 ${cfg ? cfg.dot : 'bg-muted-foreground/40'}`} />
        }
        {cfg ? cfg.label : 'הגדר סטטוס'}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-[140px]">
          {(Object.entries(STATUS_CONFIG) as [AppStatus, typeof STATUS_CONFIG[AppStatus]][]).map(([s, c]) => (
            <button
              key={s}
              onClick={() => select(s)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors ${s === currentStatus ? 'font-semibold' : ''}`}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
              {c.label}
              {s === currentStatus && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SavedJobCard({ job, onDelete, onStatusChange }: {
  job: SavedJob
  onDelete: (id: string) => void
  onStatusChange: (jobId: string, status: AppStatus, appId: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [genderPicker, setGenderPicker] = useState(false)
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([])
  const [interviewError, setInterviewError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [feedback, setFeedback] = useState<Record<number, AnswerFeedback & { loading?: boolean }>>({})

  const setAnswer = (idx: number, val: string) => setAnswers(p => ({ ...p, [idx]: val }))

  const checkAnswer = async (idx: number) => {
    const q = interviewQuestions[idx]
    const answer = answers[idx]?.trim()
    if (!answer) return
    setFeedback(p => ({ ...p, [idx]: { ...p[idx], loading: true, score: 0, analysis: '', improvements: [] } }))
    try {
      const res = await fetch('/api/jobs/interview-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.question,
          answer,
          jobTitle: job.title,
          company: job.company,
          category: q.category,
        }),
      })
      const data = await res.json() as { feedback?: AnswerFeedback; error?: string }
      if (!res.ok || !data.feedback) {
        setFeedback(p => ({ ...p, [idx]: { loading: false, score: 0, analysis: data.error ?? 'שגיאה', improvements: [] } }))
        return
      }
      setFeedback(p => ({ ...p, [idx]: { ...data.feedback!, loading: false } }))
    } catch {
      setFeedback(p => ({ ...p, [idx]: { loading: false, score: 0, analysis: 'שגיאת רשת', improvements: [] } }))
    }
  }

  const contactEmail = job.contact?.includes('@') ? job.contact.trim() : null

  const doSend = async (gender: Gender) => {
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/jobs/send-cv-gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          contactEmail,
          snippet: job.snippet,
          experienceRequired: job.experience_required,
          gender,
        }),
      })
      const data = await res.json() as { ok?: boolean; gmailUrl?: string; needsAuth?: boolean; error?: string }

      if (!res.ok || !data.ok) {
        setSendError(data.error ?? 'שגיאה בהכנת המייל')
        return
      }
      window.open(data.gmailUrl, '_blank')
    } catch {
      setSendError('שגיאת רשת — נסה שוב')
    } finally {
      setSending(false)
    }
  }

  const startSendFlow = async (gender: Gender) => {
    if (!contactEmail) return
    setSendError(null)

    const statusRes = await fetch('/api/gmail/status')
    const status = await statusRes.json() as { connected: boolean }

    if (!status.connected) {
      const popup = window.open(
        '/api/gmail/auth?returnTo=/jobs',
        'gmail-auth',
        'width=520,height=620,left=200,top=100'
      )
      if (!popup) {
        setSendError('חסום popup — אפשר פופ-אפים לאתר זה')
        return
      }

      setSending(true)
      await new Promise<void>((resolve, reject) => {
        const done = (err?: Error) => {
          clearInterval(poll)
          clearTimeout(timeout)
          err ? reject(err) : resolve()
        }

        const timeout = setTimeout(() => done(new Error('פג זמן ההמתנה להתחברות')), 60_000)

        const poll = setInterval(async () => {
          try {
            const r = await fetch('/api/gmail/status')
            const s = await r.json() as { connected: boolean }
            if (s.connected) { done(); return }
          } catch { /* ignore transient network errors */ }

          let isClosed = false
          try { isClosed = popup.closed } catch { /* COOP — keep polling */ }
          if (isClosed) {
            await new Promise(r => setTimeout(r, 1200))
            try {
              const r = await fetch('/api/gmail/status')
              const s = await r.json() as { connected: boolean }
              if (s.connected) { done(); return }
            } catch { /* ignore */ }
            done(new Error('חלון ההתחברות נסגר ללא אימות'))
          }
        }, 1000)
      }).catch(err => {
        setSendError(err.message)
        setSending(false)
        throw err
      })
    }

    await doSend(gender)
  }

  const handleSendCv = () => {
    if (!contactEmail) return
    const gender = getStoredGender()
    if (!gender) { setGenderPicker(true); return }
    startSendFlow(gender)
  }

  const pickGender = (gender: Gender) => {
    try { localStorage.setItem('userGender', gender) } catch { /* ignore */ }
    setGenderPicker(false)
    startSendFlow(gender)
  }

  const openInterview = async () => {
    setInterviewOpen(true)
    if (interviewQuestions.length > 0) return // cached
    setInterviewLoading(true)
    setInterviewError(null)
    try {
      const res = await fetch('/api/jobs/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          snippet: job.snippet,
          experienceRequired: job.experience_required,
          tags: job.tags,
        }),
      })
      const data = await res.json() as { questions?: InterviewQuestion[]; error?: string }
      if (!res.ok || !data.questions) { setInterviewError(data.error ?? 'שגיאה בטעינת שאלות'); return }
      setInterviewQuestions(data.questions)
    } catch {
      setInterviewError('שגיאת רשת — נסה שוב')
    } finally {
      setInterviewLoading(false)
    }
  }

  const handleDelete = async () => {

    setDeleting(true)
    try {
      await fetch('/api/jobs/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id }),
      })
      onDelete(job.id)
    } finally {
      setDeleting(false)
    }
  }

  const date = new Date(job.found_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
  const fullText = job.raw_message || job.snippet || ''
  const hasFullText = fullText.length > 150

  return (
    <>
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">

            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-sm">{job.title}</h3>
              <ScoreBadge score={Math.round(job.match_score)} />
              <SourceBadge source={job.source} sourceName={job.source_name} />
              {job.remote && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Wifi className="h-3 w-3" /> Remote
                </span>
              )}
              <StatusPicker
                jobId={job.id}
                applicationId={job.application_id}
                currentStatus={job.application_status}
                onChange={(status, appId) => onStatusChange(job.id, status, appId)}
              />
            </div>

            {/* Company & meta */}
            {job.company && (
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 shrink-0" /> {job.company}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
              {job.salary_range && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{job.salary_range}</span>}
              <span className="text-muted-foreground/50">{date}</span>
            </div>

            {/* Poster */}
            {job.poster_name && (
              <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                <User className="h-3 w-3 shrink-0" /> פורסם על ידי {job.poster_name}
              </p>
            )}

            {/* AI summary */}
            {job.snippet && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{job.snippet}</p>
            )}

            {/* Experience required */}
            {job.experience_required && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1.5 flex items-start gap-1">
                <Briefcase className="h-3 w-3 mt-0.5 shrink-0" />{job.experience_required}
              </p>
            )}

            {/* Why match */}
            {job.why_match && (
              <p className="text-xs text-indigo-600 mt-1.5 flex items-start gap-1">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />{job.why_match}
              </p>
            )}

            {/* Contact */}
            {job.contact && (
              <div className="mt-1.5">
                <ContactChip contact={job.contact} />
              </div>
            )}

            {/* Tags */}
            {job.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {job.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>
            )}

            {/* Full original message collapsible */}
            {hasFullText && (
              <div className="mt-2 border-t pt-2">
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expanded
                    ? <><ChevronUp className="h-3 w-3" /> הסתר הודעה מקורית</>
                    : <><ChevronDown className="h-3 w-3" /> הצג הודעה מקורית</>
                  }
                </button>
                {expanded && (
                  <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/40 rounded p-2 max-h-96 overflow-y-auto">
                    {fullText}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {job.url ? (
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="whitespace-nowrap">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Apply
                </Button>
              </a>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">אין קישור</span>
            )}
            {contactEmail && (
              <Button
                size="sm"
                variant="outline"
                className="whitespace-nowrap text-green-700 border-green-300 hover:bg-green-50"
                onClick={handleSendCv}
                disabled={sending}
                title={`שלח קו"ח ל-${contactEmail}`}
              >
                {sending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> מכין מייל...</>
                  : <><Send className="h-3.5 w-3.5 mr-1" /> שלח קו&quot;ח</>
                }
              </Button>
            )}
            {sendError && (
              <p className="text-xs text-destructive text-right max-w-[140px]">{sendError}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="whitespace-nowrap text-indigo-700 border-indigo-300 hover:bg-indigo-50"
              onClick={openInterview}
              title="שאלות לראיון עבודה"
            >
              <GraduationCap className="h-3.5 w-3.5 mr-1" /> Interview
            </Button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-muted-foreground/40 hover:text-destructive transition-colors p-1"
              title="הסר משרה"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Dialog open={genderPicker} onOpenChange={setGenderPicker}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>ניסוח מכתב הכיסוי</DialogTitle>
          <DialogDescription>
            בחר מין כדי שהמכתב יהיה מנוסח בצורה הנכונה בעברית. ניתן לשנות בהמשך.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-1">
          <Button className="flex-1" onClick={() => pickGender('male')}>זכר</Button>
          <Button className="flex-1" variant="outline" onClick={() => pickGender('female')}>נקבה</Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
      <DialogContent showCloseButton className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            שאלות ראיון — {job.title}
          </DialogTitle>
          {job.company && <DialogDescription>{job.company}</DialogDescription>}
        </DialogHeader>

        {interviewLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> מכין שאלות מותאמות...
          </div>
        )}

        {interviewError && (
          <p className="text-sm text-destructive py-4 text-center">{interviewError}</p>
        )}

        {!interviewLoading && !interviewError && interviewQuestions.length > 0 && (
          <div className="space-y-6 pt-1">
            {interviewQuestions.map((q, idx) => {
              const catColors: Record<string, string> = {
                'טכני': 'text-blue-700 bg-blue-50 border-blue-200',
                'התנהגותי': 'text-purple-700 bg-purple-50 border-purple-200',
                'חברה': 'text-emerald-700 bg-emerald-50 border-emerald-200',
              }
              const fb = feedback[idx]
              const scoreColor = !fb ? '' : fb.score >= 8 ? 'text-green-700 bg-green-50 border-green-300'
                : fb.score >= 5 ? 'text-yellow-700 bg-yellow-50 border-yellow-300'
                : 'text-red-700 bg-red-50 border-red-300'

              return (
                <div key={idx} className="border rounded-lg p-3 space-y-3">
                  {/* Question */}
                  <div className="flex items-start gap-2">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${catColors[q.category]}`}>
                      {q.category}
                    </span>
                    <p className="text-sm font-medium leading-snug">{q.question}</p>
                  </div>

                  {/* Answer textarea */}
                  <Textarea
                    placeholder="כתוב את תשובתך כאן..."
                    className="text-sm min-h-[80px] resize-none"
                    value={answers[idx] ?? ''}
                    onChange={e => setAnswer(idx, e.target.value)}
                    dir="rtl"
                  />

                  {/* Check button */}
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                      disabled={!answers[idx]?.trim() || fb?.loading}
                      onClick={() => checkAnswer(idx)}
                    >
                      {fb?.loading
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> בודק...</>
                        : <><Sparkles className="h-3.5 w-3.5 mr-1" /> בדוק תשובה</>
                      }
                    </Button>
                    {fb && !fb.loading && fb.score > 0 && (
                      <span className={`text-sm font-bold px-3 py-1 rounded-full border ${scoreColor}`}>
                        {fb.score}/10
                      </span>
                    )}
                  </div>

                  {/* Feedback */}
                  {fb && !fb.loading && fb.score > 0 && (
                    <div className="bg-muted/40 rounded-md p-3 space-y-2 text-sm" dir="rtl">
                      <p className="text-muted-foreground leading-relaxed">{fb.analysis}</p>
                      {fb.improvements?.length > 0 && (
                        <ul className="space-y-1 pt-1">
                          {fb.improvements.map((tip, ti) => (
                            <li key={ti} className="flex items-start gap-1.5 text-xs text-indigo-700">
                              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}

// ── Filters ───────────────────────────────────────────────────────────────────

const SOURCES = [
  { value: 'all', label: 'הכל' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'search', label: 'חיפוש' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
]

// ── Main component ────────────────────────────────────────────────────────────

export function SavedJobsTab() {
  const [jobs, setJobs] = useState<SavedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs/saved')
      const data = await res.json() as { jobs?: SavedJob[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setJobs(data.jobs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = (id: string) => setJobs(prev => prev.filter(j => j.id !== id))

  const handleStatusChange = (jobId: string, status: AppStatus, appId: string) => {
    setJobs(prev => prev.map(j =>
      j.id === jobId ? { ...j, application_status: status, application_id: appId } : j
    ))
  }

  const filtered = jobs.filter(j => {
    const matchesSource = sourceFilter === 'all' || j.source === sourceFilter
    const q = search.toLowerCase()
    const matchesSearch = !q || [j.title, j.company, j.location, ...(j.tags ?? [])].some(f => f?.toLowerCase().includes(q))
    return matchesSource && matchesSearch
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש לפי תפקיד, חברה, טכנולוגיה..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5">
          {SOURCES.map(s => (
            <button
              key={s.value}
              onClick={() => setSourceFilter(s.value)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${sourceFilter === s.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} משרות{sourceFilter !== 'all' ? ` מ-${SOURCES.find(s => s.value === sourceFilter)?.label}` : ''} — ממוינות לפי התאמה
        </p>
      )}

      {/* States */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <p className="text-sm text-destructive text-center py-4">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">
            {jobs.length === 0
              ? 'עדיין אין משרות שמורות. חפש משרות בטאבים האחרים ויופיעו כאן.'
              : 'אין תוצאות לחיפוש זה.'
            }
          </p>
        </div>
      )}

      {/* Job list */}
      {!loading && filtered.map(job => (
        <SavedJobCard key={job.id} job={job} onDelete={handleDelete} onStatusChange={handleStatusChange} />
      ))}
    </div>
  )
}
