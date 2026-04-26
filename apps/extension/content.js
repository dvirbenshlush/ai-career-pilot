// Reads page text and sends it to popup on request
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    const text = document.body.innerText ?? ''
    const url  = window.location.href
    const title = document.title

    // Try to find email addresses in the page
    const emails = [...new Set(
      (text.match(/[\w.+\-]+@[\w\-]+(?:\.[a-zA-Z]{2,})+/g) ?? [])
        .filter(e => !e.endsWith('.png') && !e.endsWith('.jpg'))
    )]

    sendResponse({ text: text.slice(0, 5000), url, title, emails })
  }
  return true
})
