import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groqChat } from '@/lib/ai/groq'

// Step 1: Extract everything from the raw resume text into clean structured JSON
const EXTRACT_RESUME_PROMPT = (resumeText: string) => `
You are a data extraction engine. Extract ALL information from the resume below into structured JSON.
Do not summarize, skip, or rephrase anything — extract verbatim.

RESUME TEXT:
${resumeText}

Return JSON:
{
  "name": "full name",
  "email": "email or empty string",
  "phone": "phone or empty string",
  "location": "city/country or empty string",
  "linkedin": "url or empty string",
  "experience": [
    {
      "title": "exact job title",
      "company": "exact company name",
      "duration": "exact dates",
      "bullets": ["every bullet point verbatim"]
    }
  ],
  "skills": ["every skill mentioned"],
  "education": [
    { "degree": "exact degree", "institution": "exact institution", "year": "exact year" }
  ],
  "certifications": ["every certification if any"],
  "languages": ["every language and level if any"],
  "projects": [{ "name": "project name", "description": "exact description" }],
  "extras": { "section name": ["items"] }
}
`

// Step 2: Tailor the structured CV to the job
const TAILOR_CV_PROMPT = (
  structuredCV: string,
  jobTitle: string,
  company: string,
  jobDescription: string,
  language: string
) => `
You are a senior professional CV writer. You have a candidate's full structured CV and a target job. Your task is to produce a tailored version optimized for this specific role.

OUTPUT LANGUAGE: ${language === 'he' ? 'Hebrew (עברית) — write all text in fluent, professional Hebrew. Use standard Israeli CV conventions.' : 'English — write in clear, professional British/American English.'}

TARGET ROLE: ${jobTitle} at ${company}

JOB DESCRIPTION:
${jobDescription}

CANDIDATE'S FULL CV DATA:
${structuredCV}

TAILORING INSTRUCTIONS:
1. SUMMARY: Write 3 strong sentences. Sentence 1: years of experience + main domain. Sentence 2: 2-3 most relevant skills/achievements that match this job. Sentence 3: what value the candidate brings to this specific role.
2. EXPERIENCE: Keep ALL jobs. For each job write exactly 3-4 bullets:
   - Start every bullet with a strong action verb (Led, Built, Designed, Improved, Managed, Delivered...)
   - Each bullet must be specific and concrete — include numbers/scale/impact from the original where available
   - Rephrase to use keywords from the job description where genuinely applicable
   - Put the most relevant bullet first
   - NEVER invent facts, numbers, technologies, or companies not in the original CV
3. SKILLS: Keep all original skills. Sort so that skills matching the JD appear first.
4. All other sections (education, certifications, languages, projects): keep exactly as-is, translate language if needed.

LENGTH: Target exactly 1 to 1.5 A4 pages. 3-4 bullets per job, 3-sentence summary, skills on 1-2 lines.

Return ONLY valid JSON:
{
  "name": "from CV",
  "email": "from CV",
  "phone": "from CV",
  "location": "from CV",
  "linkedin": "from CV",
  "summary": "3 tailored sentences",
  "experience": [
    { "title": "from CV", "company": "from CV", "duration": "from CV", "bullets": ["3-4 tailored bullets"] }
  ],
  "skills": ["all skills sorted by relevance"],
  "education": [{ "degree": "from CV", "institution": "from CV", "year": "from CV" }],
  "certifications": ["from CV if any"],
  "languages": ["from CV if any"],
  "projects": [{ "name": "from CV", "description": "from CV" }],
  "extras": { "section": ["items"] }
}
`

