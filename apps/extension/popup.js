const API_BASE = 'https://ai-career-pilot-web.vercel.app'
const AUTH_URL = `${API_BASE}/extension-auth`

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id)
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none')
  $(name).style.display = 'flex'
}
function setStatus(msg, type = 'loading') {
  const el = $('status')
  el.textContent = msg
  el.className = `status ${type}`
  el.style.display = msg ? 'block' : 'none'
}

// ── State ─────────────────────────────────────────────────────────────────────

let selectedGender = null

function selectGender(gender) {
  selectedGender = gender
  document.querySelectorAll('.btn-gender').forEach(b => {
    b.classList.toggle('selected', b.dataset.gender === gender)
  })
  updateSendButton()
}

function updateSendButton() {
  const hasEmail = $('contact-email').value.includes('@')
  const hasGender = !!selectedGender
  const hasText = $('job-text').value.trim().length > 10
  $('btn-send-cv').disabled = !(hasEmail && hasGender && hasText)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, r => resolve(r?.token ?? null))
  })
}

async function apiCall(path, body, method = 'POST') {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'API_CALL', path, body, method }, resolve)
  })
}

async function init() {
  const token = await getToken()
  if (token) {
    showScreen('screen-main')
    $('btn-logout').style.display = 'block'
    tryReadPage()
  } else {
    showScreen('screen-auth')
    $('btn-logout').style.display = 'none'
  }
}

// ── Connect ───────────────────────────────────────────────────────────────────

$('btn-connect').addEventListener('click', () => {
  const url = `${AUTH_URL}?extId=${chrome.runtime.id}`
  chrome.tabs.create({ url })
  // Poll for token after auth page opens
  const poll = setInterval(async () => {
    const token = await getToken()
    if (token) {
      clearInterval(poll)
      init()
    }
  }, 1000)
  setTimeout(() => clearInterval(poll), 120_000) // stop polling after 2 min
})

$('btn-logout').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_TOKEN' }, () => init())
})

// ── Read page ─────────────────────────────────────────────────────────────────

async function tryReadPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, response => {
      if (chrome.runtime.lastError || !response) return
      if (response.text) $('job-text').value = response.text.slice(0, 3000)
      if (response.emails?.length) $('contact-email').value = response.emails[0]
      updateSendButton()
    })
  } catch { /* tab might not support content scripts */ }
}

$('btn-read-page').addEventListener('click', tryReadPage)

// ── Form events ───────────────────────────────────────────────────────────────

document.querySelectorAll('.btn-gender').forEach(b => {
  b.addEventListener('click', () => selectGender(b.dataset.gender))
})

$('job-text').addEventListener('input', () => {
  // Auto-extract email from pasted text
  const emails = $('job-text').value.match(/[\w.+\-]+@[\w\-]+(?:\.[a-zA-Z]{2,})+/g) ?? []
  if (emails.length && !$('contact-email').value) $('contact-email').value = emails[0]
  updateSendButton()
})

$('contact-email').addEventListener('input', updateSendButton)

// ── Send CV ───────────────────────────────────────────────────────────────────

$('btn-send-cv').addEventListener('click', async () => {
  const jobText = $('job-text').value.trim()
  const contactEmail = $('contact-email').value.trim()

  setStatus('מכין ומשלח קו"ח...', 'loading')
  $('btn-send-cv').disabled = true

  // 1. Extract job details via scan
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const currentUrl = tab?.url ?? ''

  const scanRes = await apiCall('/api/messaging/url/scan', {
    urls: currentUrl.startsWith('http') ? [currentUrl] : [],
    userProfile: jobText,
  })

  let jobTitle = '', company = '', snippet = jobText.slice(0, 300)

  if (scanRes?.data?.jobs?.length) {
    const j = scanRes.data.jobs[0]
    jobTitle = j.title ?? ''
    company = j.company ?? ''
    snippet = j.snippet ?? snippet
  }

  // Fallback: parse title/company from text manually
  if (!jobTitle) {
    const lines = jobText.split('\n').filter(l => l.trim())
    jobTitle = lines[0]?.slice(0, 80) ?? 'משרה'
  }

  // 2. Send CV
  const sendRes = await apiCall('/api/jobs/send-cv-gmail', {
    jobTitle, company, contactEmail, snippet, gender: selectedGender,
  })

  if (sendRes?.data?.needsAuth) {
    setStatus('מחבר Gmail...', 'loading')
    // Open Gmail OAuth flow in the browser — tokens saved to DB after completion
    chrome.tabs.create({ url: `${API_BASE}/api/gmail/auth?returnTo=/jobs` })
    setStatus('✅ חבר Gmail בחלון שנפתח, ואז נסה שוב', 'success')
    $('btn-send-cv').disabled = false
    return
  }

  if (!sendRes?.ok) {
    setStatus(sendRes?.data?.error ?? 'שגיאה בשליחה', 'error')
    $('btn-send-cv').disabled = false
    return
  }

  setStatus('✅ טיוטה נוצרה ב-Gmail!', 'success')
  if (sendRes.data?.gmailUrl) chrome.tabs.create({ url: sendRes.data.gmailUrl })
  updateSendButton()
})

// ── Interview prep ────────────────────────────────────────────────────────────

$('btn-interview').addEventListener('click', async () => {
  const jobText = $('job-text').value.trim()
  if (!jobText) { setStatus('הכנס תיאור משרה תחילה', 'error'); return }

  showScreen('screen-interview')
  $('interview-content').innerHTML = '<div class="status loading spinner">טוען שאלות...</div>'

  const lines = jobText.split('\n').filter(l => l.trim())
  const jobTitle = lines[0]?.slice(0, 80) ?? 'משרה'

  const res = await apiCall('/api/jobs/interview-prep', {
    jobTitle,
    snippet: jobText.slice(0, 500),
  })

  if (!res?.ok || !res.data?.questions) {
    $('interview-content').innerHTML = '<div class="status error">שגיאה בטעינת שאלות</div>'
    return
  }

  $('interview-content').innerHTML = res.data.questions.map(q => `
    <div class="q-card">
      <div class="q-category">${q.category}</div>
      <div class="q-text">${q.question}</div>
    </div>
  `).join('')
})

$('btn-back').addEventListener('click', () => showScreen('screen-main'))

// ── Boot ──────────────────────────────────────────────────────────────────────

init()
