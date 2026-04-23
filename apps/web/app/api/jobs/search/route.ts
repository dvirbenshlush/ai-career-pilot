import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tavily } from '@tavily/core'
import { groqChat } from '@/lib/ai/groq'
import { jsonrepair } from 'jsonrepair'

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
}

interface ScoredJob {
  title: string
  company: string
  location: string
  url: string
  salary_range: string
  remote: boolean
  match_score: number
  tags: string[]
  snippet: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, skills, location, remote, salaryMin } = await request.json()

  if (!role) return NextResponse.json({ error: 'Role is required' }, { status: 400 })

  if (!process.env.TAVILY_API_KEY) {
    return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 500 })
  }

  // Build search query
  const remoteClause = remote ? 'remote' : ''
  const locationClause = location ? `in ${location}` : ''
  const salaryClause = salaryMin ? `salary ${salaryMin}+` : ''
  const skillsClause = skills ? skills : ''
  const query = `${role} job opening ${skillsClause} ${remoteClause} ${locationClause} ${salaryClause} site:linkedin.com OR site:glassdoor.com OR site:indeed.com OR site:jobs.lever.co OR site:greenhouse.io`
    .replace(/\s+/g, ' ').trim()

  // Search with Tavily
  let results: TavilyResult[] = []
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
    const response = await client.search(query, {
      maxResults: 15,
      searchDepth: 'basic',
    })
    results = (response.results as TavilyResult[]) || []
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Search failed: ' + msg }, { status: 500 })
  }

  if (results.length === 0) {
    return NextResponse.json({ jobs: [] })
  }

  // Use Groq to extract and score each result
  const snippets = results.map((r, i) => `[${i}] URL: ${r.url}\nTitle: ${r.title}\nSnippet: ${r.content?.slice(0, 400)}`).join('\n\n')

  let scoredJobs: ScoredJob[] = []
  try {
    const aiResult = await groqChat({
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API. Respond with valid JSON only — no markdown, no explanation.',
        },
        {
          role: 'user',
          content: `You are a job search assistant. Extract structured job data from these search results and score each one based on how well it matches the target role.

TARGET: ${role}${skills ? `, skills/experience: ${skills}` : ''}${location ? `, location: ${location}` : ''}${remote ? ', remote preferred' : ''}${salaryMin ? `, min salary: ${salaryMin}` : ''}

SEARCH RESULTS:
${snippets}

For each result that is actually a job posting (skip news articles, blog posts, or non-job pages), extract:
- title: job title
- company: company name (extract from URL or content)
- location: location or "Remote" if remote
- url: the URL
- salary_range: salary if mentioned, else empty string
- remote: true if remote/hybrid, false otherwise
- match_score: 0-100 score based on how well it matches the target role and skills
- tags: array of up to 5 relevant tech/skill tags from the posting
- snippet: 1-2 sentence description of the role

Return JSON: { "jobs": [ {...}, ... ] }
Only include actual job postings. Skip anything that is not a job listing.`,
        },
      ],
      max_tokens: 2000,
      // No response_format — Groq rejects on any malformed entry; we repair manually.
    })

    const raw = aiResult.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(jsonrepair(raw))
    scoredJobs = (parsed.jobs || []) as ScoredJob[]
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AI scoring failed: ' + msg }, { status: 500 })
  }

  // Sort by match score descending
  scoredJobs.sort((a, b) => b.match_score - a.match_score)

  // Save to DB
  if (scoredJobs.length > 0) {
    await supabase.from('job_opportunities').insert(
      scoredJobs.map(j => ({
        user_id: user.id,
        title: j.title || role,
        company: j.company || '',
        location: j.location || location || '',
        salary_range: j.salary_range || null,
        remote: j.remote ?? false,
        url: j.url,
        match_score: j.match_score,
        tags: j.tags || [],
        source: 'search',
        snippet: j.snippet || null,
      }))
    )
  }

  return NextResponse.json({ jobs: scoredJobs })
}
