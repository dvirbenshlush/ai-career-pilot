'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, MessageSquare, Search, Calendar, Rocket, Menu, X, LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/resume',    icon: FileText,      label: 'Resume' },
  { href: '/interview', icon: MessageSquare, label: 'Interview' },
  { href: '/jobs',      icon: Search,        label: 'Jobs' },
  { href: '/calendar',  icon: Calendar,      label: 'Calendar' },
  { href: '/profile',   icon: User,          label: 'Profile' },
]

export function Navigation() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg" onClick={() => setOpen(false)}>
          <Rocket className="h-5 w-5 text-primary" />
          AI Career Pilot
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
            title="התנתק"
          >
            <LogOut className="h-4 w-4" />
            יציאה
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t bg-background px-4 py-2 flex flex-col gap-1">
          {NAV_LINKS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <button
            onClick={() => { setOpen(false); handleLogout() }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            יציאה
          </button>
        </div>
      )}
    </nav>
  )
}
