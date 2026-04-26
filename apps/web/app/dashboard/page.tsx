import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { FileText, MessageSquare, Search, Calendar, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ count: resumeCount }, { count: matchCount }] = await Promise.all([
    supabase.from('resumes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('match_results').select('*', { count: 'exact', head: true }),
  ])

  const modules = [
    {
      href: '/resume',
      icon: FileText,
      title: 'Resume Matcher',
      description: 'Upload your resume and get AI-powered match scores against any job description',
      badge: `${resumeCount || 0} resumes`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      href: '/interview',
      icon: MessageSquare,
      title: 'Interview Coach',
      description: 'Practice with AI-generated questions tailored to your target company and role',
      badge: 'AI Powered',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      href: '/jobs',
      icon: Search,
      title: 'Job Hunter',
      description: 'Autonomous agent that finds and scores jobs matching your profile daily',
      badge: 'Agent',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      href: '/calendar',
      icon: Calendar,
      title: 'Interview Calendar',
      description: 'Track your application pipeline from Applied to Offer in one visual board',
      badge: 'Gmail Sync',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ]

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">AI Career Pilot</h1>
        <p className="text-muted-foreground mt-1">Your autonomous job search command center</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${mod.bg}`}>
                    <mod.icon className={`h-6 w-6 ${mod.color}`} />
                  </div>
                  <Badge variant="secondary">{mod.badge}</Badge>
                </div>
                <CardTitle className="flex items-center justify-between mt-2">
                  {mod.title}
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </CardTitle>
                <CardDescription>{mod.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
