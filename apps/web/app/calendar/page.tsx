import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarTab } from '@/components/calendar/CalendarTab'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">לוח שנה — ראיונות</h1>
        <p className="text-muted-foreground mt-1">תכנן וצפה בכל הראיונות שלך</p>
      </div>
      <CalendarTab />
    </div>
  )
}
