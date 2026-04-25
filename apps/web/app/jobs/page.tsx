import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { JobsPageClient } from './JobsPageClient'

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: savedJobs }, { data: latestResume }] = await Promise.all([
    supabase
      .from('job_opportunities')
      .select('*')
      .eq('user_id', user.id)
      .order('found_at', { ascending: false })
      .limit(50),
    supabase
      .from('resumes')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Job Hunter</h1>
        <span className="text-sm text-muted-foreground hidden sm:block">— AI agent that searches and scores jobs matching your profile</span>
      </div>
      <JobsPageClient savedJobs={savedJobs || []} resumeId={latestResume?.id ?? null} />
    </div>
  )
}
