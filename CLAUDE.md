# AI Career Pilot - System Blueprint & Guidelines

## 🎯 Project Vision
An autonomous, AI-driven suite for job seekers. The system doesn't just manage data; it proactively finds jobs, optimizes resumes, and prepares the user for interviews.

## 🛠 Role & Autonomy
You (Claude) are the **Lead Software Architect**. 
- **Tech Stack:** You have full autonomy to choose the stack (e.g., Next.js, FastAPI, Supabase, Vercel AI SDK).
- **Architecture:** Aim for an Agentic approach. Prefer a Web Dashboard for the UI, but feel free to include CLI tools or Bot integrations if they add value.
- **Innovation:** You are encouraged to add "bonus" features like LinkedIn profile auditing or salary negotiation scripts.

## 📋 System Requirements

### 1. Resume & Job Matcher
- **Upload:** Support PDF/Docx parsing.
- **Analysis:** Semantic matching between resume and job description ($0-100\%$).
- **Optimization:** Generate a "Tailored Resume" version based on missing keywords and specific job requirements.

### 2. Interview Coach (AI Simulation)
- **Research:** Deep-dive into company background and role expectations.
- **Output:** Generate personalized Technical & Behavioral Q&A.
- **Feedback:** Provide a system to critique user answers and suggest improvements.

### 3. Job Hunter Agent
- **Web Intelligence:** Use search/crawling agents (Tavily, Firecrawl, or Playwright).
- **Smart Filtering:** Find jobs based on developer-defined parameters (Stack, Salary, Remote/Hybrid).
- **Automation:** Generate a curated list of daily "High-Match" opportunities.

### 4. Smart Interview Calendar
- **Gmail Integration:** Scan for interview invites and "next step" emails.
- **Visual Dashboard:** A unified calendar view showing the application pipeline (Applied → Interviewing → Offer/Rejected).

## 🔧 Technical Standards & Commands
- **Code Style:** Functional, modular, and type-safe (TypeScript preferred).
- **CI/CD:** Full GitHub Actions pipeline for testing and deployment.
- **Infrastructure:** Use Docker for local dev and provide deployment config (Vercel/Railway).
- **Environment:** All secrets must be in `.env.example`.

### Standard Commands (To be updated as project evolves):
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm test`

---
**Status:** Initializing Architecture...