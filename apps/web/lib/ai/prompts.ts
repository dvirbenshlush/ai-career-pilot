export const RESUME_MATCH_PROMPT = (resumeText: string, jobDescription: string) => `
You are an expert technical recruiter and career coach. Analyze the following resume against the job description.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Provide a JSON response with this exact structure:
{
  "score": <number 0-100>,
  "matching_keywords": [<list of keywords found in both>],
  "missing_keywords": [<list of important keywords from JD missing in resume>],
  "strengths": [<3-5 bullet points of strong matches>],
  "gaps": [<3-5 bullet points of gaps or weaknesses>],
  "tailored_suggestions": "<detailed paragraph on how to tailor the resume for this role>"
}

Be precise, specific, and actionable. Focus on technical skills, tools, and measurable achievements.
`

export const INTERVIEW_COACH_PROMPT = (company: string, role: string, context: string) => `
You are a senior engineering interview coach with deep knowledge of ${company}.

Role: ${role}
Company Context: ${context}

Generate a comprehensive interview preparation guide in JSON:
{
  "company_insights": "<2-3 paragraphs about company culture, tech stack, interview style>",
  "technical_questions": [
    {
      "question": "<question>",
      "difficulty": "easy|medium|hard",
      "topic": "<topic area>",
      "ideal_answer_outline": "<key points to cover>"
    }
  ],
  "behavioral_questions": [
    {
      "question": "<STAR-format question>",
      "competency": "<leadership|collaboration|problem-solving|etc>",
      "ideal_answer_outline": "<key points>"
    }
  ],
  "prep_tips": [<5 specific tips for this company/role>]
}

Generate 8 technical questions and 5 behavioral questions.
`

export const ANSWER_FEEDBACK_PROMPT = (question: string, answer: string, role: string) => `
You are an interview coach evaluating a candidate's answer for a ${role} position.

Question: ${question}
Candidate's Answer: ${answer}

Provide constructive feedback in JSON:
{
  "score": <1-10>,
  "strengths": [<what they did well>],
  "improvements": [<specific things to improve>],
  "model_answer": "<an example of an excellent answer>",
  "follow_up_questions": [<2 follow-up questions an interviewer might ask>]
}
`
