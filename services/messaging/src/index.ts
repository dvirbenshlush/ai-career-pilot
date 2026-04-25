import express from 'express'
import cors from 'cors'
import { connectWhatsApp, fetchGroupMessages, fetchGroupName, getWAState, disconnectWhatsApp, resetSession } from './whatsapp.js'
import { fetchChannelMessages, validateBotToken } from './telegram.js'
import { parseJobMessages, parseJobPage } from './groq.js'
import { scrapePage } from './scraper.js'

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

app.get('/whatsapp/group-messages', (req, res) => {
  const groupId = req.query.groupId as string
  if (!groupId) return res.status(400).json({ error: 'groupId required' })
  const s = getWAState()
  if (s.status !== 'connected') return res.status(400).json({ messages: [] })
  try {
    const msgs = fetchGroupMessages([groupId])
    return res.json({ messages: msgs.map(m => ({ text: m.text, sender_name: m.sender_name })) })
  } catch {
    return res.json({ messages: [] })
  }
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
  const { groupIds, userProfile } = req.body as {
    groupIds: string[]
    userProfile?: string
  }

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return res.status(400).json({ error: 'groupIds required' })
  }

  const s = getWAState()
  if (s.status !== 'connected') {
    return res.status(400).json({ error: 'WhatsApp not connected', status: s.status })
  }

  try {
    const allJobs = []
    let totalScanned = 0

    // Process each group independently — last 3 days of stored messages
    const scannedGroupNames: string[] = []
    for (const gid of groupIds) {
      const msgs = fetchGroupMessages([gid]) // default: last 3 days
      if (msgs.length === 0) {
        const name = fetchGroupName(gid)
        if (name) scannedGroupNames.push(name)
        continue
      }
      totalScanned += msgs.length
      const groupName = msgs[0]?.source_name
      if (groupName) scannedGroupNames.push(groupName)
      const jobs = await parseJobMessages(msgs, userProfile)
      allJobs.push(...jobs)
    }

    return res.json({ jobs: allJobs, messagesScanned: totalScanned, scannedGroupNames })
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
  const { botToken, channels, userProfile, maxAgeDays } = req.body as {
    botToken?: string
    channels: string[]
    userProfile?: string
    maxAgeDays?: number
  }

  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({ error: 'channels required' })
  }

  try {
    const msgs = await fetchChannelMessages(botToken ?? '', channels, maxAgeDays ?? 14)
    const jobs = await parseJobMessages(
      msgs.map(m => ({ ...m, sender_name: m.sender_name ?? '' })),
      userProfile
    )
    return res.json({ jobs, messagesScanned: msgs.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
})

// ── URL scraper ───────────────────────────────────────────────────────────────

app.post('/url/scan', async (req, res) => {
  const { urls, userProfile } = req.body as { urls: string[]; userProfile?: string }

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls required' })
  }

  const jobs = []
  const errors: string[] = []

  for (const url of urls.slice(0, 5)) { // cap at 5 URLs per request
    try {
      const page = await scrapePage(url)
      const pageJobs = await parseJobPage(page.url, page.text, page.title, userProfile)
      jobs.push(...pageJobs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[URL] failed to scrape ${url}:`, msg)
      errors.push(`${url}: ${msg}`)
    }
  }

  return res.json({ jobs, errors })
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
