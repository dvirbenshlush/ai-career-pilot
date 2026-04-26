'use client'

import { useEffect, useState } from 'react'

export default function ExtensionAuthPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'login'>('loading')

  useEffect(() => {
    async function run() {
      // 1. Get token from API
      const res = await fetch('/api/extension/token')
      if (res.status === 401) { setStatus('login'); return }
      if (!res.ok) { setStatus('error'); return }

      const { token } = await res.json() as { token: string }

      // 2. Send token to extension via externally_connectable
      // chrome.runtime is injected by the extension into pages matching externally_connectable
      const cr = (window as unknown as { chrome?: { runtime?: { sendMessage: (id: string, msg: unknown, cb: (r: unknown) => void) => void } } }).chrome
      if (!cr?.runtime?.sendMessage) {
        setStatus('error')
        return
      }

      // The extension ID is embedded at build time or read from the URL
      const params = new URLSearchParams(window.location.search)
      const extId = params.get('extId')
      if (!extId) { setStatus('error'); return }

      cr.runtime.sendMessage(extId, { type: 'SET_TOKEN', token }, () => {
        setStatus('success')
        setTimeout(() => window.close(), 1500)
      })
    }

    run().catch(() => setStatus('error'))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 max-w-sm">
        {status === 'loading' && (
          <>
            <div className="text-4xl">⏳</div>
            <p className="text-muted-foreground">מתחבר...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="text-xl font-bold">חובר בהצלחה!</h1>
            <p className="text-muted-foreground text-sm">החלון ייסגר אוטומטית</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl">❌</div>
            <h1 className="text-xl font-bold">שגיאה בחיבור</h1>
            <p className="text-muted-foreground text-sm">ודא שה-Extension מותקן ונסה שוב</p>
          </>
        )}
        {status === 'login' && (
          <>
            <div className="text-4xl">🔐</div>
            <h1 className="text-xl font-bold">נדרשת התחברות</h1>
            <p className="text-muted-foreground text-sm">התחבר לאתר תחילה ואז נסה שוב</p>
            <a href="/login" className="text-primary underline text-sm">עבור להתחברות</a>
          </>
        )}
      </div>
    </div>
  )
}
