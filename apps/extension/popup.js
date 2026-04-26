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
  $('btn-tailor').disabled = !hasText
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
$('btn-back-paste').addEventListener('click', () => showScreen('screen-main'))

// ── Tailor resume ─────────────────────────────────────────────────────────────

let tailoredDocUrl = null

async function runTailor(resumeText = '') {
  const jobText = $('job-text').value.trim()
  if (!jobText) return

  showScreen('screen-tailor')
  $('tailor-content').style.display = 'none'
  $('tailor-status').style.display = 'block'
  $('tailor-status').className = 'status loading spinner'
  $('tailor-status').textContent = 'מייצר קו"ח מותאם...'

  const lines = jobText.split('\n').filter(l => l.trim())
  const jobTitle = lines[0]?.slice(0, 80) ?? 'משרה'

  const body = { jobTitle, jobDescription: jobText }
  if (resumeText) body.resumeText = resumeText

  const res = await apiCall('/api/jobs/tailor-resume', body)

  if (res?.data?.error === 'noResume' || res?.status === 404) {
    showScreen('screen-paste-resume')
    return
  }

  if (res?.data?.needsAuth) {
    $('tailor-status').className = 'status error'
    $('tailor-status').textContent = 'חבר Gmail קודם כדי לשמור ב-Google Docs'
    chrome.tabs.create({ url: `${API_BASE}/api/gmail/auth?returnTo=/jobs` })
    return
  }

  if (!res?.ok || !res.data?.tailoredText) {
    $('tailor-status').className = 'status error'
    $('tailor-status').textContent = res?.data?.error ?? 'שגיאה ביצירת קו"ח'
    return
  }

  tailoredDocUrl = res.data.docUrl ?? null
  $('tailor-text').textContent = res.data.tailoredText
  $('tailor-status').style.display = 'none'
  $('tailor-content').style.display = 'block'

  if (tailoredDocUrl) {
    $('btn-open-doc').style.display = 'block'
    $('btn-open-doc').textContent = '📄 פתח ב-Google Docs'
  } else {
    $('btn-open-doc').style.display = 'none'
  }
}

$('btn-tailor').addEventListener('click', () => runTailor())

$('btn-tailor-with-text').addEventListener('click', () => {
  const resumeText = $('resume-text-input').value.trim()
  if (!resumeText) return
  runTailor(resumeText)
})

$('btn-open-doc').addEventListener('click', () => {
  if (tailoredDocUrl) chrome.tabs.create({ url: tailoredDocUrl })
})

$('btn-copy-resume').addEventListener('click', async () => {
  const text = $('tailor-text').textContent
  await navigator.clipboard.writeText(text)
  $('btn-copy-resume').textContent = '✅ הועתק!'
  setTimeout(() => { $('btn-copy-resume').textContent = '📋 העתק טקסט' }, 2000)
})

// ── Boot ──────────────────────────────────────────────────────────────────────

init()
