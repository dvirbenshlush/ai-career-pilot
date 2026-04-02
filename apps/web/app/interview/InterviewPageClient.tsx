'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Loader2, ChevronDown, ChevronUp, FileText, CheckCircle } from 'lucide-react'

interface Session {
  id: string
  created_at: string
  questions: { type: string; question: string; hint: string }[]
  job_descriptions: { title: string; company: string } | null
}

interface SavedJob {
  id: string
  title: string
  company: string
  description: string
}

export function InterviewPageClient({
  sessions,
  savedJobs,
}: {
  sessions: Session[]
  savedJobs: SavedJob[]
}) {
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Session | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleSelectJob = (job: SavedJob) => {
    setSelectedJobId(job.id)
    setRole(job.title)
    setCompany(job.company)
    setJobDesc(job.description)
    setError(null)
    // Scroll to form
    document.getElementById('interview-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleClearSelection = () => {
    setSelectedJobId(null)
    setRole('')
    setCompany('')
    setJobDesc('')
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch('/api/interview/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, role, jobDescription: jobDesc }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to generate questions')
    } else {
      setResult(data.session)
      setExpandedId(data.session.id)
    }
  }

  const allSessions = result ? [result, ...sessions.filter(s => s.id !== result.id)] : sessions

  return (
    <div className="space-y-6">

      {/* Saved jobs from Resume tab */}
      {savedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-blue-600" />
              Pick from Analyzed Jobs
            </CardTitle>
            <CardDescription>Jobs you analyzed in the Resume tab — click one to auto-fill the form</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => handleSelectJob(job)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    selectedJobId === job.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                >
                  {selectedJobId === job.id && <CheckCircle className="h-3.5 w-3.5" />}
                  <span className="font-medium">{job.title}</span>
                  <span className="opacity-70">@ {job.company}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation form */}
      <Card id="interview-form">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>New Interview Prep</CardTitle>
              <CardDescription>
                {selectedJobId
                  ? 'Job details pre-filled from your analysis — generate questions below'
                  : 'Enter the company and role to generate tailored questions'}
              </CardDescription>
            </div>
            {selectedJobId && (
              <button
                onClick={handleClearSelection}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  placeholder="e.g. Google"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  placeholder="e.g. Senior Frontend Engineer"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Job Description{' '}
                {!selectedJobId && <span className="text-muted-foreground">(optional)</span>}
              </Label>
              <Textarea
                placeholder="Paste the job description for more tailored questions..."
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
                rows={selectedJobId ? 5 : 4}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                : 'Generate Questions'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Past sessions */}
      {allSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Past Sessions</h2>
          {allSessions.map(session => (
            <Card key={session.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">
                        {session.job_descriptions?.title ?? 'Interview Session'}
                        {session.job_descriptions?.company ? ` — ${session.job_descriptions.company}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()} · {session.questions?.length ?? 0} questions
                      </p>
                    </div>
                  </div>
                  {expandedId === session.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {expandedId === session.id && (
                <CardContent className="space-y-4 pt-0">
                  {session.questions?.map((q, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={q.type === 'technical' ? 'default' : 'secondary'}>{q.type}</Badge>
                        <span className="font-medium text-sm">Q{i + 1}</span>
                      </div>
                      <p>{q.question}</p>
                      {q.hint && <p className="text-sm text-muted-foreground italic">Hint: {q.hint}</p>}
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {allSessions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No sessions yet. Generate your first interview prep above.</p>
        </div>
      )}
    </div>
  )
}
