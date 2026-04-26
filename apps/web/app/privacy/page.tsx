export default function PrivacyPage() {
  return (
    <div className="container max-w-2xl mx-auto py-12 px-4 space-y-8">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: April 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. What We Collect</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Email address and user ID (via Supabase authentication)</li>
          <li>Uploaded resumes (stored securely in Supabase Storage)</li>
          <li>Job descriptions and contact emails you submit for CV sending</li>
          <li>Gmail OAuth tokens — used solely to create drafts on your behalf</li>
          <li>Job opportunities scraped from WhatsApp, Telegram, or URLs you provide</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. How We Use Your Data</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>To generate personalized cover letters using AI (Groq)</li>
          <li>To create Gmail drafts with your resume attached</li>
          <li>To generate interview preparation questions</li>
          <li>To save and display job opportunities in your personal dashboard</li>
        </ul>
        <p className="text-muted-foreground">We do not sell your data. We do not share your data with third parties except the services required to operate the app (Supabase, Groq, Google Gmail API).</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Gmail Access</h2>
        <p className="text-muted-foreground">
          The app requests Gmail access (<code>gmail.compose</code> and <code>gmail.readonly</code> scopes) solely to create email drafts with your resume. We never send emails automatically — you always review and send the draft yourself from Gmail.
        </p>
        <p className="text-muted-foreground">
          Gmail tokens are stored encrypted in our database and used only to interact with Gmail on your explicit request.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Chrome Extension</h2>
        <p className="text-muted-foreground">
          The AI Career Pilot Chrome Extension reads the text content of pages you actively visit (only when you click &quot;Read from page&quot;) to extract job descriptions and contact emails. This data is sent only to our own servers (ai-career-pilot-web.vercel.app) and is not stored beyond the current session.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Data Retention</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>You can delete your account and all associated data at any time</li>
          <li>Resumes can be deleted from your profile</li>
          <li>Gmail tokens are deleted when you disconnect Gmail</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Contact</h2>
        <p className="text-muted-foreground">
          Questions? Contact us at{' '}
          <a href="mailto:dvirbenshlush95@gmail.com" className="text-primary underline">
            dvirbenshlush95@gmail.com
          </a>
        </p>
      </section>
    </div>
  )
}
