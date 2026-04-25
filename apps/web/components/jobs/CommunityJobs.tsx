'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wifi, MapPin, DollarSign, Sparkles, ExternalLink, RefreshCw, CheckCircle, XCircle, MessageCircle, Send, Search } from 'lucide-react'

interface ParsedJob {
  title: string
  company: string
  location: string
  salary_range: string
  remote: boolean
  url: string
  tags: string[]
  snippet: string
  source: 'whatsapp' | 'telegram'
  source_name: string
  match_score: number
  raw_message: string
}

interface WAGroup {
  id: string
  name: string
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}% match</span>
}

function SourceBadge({ source, name }: { source: 'whatsapp' | 'telegram'; name: string }) {
  if (source === 'whatsapp') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <WhatsAppIcon className="h-3 w-3" /> {name}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
      <TelegramIcon className="h-3 w-3" /> {name}
    </span>
  )
}

function CommunityJobCard({ job }: { job: ParsedJob }) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-sm">{job.title || 'Job Opportunity'}</h3>
              <ScoreBadge score={Math.round(job.match_score)} />
              <SourceBadge source={job.source} name={job.source_name} />
              {job.remote && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Wifi className="h-3 w-3" /> Remote
                </span>
              )}
            </div>
            {job.company && <p className="text-sm font-medium text-muted-foreground">{job.company}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
              {job.salary_range && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{job.salary_range}</span>}
            </div>
            {job.snippet && (
              <p className="text-xs text-indigo-600 mt-1.5 flex items-start gap-1">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />{job.snippet}
              </p>
            )}
            {!job.snippet && job.raw_message && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{job.raw_message}</p>
            )}
            {job.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {job.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>
            )}
          </div>
          {job.url && (
            <div className="shrink-0">
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Apply</Button>
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── WhatsApp Panel ────────────────────────────────────────────────────────────

function WhatsAppPanel({ userProfile }: { userProfile?: string }) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'qr_ready' | 'connected'>('disconnected')
  const [qrBase64, setQrBase64] = useState<string | null>(null)
  const [groups, setGroups] = useState<WAGroup[]>([])
  const [bufferedGroups, setBufferedGroups] = useState(0)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [storeSummary, setStoreSummary] = useState<Record<string, number>>({})
  const [groupSearch, setGroupSearch] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanInfo, setScanInfo] = useState<{ messagesScanned: number } | null>(null)
  const [jobs, setJobs] = useState<ParsedJob[]>([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const connectedAtRef = useRef<number | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/messaging/whatsapp')
      if (!res.ok) return
      const data = await res.json() as {
        status: typeof status
        qrBase64: string | null
        groups: WAGroup[]
        bufferedGroups: number
        historyLoaded: boolean
        storeSummary: Record<string, number>
      }
      setStatus(data.status)
      setQrBase64(data.qrBase64 ?? null)
      setGroups(data.groups ?? [])
      setBufferedGroups(data.bufferedGroups ?? 0)
      setHistoryLoaded(data.historyLoaded ?? false)
      setStoreSummary(data.storeSummary ?? {})
    } catch { /* service not running */ }
  }

  useEffect(() => { fetchStatus() }, [])

  useEffect(() => {
    if (status === 'connecting' || status === 'qr_ready') {
      connectedAtRef.current = null
      pollRef.current = setInterval(fetchStatus, 2000)
    } else if (status === 'connected') {
      if (!connectedAtRef.current) connectedAtRef.current = Date.now()
      pollRef.current = setInterval(() => {
        fetchStatus()
        if (connectedAtRef.current && Date.now() - connectedAtRef.current > 30_000) {
          clearInterval(pollRef.current!)
        }
      }, 2500)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [status])

  const handleConnect = async () => {
    setError(null)
    const res = await fetch('/api/messaging/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect' }),
    })
    const data = await res.json() as { status: typeof status; qrBase64: string | null; groups: WAGroup[] }
    setStatus(data.status)
    setQrBase64(data.qrBase64 ?? null)
    setGroups(data.groups ?? [])
  }

  const handleDisconnect = async () => {
    await fetch('/api/messaging/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    })
    setStatus('disconnected')
    setQrBase64(null)
    setGroups([])
    setSelectedGroups([])
    setJobs([])
    setScanInfo(null)
  }

  // Full reset — wipes session, shows new QR, WhatsApp re-sends history
  // Only needed when you want to relink the device or fix a broken session
  const handleRelinkDevice = async () => {
    if (!confirm('פעולה זו תנתק את המכשיר ותבקש סריקת QR מחדש. להמשיך?')) return
    setError(null)
    setJobs([])
    setScanInfo(null)
    const res = await fetch('/api/messaging/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    })
    const data = await res.json() as { status: typeof status; qrBase64: string | null; groups: WAGroup[] }
    setStatus(data.status)
    setQrBase64(data.qrBase64 ?? null)
    setGroups(data.groups ?? [])
  }

  // Refresh — re-scan selected groups from existing store (no disconnect)
  const handleRefresh = () => {
    if (selectedGroups.length === 0) return
    handleScan()
  }

  const handleScan = async () => {
    if (selectedGroups.length === 0) return
    setScanning(true)
    setError(null)
    setSaved(false)
    setScanInfo(null)
    try {
      const res = await fetch('/api/messaging/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', groupIds: selectedGroups, userProfile }),
      })
      const data = await res.json() as { jobs?: ParsedJob[]; messagesScanned?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      // Merge new jobs with existing — keep previously found jobs visible
      setJobs(prev => {
        const incoming = data.jobs ?? []
        const existingFPs = new Set(prev.map(j => (j.raw_message || j.snippet || j.title || '').slice(0, 300)))
        const truly_new = incoming.filter(j => !existingFPs.has((j.raw_message || j.snippet || j.title || '').slice(0, 300)))
        return [...prev, ...truly_new]
      })
      setScanInfo({ messagesScanned: data.messagesScanned ?? 0 })
      if ((data.jobs?.length ?? 0) > 0) setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const toggleGroup = (id: string) =>
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WhatsAppIcon className="h-5 w-5 text-green-600" />
            קבוצות WhatsApp
          </CardTitle>
          <CardDescription>
            חיבור לוואטסאפ, בחירת קבוצות משרות וחילוץ משרות מהשבוע האחרון
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {status === 'disconnected' && (
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside bg-muted/40 rounded-lg p-3">
              <li>לחץ <strong>Connect WhatsApp</strong> — יופיע QR Code</li>
              <li>WhatsApp בטלפון ← <strong>מכשירים מקושרים</strong> ← <strong>קישור מכשיר</strong> ← סרוק</li>
              <li>בחר קבוצות משרות ← לחץ <strong>סרוק</strong></li>
              <li>המשרות ייכנסו אוטומטית לטאב Jobs</li>
            </ol>
          )}

          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {status === 'connected' && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">מחובר</span>
                  {historyLoaded ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      ✓ היסטוריה נטענה · {bufferedGroups} קבוצות · {Object.values(storeSummary).reduce((a, b) => a + b, 0)} הודעות
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                      ממתין לסנכרון היסטוריה...
                    </span>
                  )}
                </>
              )}
              {status === 'disconnected' && <><XCircle className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">לא מחובר</span></>}
              {status === 'connecting' && <><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">מתחבר...</span></>}
              {status === 'qr_ready' && <><Loader2 className="h-4 w-4 animate-spin text-green-600" /><span className="text-sm text-green-700 font-medium">ממתין לסריקת QR</span></>}
            </div>
            {status === 'connected'
              ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={selectedGroups.length === 0 || scanning}
                    title="סורק מחדש את הקבוצות הנבחרות — ללא ניתוק"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${scanning ? 'animate-spin' : ''}`} />
                    רענן
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-muted-foreground">
                    נתק
                  </Button>
                </div>
              )
              : <Button size="sm" onClick={handleConnect} disabled={status === 'connecting' || status === 'qr_ready'}>
                  {status === 'connecting' ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />מתחבר…</> : 'Connect WhatsApp'}
                </Button>
            }
          </div>

          {/* QR code */}
          {qrBase64 && (
            <div className="flex flex-col items-center gap-3 py-3 border rounded-lg bg-muted/20">
              <img src={qrBase64} alt="WhatsApp QR" className="w-52 h-52 rounded-lg border bg-white p-1" />
              <p className="text-xs text-center text-muted-foreground">
                <span className="font-medium text-foreground block">סרוק עם הטלפון</span>
                WhatsApp → ⋮ → מכשירים מקושרים → קישור מכשיר
              </p>
            </div>
          )}

          {/* Group selector */}
          {status === 'connected' && groups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">בחר קבוצות לסריקה ({selectedGroups.length} נבחרו)</Label>
                {selectedGroups.length > 0 && (
                  <button onClick={() => setSelectedGroups([])} className="text-xs text-muted-foreground hover:text-foreground underline">
                    נקה הכל
                  </button>
                )}
              </div>

              {/* Search box */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={`חפש מתוך ${groups.length} קבוצות...`}
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Group list */}
              <div className="max-h-52 overflow-y-auto space-y-0.5 border rounded-md p-1.5">
                {filteredGroups.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">אין קבוצות תואמות</p>
                )}
                {filteredGroups.map(g => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="text-sm truncate flex-1">{g.name}</span>
                    {storeSummary[g.name] !== undefined && (
                      <span className="text-xs text-muted-foreground/60 shrink-0">{storeSummary[g.name]} הודעות</span>
                    )}
                  </label>
                ))}
              </div>

              {/* Scan button */}
              <Button className="w-full" disabled={selectedGroups.length === 0 || scanning} onClick={handleScan}>
                {scanning
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />מחלץ משרות...</>
                  : <><RefreshCw className="h-4 w-4 mr-2" />סרוק {selectedGroups.length} קבוצ{selectedGroups.length !== 1 ? 'ות' : 'ה'}</>
                }
              </Button>

              {scanInfo && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>נסרקו {scanInfo.messagesScanned} הודעות</span>
                  {saved && jobs.length > 0 && (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle className="h-3 w-3" /> {jobs.length} משרות נשמרו בטאב Jobs
                    </span>
                  )}
                  {scanInfo.messagesScanned > 0 && jobs.length === 0 && (
                    <span>— לא נמצאו משרות בהודעות אלו</span>
                  )}
                  {scanInfo.messagesScanned === 0 && (
                    <span className="text-amber-600">
                      — אין הודעות בקבוצות אלו עדיין.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {status === 'connected' && groups.length === 0 && (
            <p className="text-xs text-muted-foreground">לא נמצאו קבוצות. ודא שאתה חבר בקבוצות מהטלפון.</p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Relink device — hidden option for broken sessions */}
          {status === 'connected' && (
            <div className="border-t pt-3">
              <button
                onClick={handleRelinkDevice}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline transition-colors"
              >
                בעיה בחיבור? קשר מכשיר מחדש (ידרוש סריקת QR חדשה)
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{jobs.length} משרות מוואטסאפ</h3>
          {jobs.map((job, i) => <CommunityJobCard key={i} job={job} />)}
        </div>
      )}
    </div>
  )
}

// ── Telegram Panel ────────────────────────────────────────────────────────────

function TelegramPanel({ userProfile }: { userProfile?: string }) {
  const [botToken, setBotToken] = useState('')
  const [channels, setChannels] = useState('')
  const [botName, setBotName] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [jobs, setJobs] = useState<ParsedJob[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleValidate = async () => {
    if (!botToken) return
    setValidating(true)
    setError(null)
    setBotName(null)
    try {
      const res = await fetch('/api/messaging/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', botToken }),
      })
      const data = await res.json() as { valid: boolean; botName?: string; error?: string }
      if (!data.valid) throw new Error('Invalid bot token')
      setBotName(data.botName ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const handleScan = async () => {
    const channelList = channels.split(',').map(c => c.trim()).filter(Boolean)
    if (!botToken || channelList.length === 0) return
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/messaging/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', botToken, channels: channelList, userProfile }),
      })
      const data = await res.json() as { jobs?: ParsedJob[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      setJobs(prev => {
        const incoming = data.jobs ?? []
        const existingFPs = new Set(prev.map(j => (j.raw_message || j.snippet || j.title || '').slice(0, 300)))
        const truly_new = incoming.filter(j => !existingFPs.has((j.raw_message || j.snippet || j.title || '').slice(0, 300)))
        return [...prev, ...truly_new]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TelegramIcon className="h-5 w-5 text-sky-500" />
            Telegram Job Channels
          </CardTitle>
          <CardDescription>
            Connect a Telegram bot that is a member of your job channels to extract postings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Bot Token</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="123456:ABCdef..."
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleValidate} disabled={!botToken || validating}>
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
            {botName && (
              <p className="text-xs text-green-700 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Connected as @{botName}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Create a bot via <span className="font-mono">@BotFather</span>, add it as admin to your job channels, then paste the token above.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Channels / Groups to scan</Label>
            <Input
              placeholder="@jobsil, @devjobs_israel, @hitech_jobs"
              value={channels}
              onChange={e => setChannels(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated channel usernames (with or without @)</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            disabled={!botToken || !channels || scanning}
            onClick={handleScan}
          >
            {scanning
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scanning channels...</>
              : <><Send className="h-4 w-4 mr-2" />Scan Channels for Jobs</>
            }
          </Button>
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{jobs.length} jobs extracted from Telegram</h3>
          {jobs.map((job, i) => <CommunityJobCard key={i} job={job} />)}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CommunityJobs({ userProfile }: { userProfile?: string }) {
  const [activeSource, setActiveSource] = useState<'whatsapp' | 'telegram'>('whatsapp')

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSource('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${activeSource === 'whatsapp' ? 'bg-green-600 text-white border-green-600' : 'bg-background hover:bg-muted border-border'}`}
        >
          <WhatsAppIcon className="h-4 w-4" /> WhatsApp
        </button>
        <button
          onClick={() => setActiveSource('telegram')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${activeSource === 'telegram' ? 'bg-sky-500 text-white border-sky-500' : 'bg-background hover:bg-muted border-border'}`}
        >
          <TelegramIcon className="h-4 w-4" /> Telegram
        </button>
      </div>

      {activeSource === 'whatsapp'
        ? <WhatsAppPanel userProfile={userProfile} />
        : <TelegramPanel userProfile={userProfile} />
      }

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 shrink-0" /><strong>WhatsApp:</strong> Your WhatsApp session is stored only on your local machine. Messages are processed by AI to extract job data.</p>
        <p className="flex items-center gap-1.5"><Send className="h-3.5 w-3.5 shrink-0" /><strong>Telegram:</strong> Your bot token and channel messages are processed by AI. The token is never stored.</p>
      </div>
    </div>
  )
}
