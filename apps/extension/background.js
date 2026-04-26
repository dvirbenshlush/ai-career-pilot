const API_BASE = 'https://ai-career-pilot-web.vercel.app'

// Receive token from the web app auth page
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SET_TOKEN' && message.token) {
    chrome.storage.local.set({ extensionToken: message.token }, () => {
      sendResponse({ ok: true })
    })
    return true // keep channel open for async sendResponse
  }
})

// Internal messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_TOKEN') {
    chrome.storage.local.get('extensionToken', data => {
      sendResponse({ token: data.extensionToken ?? null })
    })
    return true
  }

  if (message.type === 'CLEAR_TOKEN') {
    chrome.storage.local.remove('extensionToken', () => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'API_CALL') {
    chrome.storage.local.get('extensionToken', async data => {
      const token = data.extensionToken
      if (!token) { sendResponse({ error: 'not_authenticated' }); return }
      try {
        const res = await fetch(`${API_BASE}${message.path}`, {
          method: message.method ?? 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: message.body ? JSON.stringify(message.body) : undefined,
        })
        const json = await res.json()
        sendResponse({ ok: res.ok, status: res.status, data: json })
      } catch (e) {
        sendResponse({ error: e.message })
      }
    })
    return true
  }
})
