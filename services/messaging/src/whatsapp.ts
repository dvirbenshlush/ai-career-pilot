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
import { rm, readFile, writeFile, mkdir } from 'fs/promises'
import pino from 'pino'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = path.join(__dirname, '..', 'auth_info', 'whatsapp')
const STORE_FILE = path.join(__dirname, '..', 'auth_info', 'msg_store.json')
const logger = pino({ level: 'silent' })

// ── Message store — persisted to disk ─────────────────────────────────────────
const MAX_PER_GROUP = 500

interface StoredMsg { text: string; timestamp: number; senderName: string }
const msgStore = new Map<string, StoredMsg[]>()

// Load from disk on startup
async function loadStore() {
  try {
    const raw = await readFile(STORE_FILE, 'utf-8')
    const obj = JSON.parse(raw) as Record<string, StoredMsg[]>
    for (const [jid, msgs] of Object.entries(obj)) {
      msgStore.set(jid, msgs)
    }
    const total = Array.from(msgStore.values()).reduce((s, a) => s + a.length, 0)
    console.log(`[WA] Loaded ${msgStore.size} groups / ${total} msgs from disk`)
  } catch {
    // File doesn't exist yet — start fresh
  }
}

// Debounced write — at most once every 4 seconds
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) return
  saveTimer = setTimeout(async () => {
    saveTimer = null
    try {
      await mkdir(path.dirname(STORE_FILE), { recursive: true })
      const obj: Record<string, StoredMsg[]> = {}
      for (const [jid, msgs] of msgStore.entries()) obj[jid] = msgs
      await writeFile(STORE_FILE, JSON.stringify(obj))
    } catch (e) {
      console.error('[WA] Failed to save store:', e)
    }
  }, 4000)
}

function storeMsg(jid: string, text: string, ts: number, senderName: string) {
  const t = text.trim()
  if (!t || !ts) return
  if (!msgStore.has(jid)) msgStore.set(jid, [])
  const arr = msgStore.get(jid)!
  // Deduplicate — same message arriving from two syncs
  if (arr.some(m => m.timestamp === ts && m.text === t)) return
  arr.push({ text: t, timestamp: ts, senderName })
  if (arr.length > MAX_PER_GROUP) arr.splice(0, arr.length - MAX_PER_GROUP)
  scheduleSave()
}

function extractText(msg: WAMessage): string {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
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
    const senderName = (msg as { pushName?: string }).pushName ?? ''
    if (text && ts) { storeMsg(jid, text, ts, senderName); count++ }
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
  historyLoaded: boolean   // true once messaging-history.set has fired
}

const state: WAState = {
  status: 'disconnected',
  qrBase64: null,
  sock: null,
  groups: [],
  historyLoaded: false,
}

let intentionalDisconnect = false

// ── Public API ────────────────────────────────────────────────────────────────
export function getWAState() {
  const storeSummary: Record<string, number> = {}
  for (const [jid, msgs] of msgStore.entries()) {
    const name = state.groups.find(g => g.id === jid)?.name ?? jid
    storeSummary[name] = msgs.length
  }
  return {
    status: state.status,
    qrBase64: state.qrBase64,
    groups: state.groups,
    bufferedGroups: msgStore.size,
    historyLoaded: state.historyLoaded,
    storeSummary,   // shows message count per group for debugging
  }
}

let storeLoaded = false

export async function connectWhatsApp(): Promise<void> {
  if (state.status === 'connected' || state.status === 'connecting') return

  // Load persisted messages on first call
  if (!storeLoaded) {
    storeLoaded = true
    await loadStore()
  }

  state.status = 'connecting'
  state.qrBase64 = null
  state.historyLoaded = false

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
      state.historyLoaded = false
      if (intentionalDisconnect) return
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

  // History sync — accumulate across syncs, never clear between them
  sock.ev.on('messaging-history.set', ({ messages, isLatest }) => {
    const saved = ingest(messages as WAMessage[])
    state.historyLoaded = true
    const total = Array.from(msgStore.values()).reduce((s, a) => s + a.length, 0)
    console.log(`[WA] History sync: ${messages.length} msgs received, ${saved} new group msgs added, ${total} total stored (isLatest=${isLatest})`)
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
    console.log(`[WA] ${state.groups.length} groups loaded`)
  } catch (e) {
    console.error('[WA] groupFetchAllParticipating error:', e)
    state.groups = []
  }
}

export interface RawMessage {
  text: string
  source: 'whatsapp'
  source_name: string
  sender_name: string
  timestamp: number
}

export function fetchGroupMessages(groupIds: string[], limit = 15): RawMessage[] {
  if (state.status !== 'connected') throw new Error('WhatsApp not connected')

  const out: RawMessage[] = []

  for (const gid of groupIds) {
    const name = state.groups.find(g => g.id === gid)?.name ?? gid
    const all = msgStore.get(gid) ?? []
    const recent = all.slice(-limit)
    console.log(`[WA] group "${name}": ${all.length} stored, returning last ${recent.length}`)
    for (const { text, timestamp, senderName } of recent) {
      out.push({ text, source: 'whatsapp', source_name: name, sender_name: senderName, timestamp })
    }
  }

  console.log(`[WA] scan total: ${out.length} msgs from ${groupIds.length} groups`)
  return out
}

export function disconnectWhatsApp() {
  intentionalDisconnect = true
  try { state.sock?.end(undefined) } catch { /* ignore */ }
  state.status = 'disconnected'
  state.sock = null
  state.groups = []
  state.historyLoaded = false
  intentionalDisconnect = false
}

// Wipes auth so next connect shows fresh QR + triggers history sync.
// Does NOT clear msgStore — accumulated messages are kept and deduped on next sync.
export async function resetSession() {
  intentionalDisconnect = true
  try { state.sock?.end(undefined) } catch { /* ignore */ }
  state.sock = null
  state.status = 'disconnected'
  state.groups = []
  state.historyLoaded = false

  await new Promise(r => setTimeout(r, 1500))

  // Keep msgStore — new history sync will ADD to it (deduped by timestamp+text)
  await rm(AUTH_DIR, { recursive: true, force: true })
  intentionalDisconnect = false
  console.log(`[WA] Session reset — msgStore kept (${msgStore.size} groups). Next QR will trigger fresh history sync.`)
}
