import express from 'express'
import cors from 'cors'
import { connectWhatsApp, fetchGroupMessages, getWAState, disconnectWhatsApp, resetSession } from './whatsapp.js'
import { fetchChannelMessages, validateBotToken } from './telegram.js'
import { parseJobMessages } from './groq.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT ?? 3001

// ── WhatsApp ──────────────────────────────────────────────────────────────────

app.post('/whatsapp/connect', async (_req, res) => {
  await connectWhatsApp()
  res.json(getWAState())
})

app.get('/whatsapp/status', (_req, res) => {
  res.json(getWAState())
})

app.post('/whatsapp/disconnect', (_req, res) => {
  disconnectWhatsApp()
  res.json({ ok: true })
})

// Reset session + reconnect → triggers full WhatsApp history sync
app.post('/whatsapp/reset', async (_req, res) => {
  disconnectWhatsApp()
  await resetSession()
  await connectWhatsApp()
  res.json(getWAState())
})

app.post('/whatsapp/scan', async (req, res) => {
  const { groupIds, userProfile, maxAgeDays = 7 } = req.body as {
    groupIds: string[]
    userProfile?: string
    maxAgeDays?: number
  }

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({ error: 'groupIds required' })
  }

  const s = getWAState()
  if (s.status !== 'connected') {
    return res.status(400).json({ error: 'WhatsApp not connected', status: s.status })
  }

  try {
    const msgs = fetchGroupMessages(groupIds, maxAgeDays)
    if (msgs.length === 0) {
      return res.json({ jobs: [], messagesScanned: 0 })
    }
    const jobs = await parseJobMessages(msgs, userProfile)
    return res.json({ jobs, messagesScanned: msgs.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
})

// ── Telegram ──────────────────────────────────────────────────────────────────

app.post('/telegram/validate', async (req, res) => {
  const { botToken } = req.body as { botToken: string }
  if (!botToken) return res.status(400).json({ error: 'botToken required' })
  const result = await validateBotToken(botToken)
  return res.json(result)
})

app.post('/telegram/scan', async (req, res) => {
  const { botToken, channels, userProfile } = req.body as {
    botToken: string
    channels: string[]
    userProfile?: string
  }

  if (!botToken) return res.status(400).json({ error: 'botToken required' })
  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({ error: 'channels required' })
  }

  try {
    const msgs = await fetchChannelMessages(botToken, channels)
    const jobs = await parseJobMessages(msgs, userProfile)
    return res.json({ jobs, messagesScanned: msgs.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
})

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }))

const server = app.listen(PORT, () => {
  console.log(`Messaging service running on port ${PORT}`)
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} is already in use.`)
    console.error(`   Run:  npx kill-port ${PORT}`)
    process.exit(1)
  }
  throw err
})
