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
function setWizStatus(msg, type = 'loading') {
  const el = $('wiz-status')
  el.textContent = msg
  el.className = `status ${type}`
  el.style.display = msg ? 'block' : 'none'
}

// ── State ─────────────────────────────────────────────────────────────────────

const wiz = {
  gender: null,
  lang: 'he',
  cvtype: 'original',
  pdfBase64: null,
  tailoredText: null,
  docUrl: null,
  userName: null,
}

let wizPasteReturn = false

function wizReset() {
  wiz.gender = null
  wiz.lang = 'he'
  wiz.cvtype = 'original'
  wiz.pdfBase64 = null
  wiz.tailoredText = null
  wiz.docUrl = null

  document.querySelectorAll('.btn-toggle').forEach(b => {
    const isDefault = (b.dataset.group === 'lang' && b.dataset.val === 'he') ||
                      (b.dataset.group === 'cvtype' && b.dataset.val === 'original')
    b.classList.toggle('selected', isDefault)
  })

  $('wiz-preview').style.display = 'none'
  setWizStatus('', '')
  wizUpdateButton()
}

function wizUpdateButton() {
  const btn = $('btn-wiz-action')
  if (!wiz.gender) {
    btn.disabled = true
    btn.textContent = 'המשך ›'
    btn.className = 'btn btn-primary'
    return
  }
  btn.disabled = false
  if (wiz.cvtype === 'tailored' && !wiz.pdfBase64) {
    btn.textContent = '✨ צור קו"ח מותאם'
    btn.className = 'btn btn-tailor'
  } else if (wiz.cvtype === 'tailored') {
    btn.textContent = '📤 שלח קו"ח מותאם'
    btn.className = 'btn btn-primary'
  } else {
    btn.textContent = '📤 שלח קו"ח'
    btn.className = 'btn btn-primary'
  }
}

function updateSendButton() {
  const hasEmail = $('contact-email').value.includes('@')
  const hasText = $('job-text').value.trim().length > 10
  $('btn-send-cv').disabled = !(hasEmail && hasText)
  $('btn-save-applied').disabled = !hasText
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
  const poll = setInterval(async () => {
    const token = await getToken()
    if (token) { clearInterval(poll); init() }
  }, 1000)
  setTimeout(() => clearInterval(poll), 120_000)
})

$('btn-logout').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_TOKEN' }, () => init())
})

// ── Read page ─────────────────────────────────────────────────────────────────

async function tryReadPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    if (!tab.url?.startsWith('http')) return

    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, response => {
      if (chrome.runtime.lastError || !response) return
      if (response.text && !$('job-text').value) $('job-text').value = response.text.slice(0, 3000)
      if (response.emails?.length && !$('contact-email').value) $('contact-email').value = response.emails[0]
      updateSendButton()
    })
  } catch { /* tab might not support content scripts */ }
}

$('btn-read-page').addEventListener('click', tryReadPage)

// ── Main screen events ────────────────────────────────────────────────────────

$('job-text').addEventListener('input', () => {
  const emails = $('job-text').value.match(/[\w.+\-]+@[\w\-]+(?:\.[a-zA-Z]{2,})+/g) ?? []
  if (emails.length && !$('contact-email').value) $('contact-email').value = emails[0]
  updateSendButton()
})

$('contact-email').addEventListener('input', updateSendButton)

$('btn-send-cv').addEventListener('click', () => {
  wizReset()
  showScreen('screen-wizard')
})

// ── Wizard toggles ────────────────────────────────────────────────────────────

document.querySelectorAll('.btn-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const { group, val } = btn.dataset
    document.querySelectorAll(`.btn-toggle[data-group="${group}"]`).forEach(b => b.classList.remove('selected'))
    btn.classList.add('selected')
    wiz[group] = val

    if (group === 'cvtype' || group === 'lang') {
      wiz.pdfBase64 = null
      wiz.tailoredText = null
      wiz.docUrl = null
      $('wiz-preview').style.display = 'none'
      setWizStatus('', '')
    }

    wizUpdateButton()
  })
})

$('btn-back-wizard').addEventListener('click', () => showScreen('screen-main'))

// ── Job meta extraction ───────────────────────────────────────────────────────

async function extractJobMeta() {
  const jobText = $('job-text').value.trim()
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
  if (!jobTitle) {
    const lines = jobText.split('\n').filter(l => l.trim())
    jobTitle = lines[0]?.slice(0, 80) ?? 'משרה'
  }
  return { jobTitle, company, snippet, jobDescription: jobText }
}

// ── Generate tailored CV ──────────────────────────────────────────────────────

