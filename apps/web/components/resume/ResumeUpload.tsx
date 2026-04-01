'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface ResumeUploadProps {
  onUploadComplete?: (resumeId: string) => void
}

export function ResumeUpload({ onUploadComplete }: ResumeUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleFile = useCallback((f: File) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowed.includes(f.type)) {
      setError('Only PDF and DOCX files are supported')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB')
      return
    }
    setFile(f)
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading')
    setProgress(20)

    const formData = new FormData()
    formData.append('file', file)

    try {
      setProgress(50)
      setStatus('parsing')

      const res = await fetch('/api/resume/parse', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setProgress(100)
      setStatus('done')
      onUploadComplete?.(data.resume.id)
      router.refresh()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload Resume
        </CardTitle>
        <CardDescription>PDF or DOCX, max 10MB</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('resume-input')?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${file ? 'bg-muted/30' : ''}
          `}
        >
          <input
            id="resume-input"
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-primary" />
              <p className="font-medium">{file.name}</p>
              <Badge variant="secondary">{(file.size / 1024).toFixed(0)} KB</Badge>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-10 w-10" />
              <p className="font-medium">Drop your resume here or click to browse</p>
              <p className="text-sm">PDF or DOCX</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {(status === 'uploading' || status === 'parsing') && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{status === 'uploading' ? 'Uploading...' : 'Parsing with AI...'}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {status === 'done' && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="h-4 w-4" />
            Resume uploaded and parsed successfully!
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || status === 'uploading' || status === 'parsing' || status === 'done'}
          className="w-full"
        >
          {status === 'uploading' || status === 'parsing' ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
          ) : status === 'done' ? (
            <><CheckCircle className="mr-2 h-4 w-4" /> Uploaded</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Upload & Parse Resume</>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
