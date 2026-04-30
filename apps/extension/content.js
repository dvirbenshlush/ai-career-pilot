// Reads page text and sends it to popup on request
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    const text = document.body.innerText ?? ''
    const url  = window.location.href
    const title = document.title

    const emails = [...new Set(
      (text.match(/[\w.+\-]+@[\w\-]+(?:\.[a-zA-Z]{2,})+/g) ?? [])
        .filter(e => !e.endsWith('.png') && !e.endsWith('.jpg'))
    )]

    sendResponse({ text: text.slice(0, 5000), url, title, emails })
  }

  if (message.type === 'GET_FORM_QUESTIONS') {
    const questions = scrapeFormQuestions()
    sendResponse({ questions })
  }

  return true
})

function scrapeFormQuestions() {
  const questions = []
  const seen = new Set()

  // Collect all interactive fields
  const fields = document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select')

  fields.forEach(field => {
    const label = getLabelForField(field)
    if (!label || label.length < 2) return

    const key = label.toLowerCase().trim()
    if (seen.has(key)) return
    seen.add(key)

    questions.push(label.trim())
  })

  // Also pick up standalone visible question text near inputs (e.g. div-based forms)
  const questionPatterns = [/\?$/, /tell us/i, /describe/i, /why/i, /what/i, /how many/i, /years of/i]
  document.querySelectorAll('p, span, div, h3, h4, legend').forEach(el => {
    const txt = el.textContent?.trim() ?? ''
    if (txt.length < 5 || txt.length > 300) return
    if (!questionPatterns.some(p => p.test(txt))) return
    if (seen.has(txt.toLowerCase())) return

    // Only if this element is near a form field
    const nearField = el.closest('form, [role=form]') ||
      el.nextElementSibling?.matches('input, textarea, select') ||
      el.parentElement?.querySelector('input, textarea, select')

    if (nearField) {
      seen.add(txt.toLowerCase())
      questions.push(txt)
    }
  })

  return questions.slice(0, 30)
}

function getLabelForField(field) {
  // 1. explicit <label for="id">
  if (field.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(field.id)}"]`)
    if (lbl?.textContent?.trim()) return lbl.textContent.trim()
  }

  // 2. wrapping <label>
  const parent = field.closest('label')
  if (parent) {
    const clone = parent.cloneNode(true)
    clone.querySelectorAll('input, textarea, select').forEach(el => el.remove())
    const txt = clone.textContent?.trim()
    if (txt) return txt
  }

  // 3. aria-label
  if (field.getAttribute('aria-label')?.trim()) return field.getAttribute('aria-label').trim()

  // 4. aria-labelledby
  const labelledBy = field.getAttribute('aria-labelledby')
  if (labelledBy) {
    const el = document.getElementById(labelledBy)
    if (el?.textContent?.trim()) return el.textContent.trim()
  }

  // 5. placeholder as last resort
  if (field.placeholder?.trim()) return field.placeholder.trim()

  // 6. name attribute
  if (field.name?.trim()) return field.name.replace(/[_\-]/g, ' ').trim()

  return null
}