async function generateTailoredCv(resumeText = '') {
  setWizStatus('מייצר קו"ח מותאם...', 'loading')
  $('btn-wiz-action').disabled = true

  const { jobTitle, company, jobDescription } = await extractJobMeta()

  const body = { jobTitle, company, jobDescription, language: wiz.lang }
  if (resumeText) body.resumeText = resumeText

  const res = await apiCall('/api/jobs/tailor-resume', body)

  if (res?.data?.error === 'noResume' || res?.status === 404) {
    wizPasteReturn = true
    showScreen('screen-paste-resume')
    return
  }

  if (!res?.ok || !res.data?.tailoredText) {
    setWizStatus(res?.data?.error ?? 'שגיאה ביצירת קו"ח', 'error')
    $('btn-wiz-action').disabled = false
    wizUpdateButton()
    return
  }

  wiz.pdfBase64 = res.data.pdfBase64 ?? null
  wiz.tailoredText = res.data.tailoredText
  wiz.docUrl = res.data.docUrl ?? null
  wiz.userName = res.data.userName ?? null

  $('wiz-tailor-text').textContent = wiz.tailoredText
  $('wiz-preview').style.display = 'flex'
  $('btn-wiz-open-doc').style.display = wiz.docUrl ? 'inline-flex' : 'none'

  setWizStatus('✅ קו"ח מותאם נוצר! ניתן להוריד PDF או לשלוח ישירות.', 'success')
  wizUpdateButton()
}

// ── Send CV ───────────────────────────────────────────────────────────────────

async function sendCv() {
  const contactEmail = $('contact-email').value.trim()
  setWizStatus('שולח...', 'loading')
  $('btn-wiz-action').disabled = true

  const { jobTitle, company, snippet } = await extractJobMeta()

  const body = { jobTitle, company, contactEmail, snippet, gender: wiz.gender, language: wiz.lang }
  if (wiz.cvtype === 'tailored' && wiz.pdfBase64) body.tailoredPdfB64 = wiz.pdfBase64
  else if (wiz.cvtype === 'tailored' && wiz.tailoredText) body.tailoredText = wiz.tailoredText
  if (wiz.cvtype === 'tailored' && wiz.userName) body.userName = wiz.userName

  const sendRes = await apiCall('/api/jobs/send-cv-gmail', body)

  if (sendRes?.data?.needsAuth) {
    chrome.tabs.create({ url: `${API_BASE}/api/gmail/auth?returnTo=/jobs` })
    setWizStatus('✅ חבר Gmail בחלון שנפתח, ואז נסה שוב', 'success')
    $('btn-wiz-action').disabled = false
    return
  }

  if (!sendRes?.ok) {
    setWizStatus(sendRes?.data?.error ?? 'שגיאה בשליחה', 'error')
    $('btn-wiz-action').disabled = false
    return
  }

  setWizStatus('✅ טיוטה נוצרה ב-Gmail!', 'success')
  if (sendRes.data?.gmailUrl) chrome.tabs.create({ url: sendRes.data.gmailUrl })
  $('btn-wiz-action').disabled = false
}

$('btn-wiz-action').addEventListener('click', async () => {
  if (wiz.cvtype === 'tailored' && !wiz.pdfBase64) {
    await generateTailoredCv()
  } else {
    await sendCv()
  }
})

// ── PDF download ──────────────────────────────────────────────────────────────

$('btn-wiz-download').addEventListener('click', () => {
  if (!wiz.pdfBase64) return
  const bytes = Uint8Array.from(atob(wiz.pdfBase64), c => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = wiz.userName ? `${wiz.userName} - קורות חיים.pdf` : 'קורות חיים.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
})

$('btn-wiz-open-doc').addEventListener('click', () => {
  if (wiz.docUrl) chrome.tabs.create({ url: wiz.docUrl })
})

// ── Paste resume ──────────────────────────────────────────────────────────────

$('btn-back-paste').addEventListener('click', () => {
  if (wizPasteReturn) { wizPasteReturn = false; showScreen('screen-wizard') }
  else showScreen('screen-main')
})

$('btn-tailor-with-text').addEventListener('click', () => {
  const resumeText = $('resume-text-input').value.trim()
  if (!resumeText) return
  wizPasteReturn = false
  showScreen('screen-wizard')
  generateTailoredCv(resumeText)
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

// ── Save as applied ───────────────────────────────────────────────────────────

$('btn-save-applied').addEventListener('click', async () => {
  const jobText = $('job-text').value.trim()
  if (!jobText) return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const currentUrl = tab?.url ?? ''

  const lines = jobText.split('\n').filter(l => l.trim())
  const jobTitle = lines[0]?.slice(0, 80) ?? 'משרה'

  $('btn-save-applied').disabled = true
  $('btn-save-applied').textContent = '⏳ שומר...'

  const res = await apiCall('/api/jobs/apply', {
    title: jobTitle,
    snippet: jobText.slice(0, 300),
    url: currentUrl.startsWith('http') ? currentUrl : '',
  })

  if (res?.ok) {
    $('btn-save-applied').textContent = '✅ נשמר!'
    setStatus('✅ המשרה נשמרה עם סטטוס "הוגש"', 'success')
    setTimeout(() => {
      $('btn-save-applied').textContent = '📌 שמור כהגשה'
      updateSendButton()
    }, 3000)
  } else {
    const errMsg = res?.data?.error ?? res?.error ?? `שגיאה (${res?.status ?? 'network'})`
    $('btn-save-applied').textContent = '📌 שמור כהגשה'
    setStatus(`❌ ${errMsg}`, 'error')
    updateSendButton()
  }
})

// ── Boot ──────────────────────────────────────────────────────────────────────

init()
