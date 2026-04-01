'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface Session {
  id: string
  created_at: string
  questions: { type: string; question: string; hint: string }[]
  job_descriptions: { title: string; company: string } | null
}

export function InterviewPageClient({ sessions }: { sessions: Session[] }) {
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Session | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
    }
  }

  const allSessions = result ? [result, ...sessions.filter(s => s.id !== result.id)] : sessions

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New Interview Prep</CardTitle>
          <CardDescription>Enter the company and role to generate tailored questions</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Input placeholder="e.g. Google" value={company} onChange={e => setCompany(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input placeholder="e.g. Senior Frontend Engineer" value={role} onChange={e => setRole(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Job Description <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                placeholder="Paste the job description for more tailored questions..."
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
                rows={4}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Questions'}
            </Button>
          </form>
        </CardContent>
      </Card>

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
                        {session.job_descriptions?.title ?? 'Interview Session'} — {session.job_descriptions?.company ?? ''}
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
