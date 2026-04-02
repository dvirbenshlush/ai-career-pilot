import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InterviewPageClient } from './InterviewPageClient'

export default async function InterviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: sessions }, { data: savedJobs }] = await Promise.all([
    supabase
      .from('interview_sessions')
      .select('*, job_descriptions(title, company)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('job_descriptions')
      .select('id, title, company, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Interview Coach</h1>
        <p className="text-muted-foreground mt-1">Generate AI-tailored interview questions for any role</p>
      </div>
      <InterviewPageClient sessions={sessions || []} savedJobs={savedJobs || []} />
    </div>
  )
}
