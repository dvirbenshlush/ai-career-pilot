'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Calendar, Briefcase } from 'lucide-react'

type Status = 'applied' | 'interviewing' | 'offer' | 'rejected'

interface Application {
  id: string
  status: Status
  notes: string | null
  updated_at: string
  job_opportunities: {
    title: string
    company: string
    location: string
    url: string
  } | null
}

const COLUMNS: { status: Status; label: string; color: string; bg: string }[] = [
  { status: 'applied',      label: 'Applied',      color: 'text-blue-600',  bg: 'bg-blue-50' },
  { status: 'interviewing', label: 'Interviewing',  color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { status: 'offer',        label: 'Offer',         color: 'text-green-600', bg: 'bg-green-50' },
  { status: 'rejected',     label: 'Rejected',      color: 'text-red-600',   bg: 'bg-red-50' },
]

const STATUS_BADGE: Record<Status, string> = {
  applied:      'bg-blue-100 text-blue-700',
  interviewing: 'bg-yellow-100 text-yellow-700',
  offer:        'bg-green-100 text-green-700',
  rejected:     'bg-red-100 text-red-700',
}

export function CalendarPageClient({ applications }: { applications: Application[] }) {
  const [items, setItems] = useState(applications)

  const updateStatus = async (id: string, status: Status) => {
    setItems(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  const byStatus = (status: Status) => items.filter(a => a.status === status)

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No applications yet. Jobs you apply to will appear here.</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/jobs'}>
          Find Jobs
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4">
      {COLUMNS.map(col => (
        <div key={col.status} className="space-y-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${col.bg}`}>
            <span className={`font-semibold text-sm ${col.color}`}>{col.label}</span>
            <span className={`ml-auto text-xs font-medium ${col.color}`}>{byStatus(col.status).length}</span>
          </div>

          {byStatus(col.status).map(app => (
            <Card key={app.id} className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold leading-tight">
                  {app.job_opportunities?.title ?? 'Untitled Role'}
                </CardTitle>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {app.job_opportunities?.company} · {app.job_opportunities?.location}
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {app.notes && <p className="text-xs text-muted-foreground">{app.notes}</p>}
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(app.updated_at).toLocaleDateString()}
                </p>
                <div className="flex flex-wrap gap-1">
                  {COLUMNS.filter(c => c.status !== col.status).map(c => (
                    <button
                      key={c.status}
                      onClick={() => updateStatus(app.id, c.status)}
                      className={`text-xs px-2 py-0.5 rounded-full border hover:opacity-80 transition-opacity ${STATUS_BADGE[c.status]}`}
                    >
                      → {c.label}
                    </button>
                  ))}
                </div>
                {app.job_opportunities?.url && (
                  <a
                    href={app.job_opportunities.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> View job
                  </a>
                )}
              </CardContent>
            </Card>
          ))}

          {byStatus(col.status).length === 0 && (
            <div className="border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
              No applications
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
