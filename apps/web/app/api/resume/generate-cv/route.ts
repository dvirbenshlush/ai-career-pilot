import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const GENERATE_CV_PROMPT = (
  resumeText: string,
  jobTitle: string,
  company: string,
  jobDescription: string,
  suggestions: string,
  language: string
) => `
You are a senior professional CV writer specializing in adapting CVs for specific job applications.

YOUR GOAL: Produce a tailored CV that fills between 1 and 1.5 A4 pages — never shorter, never much longer.

WHAT YOU MUST DO:
1. Include EVERY job position, education entry, and section from the original CV — nothing may be omitted.
2. For each job, keep 3-5 bullet points. If the original has more, keep the most relevant ones to the target job. If fewer, expand slightly using context clues from the original.
3. Rephrase bullet points professionally to highlight relevant skills and achievements — use action verbs and quantify where possible based on original content. You may rephrase but NEVER fabricate facts, numbers, or technologies not mentioned in the original.
4. Reorder bullets within each job: most relevant to the target job comes first.
5. Write a strong 2-3 sentence professional summary using only facts from the CV.
6. Skills: include all original skills, put the most relevant ones first.
7. Output language: ${language === 'he' ? 'Hebrew (עברית) — write everything in fluent professional Hebrew' : 'English — write in fluent professional English'}

LENGTH CONTROL — CRITICAL:
- Target: 1 to 1.5 pages when printed on A4
- Each job: exactly 3-5 bullet points (not more, not fewer)
- Summary: exactly 2-3 sentences
- Skills: single line or two, no long lists
- If the original CV is very short: expand bullets with professional phrasing to fill at least 1 page
- If the original CV is very long: trim to 3-4 bullets per job, keep all jobs

INTEGRITY RULES:
- Every fact, company name, job title, date, degree, and technology must come from the original CV
- You may rephrase and improve language, but never invent new facts
- Do not add skills, tools, or technologies not mentioned in the original

ORIGINAL CV:
${resumeText}

TARGET JOB: ${jobTitle} at ${company}
JOB DESCRIPTION:
${jobDescription}

KEYWORDS TO HIGHLIGHT (use these naturally if they appear in the original CV):
${suggestions}

Return ONLY valid JSON — no markdown, no explanation:
{
  "name": "name from CV",
  "email": "email from CV",
  "phone": "phone from CV",
  "location": "location from CV",
  "linkedin": "linkedin from CV or empty string",
  "summary": "2-3 sentence professional summary targeting this role",
  "experience": [
    {
      "title": "job title from CV",
      "company": "company from CV",
      "duration": "dates from CV",
      "bullets": ["3-5 rephrased bullets, most relevant first"]
    }
  ],
  "skills": ["all skills from CV, most relevant first"],
  "education": [
    { "degree": "degree from CV", "institution": "institution from CV", "year": "year from CV" }
  ],
  "certifications": ["only if exist in original"],
  "languages": ["only if exist in original"],
  "projects": [{ "name": "project name", "description": "1 sentence description" }],
  "extras": { "section name": ["items"] }
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

  let cvData: Record<string, unknown>
  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API. Respond with valid JSON only — no markdown, no code fences, no explanation.',
        },
        {
          role: 'user',
          content: GENERATE_CV_PROMPT(resume.parsed_text, jobTitle, company, jobDescription, tailored_suggestions || '', language),
        },
      ],
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })
    cvData = JSON.parse(result.choices[0]?.message?.content ?? '{}')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AI error: ' + msg }, { status: 500 })
  }

  const html = buildHTML(cvData, language, jobTitle || '', company || '')
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
