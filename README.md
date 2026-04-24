# ApplyReady — Tailor Your Resume to Any Job in Seconds

A web platform that instantly matches your resume against any job listing's keywords, reorders sections by relevance, and generates a tailored ATS-friendly PDF.

## How It Works

1. **Sign Up & Upload** your resume PDF (parsed and securely stored in your Supabase account).
2. **Paste** any Job Description into the platform.
3. **See** your ATS match score, matching keywords, and missing keywords instantly.
4. **Edit** your resume sections with keyword guidance
5. **Download** a tailored, ATS-optimized resume PDF ($2.99/month Pro subscription).

## Architecture

```
applyready/              Next.js Web Application (deployed on Vercel)
  app/
    layout.js            Root layout with metadata
    page.js              Landing page
    dashboard/           Main app interface (Upload, Paste JD, Match)
    api/
      webhook/           LemonSqueezy webhook handler
  styles/
    globals.css          Global CSS reset
  lib/
    supabase.js          Supabase client initialization
    resume-parser-v2.js  PDF text extraction + heuristic section detection
    pdf-builder-v2.js    jsPDF-based tailored resume PDF generator
    skill-extractor.js   TF-based keyword extraction + matching engine
  package.json           Next.js dependencies
  next.config.js         Next.js configuration

public/libs/
  jspdf.umd.min.js       jsPDF library (client-side PDF generation)
  pdf.min.mjs            PDF.js library (PDF text extraction)
  pdf.worker.min.mjs     PDF.js web worker
```



## Tech Stack

- **Next.js** — Full-stack web framework (App Router)
- **Supabase** — PostgreSQL Database & Authentication
- **LemonSqueezy** — Subscriptions & Webhooks
- **PDF.js** — Client-side PDF text extraction
- **jsPDF** — Client-side PDF generation

## Pricing

| Feature | Free | Paid (one-time) |
|---------|------|---------------|
| ATS Match Score | ✓ | ✓ |
| Missing Keywords | ✓ | ✓ |
| Section Reordering Preview | ✓ | ✓ |
| Edit with Keyword Guidance | ✓ | ✓ |
| Download Tailored PDF | ✘ | ✓ Unlimited |

## Setup for Development

1. Install dependencies: `npm install`
2. Set up environment variables (`.env.local`) for Supabase and LemonSqueezy
3. Run development server: `npm run dev`
4. Open `http://localhost:3000` in browser
5. Test the signup, upload, and PDF generation flows

## Pre-Production Checklist

- [ ] Set up Supabase Auth and Database schema
- [ ] Create LemonSqueezy webhook endpoint in Next.js (`/api/webhook`)
- [ ] Migrate vanilla JS UI to React components
- [ ] Integrate `pdf-builder-v2.js` and `resume-parser-v2.js` into Next.js
