import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { JobsPageClient } from './JobsPageClient'

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: savedJobs } = await supabase
    .from('job_opportunities')
    .select('*')
    .eq('user_id', user.id)
    .order('found_at', { ascending: false })
    .limit(50)

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Job Hunter</h1>
        <p className="text-muted-foreground mt-1">AI agent that searches and scores jobs matching your profile</p>
      </div>
      <JobsPageClient savedJobs={savedJobs || []} />
    </div>
  )
}
