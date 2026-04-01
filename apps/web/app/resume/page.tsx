import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ResumePageClient } from './ResumePageClient'
import { Skeleton } from '@/components/ui/skeleton'

export default async function ResumePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: resumes } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Resume Matcher</h1>
        <p className="text-muted-foreground mt-1">Upload your resume and analyze it against any job description</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ResumePageClient resumes={resumes || []} />
      </Suspense>
    </div>
  )
}
