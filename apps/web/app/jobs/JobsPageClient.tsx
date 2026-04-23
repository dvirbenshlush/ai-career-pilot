'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Search, ExternalLink, MapPin, DollarSign, Wifi, Sparkles, FileText, MessageCircle, Bookmark } from 'lucide-react'
import { CommunityJobs } from '@/components/jobs/CommunityJobs'
import { SavedJobsTab } from '@/components/jobs/SavedJobsTab'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

interface Job {
  id?: string
  title: string
  company: string
  location: string
  url: string
  salary_range?: string
  remote: boolean
  match_score: number
  tags: string[]
  snippet?: string
  why_match?: string
}

interface Profile {
  name: string
  current_title: string
  skills: string[]
  experience_years: number
  summary: string
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}% match</span>
}

function JobCard({ job, resumeId }: { job: Job; resumeId: string | null }) {
  const [cvLoading, setCvLoading] = useState(false)
  const [cvHtml, setCvHtml] = useState<string | null>(null)
  const [cvError, setCvError] = useState<string | null>(null)

  const handleCreateCV = async () => {
    if (!resumeId) return
    setCvLoading(true)
    setCvError(null)
    try {
      const jobDescription = [job.title, job.company, job.snippet, job.why_match].filter(Boolean).join('\n')
      const res = await fetch('/api/resume/generate-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          jobTitle: job.title,
          company: job.company,
          jobDescription,
          language: 'en',
        }),
      })
      if (!res.ok) {
        let errMsg = 'CV generation failed'
        try { const d = await res.json(); errMsg = d.error ?? errMsg } catch { /* empty */ }
        throw new Error(errMsg)
      }
      const html = await res.text()
      setCvHtml(html)
    } catch (err) {
      setCvError(err instanceof Error ? err.message : 'CV generation failed')
    } finally {
      setCvLoading(false)
    }
  }

  const handleOpenCV = () => {
    if (!cvHtml) return
    const blob = new Blob([cvHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
  }

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-sm">{job.title}</h3>
              <ScoreBadge score={Math.round(job.match_score)} />
              {job.remote && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Wifi className="h-3 w-3" /> Remote
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-muted-foreground">{job.company}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
              {job.salary_range && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{job.salary_range}</span>}
            </div>
            {job.why_match && (
              <p className="text-xs text-indigo-600 mt-1.5 flex items-start gap-1">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />{job.why_match}
              </p>
            )}
            {job.snippet && !job.why_match && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{job.snippet}</p>}
            {job.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {job.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>
            )}
            {cvError && <p className="text-xs text-destructive mt-2">{cvError}</p>}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {cvHtml ? (
              <>
                <Button size="sm" className="whitespace-nowrap" onClick={handleOpenCV}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> View Adapted CV
                </Button>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Apply to job posting →
                </a>
              </>
            ) : (
              <>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Apply</Button>
                </a>
                {resumeId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cvLoading}
                    onClick={handleCreateCV}
                    className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    {cvLoading
                      ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Creating CV...</>
                      : <><FileText className="h-3 w-3 mr-1" /> Create adapted CV</>
                    }
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const JOB_TYPES = [
  { value: 'any', label: 'Any' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'technical', label: 'Technical' },
  { value: 'management', label: 'Management' },
  { value: 'sales', label: 'Sales' },
  { value: 'creative', label: 'Creative' },
  { value: 'physical', label: 'Physical / Field' },
  { value: 'medical', label: 'Medical' },
]

const WORK_MODES = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

const EXP_LEVELS = [
  { value: 'any', label: 'Any level' },
  { value: 'entry', label: 'Entry level' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
]

function FilterRow({
  label, options, value, onChange,
}: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${value === o.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function JobsPageClient({ savedJobs, resumeId, linkedinProfile }: { savedJobs: Job[]; resumeId: string | null; linkedinProfile?: string }) {
  // Manual search state
  const [role, setRole] = useState('')
  const [skills, setSkills] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [salaryMin, setSalaryMin] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<Job[] | null>(null)

  // LinkedIn match state
  const [profileText, setProfileText] = useState('')
  const [salary, setSalary] = useState('')
  const [jobType, setJobType] = useState('any')
  const [workMode, setWorkMode] = useState('any')
  const [liLocation, setLiLocation] = useState('')
  const [expLevel, setExpLevel] = useState('any')
  const [liLoading, setLiLoading] = useState(false)
  const [liError, setLiError] = useState<string | null>(null)
  const [liResults, setLiResults] = useState<Job[] | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchLoading(true)
    setSearchError(null)
    setSearchResults(null)
    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, skills, location: searchLocation, remote, salaryMin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSearchResults(data.jobs)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleLinkedinMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLiLoading(true)
    setLiError(null)
    setLiResults(null)
    setProfile(null)
    try {
      const res = await fetch('/api/jobs/linkedin-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText, salary, jobType, workMode, location: liLocation, experienceLevel: expLevel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLiResults(data.jobs)
      setProfile(data.profile)
    } catch (err) {
      setLiError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLiLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="saved">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="saved" className="flex items-center gap-1.5 text-xs">
            <Bookmark className="h-3.5 w-3.5" /> כל המשרות
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="flex items-center gap-1.5 text-xs">
            <LinkedInIcon className="h-3.5 w-3.5" /> LinkedIn
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" /> חיפוש
          </TabsTrigger>
          <TabsTrigger value="community" className="flex items-center gap-1.5 text-xs">
            <MessageCircle className="h-3.5 w-3.5" /> קהילה
          </TabsTrigger>
        </TabsList>

        {/* Saved jobs tab */}
        <TabsContent value="saved" className="mt-4">
          <SavedJobsTab />
        </TabsContent>

        {/* LinkedIn tab */}
        <TabsContent value="linkedin" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkedInIcon className="h-5 w-5 text-blue-600" />
                Match Jobs to Your LinkedIn Profile
              </CardTitle>
              <CardDescription>
                Paste your LinkedIn profile URL — we scrape it, analyze your experience, and find 10 matching jobs from LinkedIn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLinkedinMatch} className="space-y-5">
                <div className="space-y-2">
                  <Label>Paste Your LinkedIn Profile Text *</Label>
                  <textarea
                    className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                    placeholder="1. Open your LinkedIn profile in a browser&#10;2. Select all text (Ctrl+A) and copy (Ctrl+C)&#10;3. Paste it here (Ctrl+V)"
                    value={profileText}
                    onChange={e => setProfileText(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    LinkedIn blocks automated access — paste your profile text manually. Go to your profile → select all → copy → paste here.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location preference</Label>
                    <Input placeholder="e.g. Tel Aviv, London, NYC" value={liLocation} onChange={e => setLiLocation(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum salary</Label>
                    <Input placeholder="e.g. $80,000 or ₪25,000/month" value={salary} onChange={e => setSalary(e.target.value)} />
                  </div>
                </div>

                <FilterRow label="Job Type" options={JOB_TYPES} value={jobType} onChange={setJobType} />
                <FilterRow label="Work Mode" options={WORK_MODES} value={workMode} onChange={setWorkMode} />
                <FilterRow label="Experience Level" options={EXP_LEVELS} value={expLevel} onChange={setExpLevel} />

                {liError && <p className="text-sm text-destructive">{liError}</p>}

                <Button type="submit" disabled={liLoading} className="w-full">
                  {liLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing profile & searching jobs...</>
                    : <><Sparkles className="mr-2 h-4 w-4" /> Find My Best Matches</>
                  }
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Profile summary card */}
          {profile && (
            <Card className="border-indigo-200 bg-indigo-50/40">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <LinkedInIcon className="h-8 w-8 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{profile.name}</p>
                    <p className="text-sm text-muted-foreground">{profile.current_title} · {profile.experience_years} years exp.</p>
                    <p className="text-sm mt-1">{profile.summary}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {profile.skills?.slice(0, 8).map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {liResults && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{liResults.length} LinkedIn Jobs Matched to Your Profile</h2>
              {liResults.length === 0
                ? <p className="text-muted-foreground text-sm">No matches found. Try adjusting your filters.</p>
                : liResults.map((job, i) => <JobCard key={i} job={job} resumeId={resumeId} />)
              }
            </div>
          )}
        </TabsContent>

        {/* Manual search tab */}
        <TabsContent value="manual" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Search Parameters</CardTitle>
              <CardDescription>Define what you&apos;re looking for and the AI agent will find and score matching jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Input placeholder="e.g. Product Manager, Accountant, Nurse" value={role} onChange={e => setRole(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Skills / Stack</Label>
                    <Input placeholder="e.g. Excel, Python, Sales, Management" value={skills} onChange={e => setSkills(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input placeholder="e.g. Tel Aviv, NYC" value={searchLocation} onChange={e => setSearchLocation(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Salary</Label>
                    <Input placeholder="e.g. $120,000 or ₪30,000/month" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="remote" checked={remote} onChange={e => setRemote(e.target.checked)} className="h-4 w-4 rounded" />
                  <Label htmlFor="remote" className="cursor-pointer">Remote / Hybrid preferred</Label>
                </div>
                {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                <Button type="submit" disabled={searchLoading} className="w-full">
                  {searchLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching jobs...</>
                    : <><Search className="mr-2 h-4 w-4" /> Find Jobs</>
                  }
                </Button>
              </form>
            </CardContent>
          </Card>

          {searchResults !== null && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{searchResults.length} jobs found</h2>
              {searchResults.length === 0
                ? <p className="text-muted-foreground text-sm">No jobs found. Try broadening your search parameters.</p>
                : searchResults.map((job, i) => <JobCard key={i} job={job} resumeId={resumeId} />)
              }
            </div>
          )}

          {searchResults === null && savedJobs.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{savedJobs.length} saved jobs</h2>
              {savedJobs.map((job, i) => <JobCard key={i} job={job} resumeId={resumeId} />)}
            </div>
          )}

          {searchResults === null && savedJobs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Set your search parameters above and click Find Jobs.</p>
            </div>
          )}
        </TabsContent>
        {/* Community tab */}
        <TabsContent value="community" className="space-y-4 mt-4">
          <CommunityJobs userProfile={linkedinProfile} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
