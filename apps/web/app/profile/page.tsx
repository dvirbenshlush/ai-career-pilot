'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Save, User } from 'lucide-react'

interface Profile {
  summary: string
  achievements: string[]
  skills: string[]
  certifications: string[]
  languages: string[]
  extra_notes: string
}

const EMPTY: Profile = {
  summary: '',
  achievements: [],
  skills: [],
  certifications: [],
  languages: [],
  extra_notes: '',
}

function TagList({
  label,
  placeholder,
  items,
  onChange,
}: {
  label: string
  placeholder: string
  items: string[]
  onChange: (next: string[]) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (!v || items.includes(v)) return
    onChange([...items, v])
    setInput('')
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          className="text-sm"
        />
        <Button variant="outline" size="sm" onClick={add} type="button">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map(item => (
            <Badge key={item} variant="secondary" className="gap-1 pr-1">
              {item}
              <button
                type="button"
                onClick={() => onChange(items.filter(i => i !== item))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function AchievementList({
  items,
  onChange,
}: {
  items: string[]
  onChange: (next: string[]) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (!v) return
    onChange([...items, v])
    setInput('')
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">הישגים בולטים</span>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="לדוגמה: הגדלתי מכירות ב-40% תוך רבעון"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          className="text-sm"
        />
        <Button variant="outline" size="sm" onClick={add} type="button">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then((data: Partial<Profile>) => {
        setProfile({ ...EMPTY, ...data })
        setLoading(false)
      })
  }, [])

  const set = useCallback(<K extends keyof Profile>(key: K, val: Profile[K]) => {
    setProfile(p => ({ ...p, [key]: val }))
    setSaved(false)
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto py-10 px-4">
        <div className="h-8 w-40 bg-muted animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">פרופיל אישי</h1>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'שומר...' : saved ? '✓ נשמר' : 'שמור'}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        המידע כאן ישמש את ה-AI להשלמת טפסי מועמדות ולהעשרת קורות החיים והמכתבי הגישה שלך.
      </p>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">סיכום אישי</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={profile.summary}
              onChange={e => set('summary', e.target.value)}
              placeholder="2-3 משפטים שמתארים אותך מקצועית: תחום, ניסיון, חוזקות עיקריות..."
              rows={4}
              className="text-sm resize-none"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">הישגים בולטים</CardTitle>
          </CardHeader>
          <CardContent>
            <AchievementList
              items={profile.achievements}
              onChange={v => set('achievements', v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">כישורים</CardTitle>
          </CardHeader>
          <CardContent>
            <TagList
              label=""
              placeholder="לדוגמה: React, Python, ניהול צוות..."
              items={profile.skills}
              onChange={v => set('skills', v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">הסמכות וקורסים</CardTitle>
          </CardHeader>
          <CardContent>
            <TagList
              label=""
              placeholder="לדוגמה: AWS Solutions Architect, Scrum Master..."
              items={profile.certifications}
              onChange={v => set('certifications', v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">שפות</CardTitle>
          </CardHeader>
          <CardContent>
            <TagList
              label=""
              placeholder="לדוגמה: עברית - שפת אם, אנגלית - גבוהה..."
              items={profile.languages}
              onChange={v => set('languages', v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">הערות נוספות ל-AI</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={profile.extra_notes}
              onChange={e => set('extra_notes', e.target.value)}
              placeholder="כל מידע שחשוב לך שה-AI ידע: העדפות עבודה, מאפיינים אישיים, מה אתה מחפש..."
              rows={3}
              className="text-sm resize-none"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'שומר...' : saved ? '✓ נשמר בהצלחה' : 'שמור פרופיל'}
        </Button>
      </div>
    </div>
  )
}
