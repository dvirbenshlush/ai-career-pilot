'use client'

import { useState } from 'react'
import { ResumeUpload } from '@/components/resume/ResumeUpload'
import { MatchAnalysis } from '@/components/resume/MatchAnalysis'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'
import type { Resume } from '@/types'

interface ResumePageClientProps {
  resumes: Resume[]
}

export function ResumePageClient({ resumes: initialResumes }: ResumePageClientProps) {
  const [resumes, setResumes] = useState<Resume[]>(initialResumes)
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(
    initialResumes[0]?.id || null
  )

  const handleUploadComplete = (resumeId: string) => {
    setSelectedResumeId(resumeId)
  }

  return (
    <div className="space-y-6">
      {resumes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Resumes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {resumes.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResumeId(r.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    selectedResumeId === r.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  {r.file_name}
                  <Badge variant="secondary" className="text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ResumeUpload onUploadComplete={handleUploadComplete} />

      {selectedResumeId && (
        <MatchAnalysis resumeId={selectedResumeId} />
      )}
    </div>
  )
}
