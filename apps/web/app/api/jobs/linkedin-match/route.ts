import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tavily } from '@tavily/core'
import { groqChat } from '@/lib/ai/groq'
import { jsonrepair } from 'jsonrepair'

interface TavilyResult {
  title: string
  url: string
  content: string
}

interface JobResult {
  title: string
  company: string
  location: string
  url: string
  salary_range: string
  remote: boolean
  match_score: number
  tags: string[]
  snippet: string
  why_match: string
}

interface ProfileSummary {
  name: string
  current_title: string
  skills: string[]
  experience_years: number
  industries: string[]
  education: string
  languages: string[]
  summary: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    profileText,
    salary,
    jobType,
    workMode,
    location,
    experienceLevel,
  } = await request.json()

  if (!profileText || profileText.trim().length < 50) {
    return NextResponse.json({ error: 'Profile text is required' }, { status: 400 })
  }
  if (!process.env.TAVILY_API_KEY) return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 500 })

  // Step 2: Extract structured profile summary with Groq
  let profile: ProfileSummary
  try {
    const result = await groqChat({
      messages: [
        { role: 'system', content: 'You are a JSON API. Respond with valid JSON only — no markdown, no explanation.' },
        {
          role: 'user', content: `Extract a structured professional summary from this LinkedIn profile.

PROFILE:
${profileText.slice(0, 3000)}

Return JSON:
{
  "name": "full name",
  "current_title": "current or most recent job title",
  "skills": ["skill1", "skill2", ...up to 15 most relevant skills],
  "experience_years": <total years of work experience as integer>,
  "industries": ["industry1", "industry2"],
  "education": "highest degree and field",
  "languages": ["language1", "language2"],
  "summary": "2-3 sentence professional summary"
}`
        },
      ],
      max_tokens: 1000,
    })
    profile = JSON.parse(jsonrepair(result.choices[0]?.message?.content ?? '{}')) as ProfileSummary
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Profile analysis failed: ' + msg }, { status: 500 })
  }

  // Step 3: Build targeted LinkedIn Jobs search query
  const topSkills = (profile.skills || []).slice(0, 4).join(' ')
  const title = profile.current_title || ''
  const workModeClause = workMode === 'remote' ? 'remote' : workMode === 'hybrid' ? 'hybrid' : workMode === 'onsite' ? 'on-site' : ''
  const locationClause = location ? location : ''
  const salaryClause = salary ? `salary ${salary}` : ''
  const expClause = experienceLevel === 'senior' ? 'senior' : experienceLevel === 'mid' ? 'mid-level' : experienceLevel === 'entry' ? 'entry level' : ''

  const jobTypeKeywords: Record<string, string> = {
    administrative: 'administrative coordinator assistant manager',
    physical: 'technician operator maintenance warehouse',
    technical: 'engineer developer analyst',
    creative: 'designer content writer marketing',
    sales: 'sales account executive business development',
    management: 'manager director VP team lead',
    medical: 'nurse doctor therapist clinical',
  }
  const jobTypeClause = jobType && jobType !== 'any' ? jobTypeKeywords[jobType] ?? '' : ''

  const query = `${expClause} ${title} ${topSkills} ${jobTypeClause} ${workModeClause} ${locationClause} ${salaryClause} job opening site:linkedin.com/jobs`
    .replace(/\s+/g, ' ').trim()

  // Step 4: Search LinkedIn jobs via Tavily
  let searchResults: TavilyResult[] = []
  try {
    const tc = tavily({ apiKey: process.env.TAVILY_API_KEY })
    const response = await tc.search(query, { maxResults: 20, searchDepth: 'basic' })
    searchResults = (response.results as TavilyResult[]) || []
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Job search failed: ' + msg }, { status: 500 })
  }

  if (searchResults.length === 0) {
    return NextResponse.json({ jobs: [], profile })
  }

  // Step 5: Score and rank with Groq — pick top 10
  // Keep snippets short so the full request stays under llama-3.1-8b-instant's 6K TPM hard cap
  const snippets = searchResults
    .slice(0, 15)
    .map((r, i) => `[${i}] URL: ${r.url}\nTitle: ${r.title}\nSnippet: ${r.content?.slice(0, 200)}`)
    .join('\n\n')

  let jobs: JobResult[] = []
  try {
    const result = await groqChat({
      messages: [
        { role: 'system', content: 'You are a JSON API. Respond with valid JSON only — no markdown, no explanation.' },
        {
          role: 'user', content: `You are a career advisor. Match these LinkedIn job results to this candidate profile and return the best 10 matches.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

FILTERS: ${[
  jobType && jobType !== 'any' ? `job type: ${jobType}` : '',
  workMode && workMode !== 'any' ? `work mode: ${workMode}` : '',
  location ? `location: ${location}` : '',
  salary ? `min salary: ${salary}` : '',
  experienceLevel && experienceLevel !== 'any' ? `level: ${experienceLevel}` : '',
].filter(Boolean).join(', ') || 'none'}

JOB RESULTS:
${snippets}

For each result that is a real LinkedIn job posting, evaluate fit against the candidate profile.
Return the top 10 best matches sorted by match_score descending.

Return JSON:
{
  "jobs": [
    {
      "title": "job title",
      "company": "company name",
      "location": "location or Remote",
      "url": "exact URL from results",
      "salary_range": "if mentioned else empty string",
      "remote": true/false,
      "match_score": <0-100 based on profile fit>,
      "tags": ["up to 5 relevant skill tags"],
      "snippet": "1-2 sentence role description",
      "why_match": "1 sentence explaining why this fits the candidate"
    }
  ]
}`
        },
      ],
      max_tokens: 2000,
      // No response_format here — Groq rejects the whole response on any malformed entry.
      // We extract and repair JSON manually instead.
    })
    const raw = result.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(jsonrepair(raw))
    jobs = (parsed.jobs || []).slice(0, 10) as JobResult[]
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Job matching failed: ' + msg }, { status: 500 })
  }

  // Save to job_opportunities
  if (jobs.length > 0) {
    await supabase.from('job_opportunities').insert(
      jobs.map(j => ({
        user_id: user.id,
        title: j.title,
        company: j.company,
        location: j.location || location || 'Unknown',
        salary_range: j.salary_range || null,
        remote: j.remote ?? false,
        url: j.url,
        match_score: j.match_score,
        tags: j.tags || [],
      }))
    )
  }

  return NextResponse.json({ jobs, profile })
}
