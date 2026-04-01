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
import { Loader2, Target, TrendingUp, AlertTriangle, CheckCircle, Lightbulb, Download } from 'lucide-react'

interface MatchAnalysisProps {
  resumeId: string
}

interface Keyword {
  keyword: string
  category: string
}

interface AnalysisResult {
  score: number
  matching_keywords: Keyword[]
  missing_keywords: Keyword[]
  strengths: string[]
  gaps: string[]
  tailored_suggestions: string
}

const CATEGORY_COLORS: Record<string, string> = {
  'Technical':   'bg-blue-100 text-blue-800',
  'Tools':       'bg-purple-100 text-purple-800',
  'Soft Skills': 'bg-orange-100 text-orange-800',
  'Domain':      'bg-teal-100 text-teal-800',
  'Language':    'bg-pink-100 text-pink-800',
  'Other':       'bg-gray-100 text-gray-800',
}

function KeywordGroup({ keywords, baseColor }: { keywords: Keyword[]; baseColor: string }) {
  const groups = keywords.reduce<Record<string, Keyword[]>>((acc, kw) => {
    const cat = kw.category || 'Other'
    acc[cat] = acc[cat] ? [...acc[cat], kw] : [kw]
    return acc
  }, {})

  if (Object.keys(groups).length === 0) return <p className="text-sm text-muted-foreground">None found</p>

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([cat, kws]) => (
        <div key={cat}>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{cat}</p>
          <div className="flex flex-wrap gap-2">
            {kws.map(kw => (
              <Badge key={kw.keyword} variant="secondary" className={CATEGORY_COLORS[cat] ?? baseColor}>
                {kw.keyword}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function MatchAnalysis({ resumeId }: MatchAnalysisProps) {
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [cvLanguage, setCvLanguage] = useState<'en' | 'he'>('en')

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

  const handleDownloadCV = async () => {
    if (!result) return
    setDownloading(true)
    setError(null)
    try {
      const res = await fetch('/api/resume/generate-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          jobTitle,
          company,
          jobDescription,
          tailored_suggestions: result.tailored_suggestions,
          language: cvLanguage,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate CV')
    } finally {
      setDownloading(false)
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

          {/* Download Tailored CV */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 border rounded-lg p-1">
                  <button
                    onClick={() => setCvLanguage('en')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${cvLanguage === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setCvLanguage('he')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${cvLanguage === 'he' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    עברית
                  </button>
                </div>
                <Button onClick={handleDownloadCV} disabled={downloading} className="flex-1">
                  {downloading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating CV...</>
                    : <><Download className="mr-2 h-4 w-4" /> Download Tailored CV (PDF)</>
                  }
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">A new tab will open — use your browser&apos;s Print → Save as PDF</p>
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
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Matching Keywords
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <KeywordGroup keywords={result.matching_keywords} baseColor="bg-green-100 text-green-800" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    Missing Keywords
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <KeywordGroup keywords={result.missing_keywords} baseColor="bg-red-100 text-red-800" />
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
