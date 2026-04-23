import TelegramBot from 'node-telegram-bot-api'

interface TelegramMessage {
  text: string
  source: 'telegram'
  source_name: string
}

// Cache bots by token to avoid duplicate polling instances
const botCache = new Map<string, TelegramBot>()

function getBot(token: string): TelegramBot {
  if (botCache.has(token)) return botCache.get(token)!
  const bot = new TelegramBot(token, { polling: false })
  botCache.set(token, bot)
  return bot
}

export async function fetchChannelMessages(
  botToken: string,
  channels: string[],
  maxPerChannel = 100
): Promise<TelegramMessage[]> {
  const bot = getBot(botToken)
  const messages: TelegramMessage[] = []

  for (const channel of channels) {
    // Normalise: add @ prefix if missing for public channels, or pass chat id directly
    const chatId = channel.startsWith('@') || channel.startsWith('-') ? channel : `@${channel}`
    const sourceName = channel.replace('@', '')

    try {
      // getUpdates only works for bots that are members of the channel/group.
      // We use getChatHistory via the bot API (getUpdates offset trick).
      // For channels: the bot must be an admin.
      const updates = await bot.getUpdates({ limit: maxPerChannel, offset: -maxPerChannel })

      for (const upd of updates) {
        const msg = upd.channel_post ?? upd.message
        if (!msg?.text) continue

        const msgChat = String(msg.chat.id)
        const msgUsername = msg.chat.username ? `@${msg.chat.username}` : msgChat

        if (msgChat === chatId || msgUsername === chatId) {
          messages.push({ text: msg.text, source: 'telegram', source_name: sourceName })
        }
      }
    } catch {
      // Channel inaccessible — skip
    }
  }

  return messages
}

// Alternative: use forwardMessages / getChatMember approach
// For public channels the bot doesn't need to be a member — use getUpdates after
// the bot has been added as admin to the channel.

export async function validateBotToken(token: string): Promise<{ valid: boolean; botName?: string }> {
  try {
    const bot = getBot(token)
    const me = await bot.getMe()
    return { valid: true, botName: me.username }
  } catch {
    return { valid: false }
  }
}
