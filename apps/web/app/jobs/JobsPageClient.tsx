'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, ExternalLink, MapPin, DollarSign, Wifi } from 'lucide-react'

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
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}% match</span>
}

export function JobsPageClient({ savedJobs }: { savedJobs: Job[] }) {
  const [role, setRole] = useState('')
  const [skills, setSkills] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [salaryMin, setSalaryMin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Job[] | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, skills, location, remote, salaryMin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data.jobs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const displayJobs = results ?? savedJobs

  return (
    <div className="space-y-6">
      {/* Search form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Parameters
          </CardTitle>
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
                <Input placeholder="e.g. Tel Aviv, NYC, or leave empty" value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Min Salary</Label>
                <Input placeholder="e.g. $120,000 or ₪30,000/month" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remote"
                checked={remote}
                onChange={e => setRemote(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="remote" className="cursor-pointer">Remote / Hybrid preferred</Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching jobs...</>
                : <><Search className="mr-2 h-4 w-4" /> Find Jobs</>
              }
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {results !== null && results.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No jobs found. Try broadening your search parameters.</p>
        </div>
      )}

      {displayJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {results ? `${results.length} jobs found` : `${savedJobs.length} saved jobs`}
            </h2>
            {results && <p className="text-sm text-muted-foreground">Sorted by match score</p>}
          </div>

          {displayJobs.map((job, i) => (
            <Card key={job.id ?? i} className="hover:shadow-sm transition-shadow">
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
                      {job.location && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                      )}
                      {job.salary_range && (
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{job.salary_range}</span>
                      )}
                    </div>
                    {job.snippet && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{job.snippet}</p>}
                    {job.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {job.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                      </div>
                    )}
                  </div>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Apply
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {results === null && savedJobs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Set your search parameters above and click Find Jobs.</p>
        </div>
      )}
    </div>
  )
}
