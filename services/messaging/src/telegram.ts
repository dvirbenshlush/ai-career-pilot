import TelegramBot from 'node-telegram-bot-api'
import { extractTextFromImage } from './groq.js'

export interface TelegramMessage {
  text: string
  source: 'telegram'
  source_name: string
  sender_name: string
  from_image?: boolean
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Public channel scraper ─────────────────────────────────────────────────────
// Uses t.me/s/<channel> preview page — no bot membership required for public channels

export interface FetchResult {
  messages: TelegramMessage[]
  imagesFound: number
  imagesOcrd: number
}

async function scrapePublicChannel(channelName: string, maxAgeDays: number): Promise<FetchResult> {
  const name = channelName.replace(/^@/, '')
  const cutoffSec = Math.floor(Date.now() / 1000) - maxAgeDays * 24 * 3600

  const res = await fetch(`https://t.me/s/${name}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'he,en;q=0.9',
    },
  })

  if (!res.ok) {
    console.log(`[TG] ${channelName}: HTTP ${res.status} — channel may be private or not exist`)
    return { messages: [], imagesFound: 0, imagesOcrd: 0 }
  }

  const html = await res.text()

  // Each message block starts with data-post="CHANNEL/msgId"
  // Split on that boundary so we process one message at a time
  const chunks = html.split(/(?=<div[^>]+data-post=["'][^"']+["'])/)
  const messages: TelegramMessage[] = []
  let imagesFound = 0
  let imagesOcrd = 0

  for (const chunk of chunks) {
    // Timestamp
    const timeMatch = chunk.match(/datetime="([^"]+)"/)
    if (!timeMatch) continue
    const timestamp = Math.floor(new Date(timeMatch[1]).getTime() / 1000)
    if (isNaN(timestamp) || timestamp < cutoffSec) continue

    // Message text — skip chunks with no text div (image-only posts handled separately below)
    const textMatch = chunk.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    const text = textMatch ? stripHtml(textMatch[1]) : ''

    // Detect image URLs — Telegram CDN URLs have no file extension
    // e.g. https://cdn4.telesco.pe/file/<hash>
    const photoMatch = chunk.match(/background-image:url\('(https:\/\/cdn[^']{20,})'\)/)
    const imageUrl = photoMatch?.[1] ?? null

    if (imageUrl) imagesFound++

    // Always push text when present — guaranteed baseline
    if (text && text.length >= 5) {
      messages.push({ text, source: 'telegram', source_name: name, sender_name: '' })
    }

    // OCR: run when there's an image AND text is short (caption-only) or absent
    // Job channels post full descriptions inside images; captions are rarely enough
    if (imageUrl && text.length < 60) {
      try {
        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer()
          const base64 = Buffer.from(buf).toString('base64')
          const ct = imgRes.headers.get('content-type') ?? 'image/jpeg'
          const mime = ct.includes('png') ? 'image/png' : ct.includes('webp') ? 'image/webp' : 'image/jpeg'
          const ocrText = await extractTextFromImage(base64, mime)
          if (ocrText && ocrText.length >= 10) {
            imagesOcrd++
            console.log(`[TG OCR] ${name}: extracted ${ocrText.length} chars from image`)
            messages.push({ text: ocrText, source: 'telegram', source_name: name, sender_name: '', from_image: true })
          }
        }
      } catch (e) {
        console.warn(`[TG OCR] failed for ${imageUrl}:`, e instanceof Error ? e.message : e)
      }
    }
  }

  console.log(`[TG] ${channelName}: ${messages.length} messages in last ${maxAgeDays}d (${imagesFound} images found, ${imagesOcrd} OCR'd)`)
  return { messages, imagesFound, imagesOcrd }
}

// ── Bot API fallback (for private groups where bot is a member) ────────────────

async function fetchViaBot(
  botToken: string,
  channel: string,
  maxAgeDays: number
): Promise<TelegramMessage[]> {
  const cutoffSec = Math.floor(Date.now() / 1000) - maxAgeDays * 24 * 3600
  const bot = new TelegramBot(botToken, { polling: false })
  const chatId = channel.startsWith('@') || channel.startsWith('-') ? channel : `@${channel}`
  const name = channel.replace(/^@/, '')
  const messages: TelegramMessage[] = []

  try {
    const updates = await bot.getUpdates({ limit: 100, offset: -100, allowed_updates: ['message', 'channel_post'] })
    for (const upd of updates) {
      const msg = upd.channel_post ?? upd.message
      if (!msg?.text) continue
      const msgChatId = String(msg.chat.id)
      const msgUsername = msg.chat.username ? `@${msg.chat.username}` : msgChatId
      if (msgChatId !== chatId && msgUsername !== chatId) continue
      const timestamp = msg.date ?? 0
      if (timestamp < cutoffSec) continue
      messages.push({ text: msg.text, source: 'telegram', source_name: name, sender_name: msg.from?.username ?? '' })
    }
    console.log(`[TG-bot] ${channel}: ${messages.length} messages via getUpdates`)
  } catch (e) {
    console.error(`[TG-bot] ${channel}:`, e instanceof Error ? e.message : e)
  }

  return messages
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchChannelMessages(
  botToken: string,
  channels: string[],
  maxAgeDays = 3
): Promise<FetchResult> {
  const all: TelegramMessage[] = []
  let imagesFound = 0
  let imagesOcrd = 0

  for (const channel of channels) {
    const result = await scrapePublicChannel(channel, maxAgeDays)
    let msgs = result.messages
    imagesFound += result.imagesFound
    imagesOcrd += result.imagesOcrd

    if (msgs.length === 0 && botToken) {
      msgs = await fetchViaBot(botToken, channel, maxAgeDays)
    }
    all.push(...msgs)
  }

  return { messages: all, imagesFound, imagesOcrd }
}

export async function validateBotToken(token: string): Promise<{ valid: boolean; botName?: string }> {
  try {
    const bot = new TelegramBot(token, { polling: false })
    const me = await bot.getMe()
    return { valid: true, botName: me.username }
  } catch {
    return { valid: false }
  }
}
