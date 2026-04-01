import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarPageClient } from './CalendarPageClient'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: applications } = await supabase
    .from('applications')
    .select('*, job_opportunities(title, company, location, url)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Interview Calendar</h1>
        <p className="text-muted-foreground mt-1">Track your application pipeline from Applied to Offer</p>
      </div>
      <CalendarPageClient applications={applications || []} />
    </div>
  )
}
