'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Target, TrendingUp, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react'

interface MatchAnalysisProps {
  resumeId: string
}

interface AnalysisResult {
  score: number
  matching_keywords: string[]
  missing_keywords: string[]
  strengths: string[]
  gaps: string[]
  tailored_suggestions: string
}

export function MatchAnalysis({ resumeId }: MatchAnalysisProps) {
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/resume/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, jobTitle, company, jobDescription, jobUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = result
    ? result.score >= 75 ? 'text-green-600'
    : result.score >= 50 ? 'text-yellow-600'
    : 'text-red-600'
    : ''

  const scoreBarColor = result
    ? result.score >= 75 ? 'bg-green-500'
    : result.score >= 50 ? 'bg-yellow-500'
    : 'bg-red-500'
    : ''

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Job Match Analyzer
          </CardTitle>
          <CardDescription>Paste a job description to get your match score and tailored suggestions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job-title">Job Title</Label>
              <Input id="job-title" placeholder="e.g. Senior Frontend Engineer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" placeholder="e.g. Stripe" value={company} onChange={e => setCompany(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-url">Job URL (optional)</Label>
            <Input id="job-url" placeholder="https://..." value={jobUrl} onChange={e => setJobUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-desc">Job Description *</Label>
            <Textarea
              id="job-desc"
              placeholder="Paste the full job description here..."
              className="min-h-[200px]"
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleAnalyze} disabled={!jobDescription.trim() || loading} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing with AI...</> : 'Analyze Match'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Score Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Match Score</p>
                  <p className={`text-5xl font-bold ${scoreColor}`}>{result.score}%</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {result.score >= 75 ? 'Strong Match' : result.score >= 50 ? 'Moderate Match' : 'Weak Match'}
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${scoreBarColor}`} style={{ width: `${result.score}%` }} />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="keywords">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="keywords">Keywords</TabsTrigger>
              <TabsTrigger value="strengths">Strengths & Gaps</TabsTrigger>
              <TabsTrigger value="suggestions">Tailored Tips</TabsTrigger>
            </TabsList>

            <TabsContent value="keywords" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" />Matching Keywords</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.matching_keywords.map(kw => <Badge key={kw} variant="secondary" className="bg-green-100 text-green-800">{kw}</Badge>)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-600" />Missing Keywords</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.missing_keywords.map(kw => <Badge key={kw} variant="secondary" className="bg-red-100 text-red-800">{kw}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="strengths" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" />Strengths</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />{s}</li>)}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-600" />Gaps</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.gaps.map((g, i) => <li key={i} className="flex items-start gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />{g}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suggestions">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-blue-600" />How to Tailor Your Resume</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.tailored_suggestions}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
