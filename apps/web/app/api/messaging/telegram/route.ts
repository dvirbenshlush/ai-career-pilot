import { NextRequest, NextResponse } from 'next/server'

const MESSAGING_URL = process.env.MESSAGING_SERVICE_URL ?? 'http://localhost:3001'

async function proxy(path: string, body: unknown) {
  try {
    const res = await fetch(`${MESSAGING_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return NextResponse.json(
      { error: 'Messaging service unreachable. Make sure it is running on port 3001.' },
      { status: 503 }
    )
  }
}

// POST /api/messaging/telegram — action: validate | scan
export async function POST(req: NextRequest) {
  const body = await req.json() as { action: string; botToken?: string; channels?: string[]; userProfile?: string }
  const { action, ...rest } = body

  if (action === 'validate') {
    return proxy('/telegram/validate', rest)
  }

  if (action === 'scan') {
    return proxy('/telegram/scan', rest)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
