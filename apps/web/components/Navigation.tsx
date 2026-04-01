import Link from 'next/link'
import { FileText, MessageSquare, Search, Calendar, Rocket } from 'lucide-react'

export function Navigation() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <Rocket className="h-5 w-5 text-primary" />
          AI Career Pilot
        </Link>
        <div className="flex items-center gap-1">
          {[
            { href: '/resume', icon: FileText, label: 'Resume' },
            { href: '/interview', icon: MessageSquare, label: 'Interview' },
            { href: '/jobs', icon: Search, label: 'Jobs' },
            { href: '/calendar', icon: Calendar, label: 'Calendar' },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
