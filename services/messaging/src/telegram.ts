import TelegramBot from 'node-telegram-bot-api'

export interface TelegramMessage {
  text: string
  source: 'telegram'
  source_name: string
  sender_name: string
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

async function scrapePublicChannel(
  channelName: string,
  maxAgeDays: number
): Promise<TelegramMessage[]> {
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
    return []
  }

  const html = await res.text()

  // Each message block starts with data-post="CHANNEL/msgId"
  // Split on that boundary so we process one message at a time
  const chunks = html.split(/(?=<div[^>]+data-post=["'][^"']+["'])/)
  const messages: TelegramMessage[] = []

  for (const chunk of chunks) {
    // Timestamp
    const timeMatch = chunk.match(/datetime="([^"]+)"/)
    if (!timeMatch) continue
    const timestamp = Math.floor(new Date(timeMatch[1]).getTime() / 1000)
    if (isNaN(timestamp) || timestamp < cutoffSec) continue

    // Message text (innerText of .tgme_widget_message_text)
    const textMatch = chunk.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    if (!textMatch) continue
    const text = stripHtml(textMatch[1])
    if (!text || text.length < 5) continue

    messages.push({ text, source: 'telegram', source_name: name, sender_name: '' })
  }

  console.log(`[TG] ${channelName}: ${messages.length} messages in last ${maxAgeDays}d`)
  return messages
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
    // getUpdates only returns messages the bot has actually received (private groups, not channels)
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
): Promise<TelegramMessage[]> {
  const all: TelegramMessage[] = []

  for (const channel of channels) {
    // Try public scrape first; fall back to bot API for private groups
    let msgs = await scrapePublicChannel(channel, maxAgeDays)
    if (msgs.length === 0 && botToken) {
      msgs = await fetchViaBot(botToken, channel, maxAgeDays)
    }
    all.push(...msgs)
  }

  return all
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
