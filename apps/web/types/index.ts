export interface Resume {
  id: string
  user_id: string
  file_name: string
  file_url: string
  parsed_text: string | null
  created_at: string
}

export interface JobDescription {
  id: string
  user_id: string
  title: string
  company: string
  description: string
  url: string | null
  created_at: string
}

export interface MatchResult {
  id: string
  resume_id: string
  job_id: string
  score: number
  missing_keywords: string[]
  tailored_suggestions: string | null
  created_at: string
}

export interface InterviewSession {
  id: string
  user_id: string
  job_id: string
  questions: InterviewQuestion[]
  created_at: string
}

export interface InterviewQuestion {
  id: string
  type: 'technical' | 'behavioral'
  question: string
  answer: string | null
  feedback: string | null
}

export interface JobOpportunity {
  id: string
  title: string
  company: string
  location: string
  salary_range: string | null
  remote: boolean
  url: string
  match_score: number
  tags: string[]
  found_at: string
}

export interface ApplicationStatus {
  id: string
  job_id: string
  status: 'applied' | 'interviewing' | 'offer' | 'rejected'
  updated_at: string
}