function buildHTML(cv: Record<string, unknown>, language: string, jobTitle: string, company: string): string {
  const isHebrew = language === 'he'
  const dir = isHebrew ? 'rtl' : 'ltr'
  const align = isHebrew ? 'right' : 'left'
  const fontFamily = isHebrew
    ? 'Arial, Helvetica Neue, sans-serif'
    : 'Georgia, Times New Roman, serif'

  const name = cv.name as string || ''
  const email = cv.email as string || ''
  const phone = cv.phone as string || ''
  const location = cv.location as string || ''
  const linkedin = cv.linkedin as string || ''
  const summary = cv.summary as string || ''
  const experience = (cv.experience as { title: string; company: string; duration: string; bullets: string[] }[]) || []
  const skills = (cv.skills as string[]) || []
  const education = (cv.education as { degree: string; institution: string; year: string }[]) || []
  const certifications = (cv.certifications as string[]) || []
  const languages = (cv.languages as string[]) || []
  const projects = (cv.projects as { name: string; description: string }[]) || []
  const extras = (cv.extras as Record<string, string[]>) || {}

  const contact = [email, phone, location, linkedin].filter(Boolean).join(' | ')

  const sectionTitle = (title: string) => `
    <div class="section-title">${title}</div>
    <div class="divider"></div>
  `

  const experienceHTML = experience.length ? `
    ${sectionTitle(isHebrew ? 'ניסיון תעסוקתי' : 'EXPERIENCE')}
    ${experience.map(exp => `
      <div class="exp-block">
        <div class="exp-header">
          <span class="exp-title">${exp.title} — ${exp.company}</span>
          <span class="exp-right">${exp.duration}</span>
        </div>
        <ul class="bullets">
          ${(exp.bullets || []).map(b => `<li>${b}</li>`).join('')}
        </ul>
      </div>
    `).join('')}
  ` : ''

  const skillsHTML = skills.length ? `
    ${sectionTitle(isHebrew ? 'כישורים' : 'SKILLS')}
    <p class="skills-list">${skills.join(' • ')}</p>
  ` : ''

  const educationHTML = education.length ? `
    ${sectionTitle(isHebrew ? 'השכלה' : 'EDUCATION')}
    ${education.map(edu => `
      <div class="edu-block">
        <div class="exp-header">
          <span class="exp-title">${edu.degree} — ${edu.institution}</span>
          <span class="exp-right">${edu.year}</span>
        </div>
      </div>
    `).join('')}
  ` : ''

  const certsHTML = certifications.length ? `
    ${sectionTitle(isHebrew ? 'הסמכות' : 'CERTIFICATIONS')}
    <ul class="bullets">${certifications.map(c => `<li>${c}</li>`).join('')}</ul>
  ` : ''

  const languagesHTML = languages.length ? `
    ${sectionTitle(isHebrew ? 'שפות' : 'LANGUAGES')}
    <p class="skills-list">${languages.join(' • ')}</p>
  ` : ''

  const projectsHTML = projects.length ? `
    ${sectionTitle(isHebrew ? 'פרויקטים' : 'PROJECTS')}
    ${projects.map(p => `
      <div class="exp-block">
        <div class="exp-title">${p.name}</div>
        <p class="project-desc">${p.description}</p>
      </div>
    `).join('')}
  ` : ''

  const extrasHTML = Object.entries(extras).map(([key, items]) => `
    ${sectionTitle(key)}
    <ul class="bullets">${(items || []).map(i => `<li>${i}</li>`).join('')}</ul>
  `).join('')

  return `<!DOCTYPE html>
<html lang="${isHebrew ? 'he' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <title>${name} — ${jobTitle} at ${company}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 210mm; }
    body {
      font-family: ${fontFamily};
      font-size: 10.5pt;
      color: #1a1a2e;
      direction: ${dir};
      text-align: ${align};
      padding: 18mm 18mm 16mm 18mm;
      line-height: 1.55;
      min-height: 250mm;
    }
    .name {
      font-size: 22pt;
      font-weight: bold;
      text-align: center;
      color: #1a1a2e;
      margin-bottom: 3px;
    }
    .contact {
      font-size: 9pt;
      color: #6b7280;
      text-align: center;
    }
    .header-divider {
      border: none;
      border-top: 2.5px solid #4f46e5;
      margin: 10px 0 4px;
    }
    .section-title {
      font-size: 9.5pt;
      font-weight: bold;
      color: #4f46e5;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-top: 12px;
    }
    .divider {
      border-top: 1px solid #e5e7eb;
      margin: 2px 0 5px;
    }
    .summary { font-size: 10pt; color: #374151; line-height: 1.6; margin-bottom: 2px; }
    .exp-block { margin-bottom: 9px; }
    .exp-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; flex-direction: ${isHebrew ? 'row-reverse' : 'row'}; }
    .exp-title { font-weight: bold; font-size: 10pt; color: #111827; }
    .exp-right { font-size: 9pt; color: #6b7280; }
    .bullets { padding-${isHebrew ? 'right' : 'left'}: 16px; margin-top: 2px; }
    .bullets li { font-size: 9.5pt; color: #374151; margin-bottom: 3px; line-height: 1.5; }
    .skills-list { font-size: 10pt; color: #374151; line-height: 1.7; }
    .edu-block { margin-bottom: 5px; }
    .project-desc { font-size: 9.5pt; color: #374151; margin-top: 2px; line-height: 1.5; }
    @media print {
      html, body { width: 210mm; }
      @page { margin: 0; size: A4; }
      body { padding: 14mm 16mm; }
    }
  </style>
</head>
<body>
  <div class="name">${name}</div>
  <div class="contact">${contact}</div>
  <hr class="header-divider" />

  ${summary ? `
    ${sectionTitle(isHebrew ? 'תקציר מקצועי' : 'PROFESSIONAL SUMMARY')}
    <p class="summary">${summary}</p>
  ` : ''}

  ${experienceHTML}
  ${skillsHTML}
  ${educationHTML}
  ${certsHTML}
  ${projectsHTML}
  ${languagesHTML}
  ${extrasHTML}

  <script>window.onload = () => window.print()</script>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  try {
    return await handlePost(request)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[generate-cv] unhandled error:', msg)
    return NextResponse.json({ error: 'Unexpected error: ' + msg }, { status: 500 })
  }
}

async function handlePost(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { resumeId, jobTitle, company, jobDescription, tailored_suggestions, language = 'en' } = await request.json()

  if (!resumeId || !jobDescription) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: resume } = await supabase
    .from('resumes')
    .select('parsed_text')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single()

  if (!resume?.parsed_text) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  }

  // Strip DOCX placeholder if present
  const resumeText = resume.parsed_text.startsWith('DOCX parsing')
    ? ''
    : resume.parsed_text

  if (!resumeText.trim()) {
    return NextResponse.json({ error: 'Resume has no parsed text. Please upload a PDF for best results.' }, { status: 400 })
  }

  // Truncate to ~3 000 chars to stay within model token-per-minute limits on fallback models
  const truncatedResumeText = resumeText.slice(0, 3000)

  // Replace Hebrew gershayim written as ASCII " so the model doesn't break JSON
  // e.g. בע"מ → בע״מ, סמנכ"ל → סמנכ״ל
  const safeResumeText = truncatedResumeText.replace(/(\w)"(\w)/g, '$1״$2')

  const jsonSystem = 'You are a JSON API. Respond with valid JSON only — no markdown, no code fences. CRITICAL: never use double-quote characters (") inside string values. For Hebrew abbreviations like בע"מ write בע״מ using the Unicode gershayim character ״ (U+05F4) instead.'

  // Step 1: Extract structured data from raw resume text
  let structuredCV: string
  try {
    const extractResult = await groqChat({
      messages: [
        { role: 'system', content: jsonSystem },
        { role: 'user', content: EXTRACT_RESUME_PROMPT(safeResumeText) },
      ],
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })
    structuredCV = extractResult.choices[0]?.message?.content ?? '{}'
    JSON.parse(structuredCV)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Resume extraction failed: ' + msg }, { status: 500 })
  }

  // Step 2: Tailor the structured CV to the job
  let cvData: Record<string, unknown>
  try {
    const tailorResult = await groqChat({
      messages: [
        { role: 'system', content: jsonSystem },
        { role: 'user', content: TAILOR_CV_PROMPT(structuredCV, jobTitle, company, jobDescription, language) },
      ],
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    })
    const raw = tailorResult.choices[0]?.message?.content ?? '{}'
    // Repair: replace any unescaped " inside string values that slipped through
    const repaired = raw.replace(/:\s*"((?:[^"\\]|\\.)*)"/g, (_m, inner: string) => {
      const fixed = inner.replace(/(?<!\\)"/g, '״')
      return `: "${fixed}"`
    })
    cvData = JSON.parse(repaired)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'CV tailoring failed: ' + msg }, { status: 500 })
  }

  const html = buildHTML(cvData, language, jobTitle || '', company || '')
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
