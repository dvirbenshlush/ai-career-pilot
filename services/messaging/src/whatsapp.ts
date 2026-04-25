import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  WAMessage,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode'
import path from 'path'
import { fileURLToPath } from 'url'
import { rm } from 'fs/promises'
import pino from 'pino'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = path.join(__dirname, '..', 'auth_info', 'whatsapp')
const logger = pino({ level: 'silent' })

// ── Message store ─────────────────────────────────────────────────────────────
// groupId → Array<{ text, timestamp }>
// Keeps up to 500 messages per group; oldest dropped first
const MAX_PER_GROUP = 500

interface StoredMsg { text: string; timestamp: number }
const msgStore = new Map<string, StoredMsg[]>()

function storeMsg(jid: string, text: string, ts: number) {
  if (!text.trim()) return
  if (!msgStore.has(jid)) msgStore.set(jid, [])
  const arr = msgStore.get(jid)!
  arr.push({ text, timestamp: ts })
  if (arr.length > MAX_PER_GROUP) arr.splice(0, arr.length - MAX_PER_GROUP)
}

function extractText(msg: WAMessage): string {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??       // תמונות עם כיתוב — נפוץ מאוד במשרות
    m.videoMessage?.caption ??       // סרטונים עם כיתוב
    m.documentMessage?.caption ??   // מסמכים עם כיתוב
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    ''
  )
}

function ingest(messages: WAMessage[]) {
  let count = 0
  for (const msg of messages) {
    const jid = msg.key?.remoteJid ?? ''
    if (!jid.endsWith('@g.us')) continue
    const text = extractText(msg)
    const ts = Number(msg.messageTimestamp ?? 0)
    if (text && ts) { storeMsg(jid, text, ts); count++ }
  }
  return count
}

// ── State ─────────────────────────────────────────────────────────────────────
export type WAStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected'

interface WAState {
  status: WAStatus
  qrBase64: string | null
  sock: WASocket | null
  groups: Array<{ id: string; name: string }>
}

const state: WAState = { status: 'disconnected', qrBase64: null, sock: null, groups: [] }

// Prevents auto-reconnect when we're intentionally resetting
let intentionalDisconnect = false

// ── Public API ────────────────────────────────────────────────────────────────
export function getWAState() {
  return {
    status: state.status,
    qrBase64: state.qrBase64,
    groups: state.groups,
    bufferedGroups: Array.from(msgStore.keys()).filter(j => j.endsWith('@g.us')).length,
  }
}

export async function connectWhatsApp(): Promise<void> {
  if (state.status === 'connected' || state.status === 'connecting') return

  state.status = 'connecting'
  state.qrBase64 = null

  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    syncFullHistory: true,
    browser: ['AI Career Pilot', 'Chrome', '1.0.0'],
  })

  state.sock = sock
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      state.status = 'qr_ready'
      state.qrBase64 = await qrcode.toDataURL(qr)
      console.log('[WA] QR ready')
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      console.log(`[WA] Closed code=${code} loggedOut=${loggedOut} intentional=${intentionalDisconnect}`)
      state.status = 'disconnected'
      state.sock = null
      state.groups = []
      if (intentionalDisconnect) {
        // reset/logout in progress — caller handles what happens next
        return
      }
      if (loggedOut) {
        await rm(AUTH_DIR, { recursive: true, force: true })
        console.log('[WA] Session cleared (logged out from phone)')
      } else {
        setTimeout(() => connectWhatsApp(), 5000)
      }
    }

    if (connection === 'open') {
      state.status = 'connected'
      state.qrBase64 = null
      console.log('[WA] Connected!')
      await refreshGroups()
    }
  })

  // History sync — fires on first connect and after long offline periods
  sock.ev.on('messaging-history.set', ({ messages, isLatest }) => {
    const saved = ingest(messages as WAMessage[])
    console.log(`[WA] History sync: ${messages.length} msgs, ${saved} group msgs stored (isLatest=${isLatest})`)
  })

  // Real-time new messages
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    ingest(messages as WAMessage[])
  })
}

async function refreshGroups() {
  if (!state.sock) return
  try {
    const groups = await state.sock.groupFetchAllParticipating()
    state.groups = Object.values(groups).map(g => ({ id: g.id, name: g.subject ?? g.id }))
    console.log(`[WA] ${state.groups.length} groups`)
  } catch (e) {
    console.error('[WA] groupFetchAllParticipating error:', e)
    state.groups = []
  }
}

export interface RawMessage {
  text: string
  source: 'whatsapp'
  source_name: string
  timestamp: number
}

export function fetchGroupMessages(groupIds: string[], limit = 50): RawMessage[] {
  if (state.status !== 'connected') throw new Error('WhatsApp not connected')

  const out: RawMessage[] = []

  for (const gid of groupIds) {
    const name = state.groups.find(g => g.id === gid)?.name ?? gid
    const all = msgStore.get(gid) ?? []
    // Take the last `limit` messages regardless of age or read status
    const recent = all.slice(-limit)
    for (const { text, timestamp } of recent) {
      out.push({ text, source: 'whatsapp', source_name: name, timestamp })
    }
  }

  console.log(`[WA] scan: ${out.length} msgs (last ${limit}/group) from ${groupIds.length} groups`)
  return out
}

export function disconnectWhatsApp() {
  intentionalDisconnect = true
  try { state.sock?.end(undefined) } catch { /* ignore */ }
  state.status = 'disconnected'
  state.sock = null
  state.groups = []
  intentionalDisconnect = false
}

// Wipes saved auth → next connectWhatsApp() shows fresh QR + full history sync
export async function resetSession() {
  intentionalDisconnect = true
  try { state.sock?.end(undefined) } catch { /* ignore */ }
  state.sock = null
  state.status = 'disconnected'
  state.groups = []

  // Give the socket time to close cleanly before deleting auth files
  await new Promise(r => setTimeout(r, 1500))

  msgStore.clear()
  await rm(AUTH_DIR, { recursive: true, force: true })
  intentionalDisconnect = false
  console.log('[WA] Session reset — next connect will show QR and do full history sync')
}
