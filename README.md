# ApplyReady — Tailor Your Resume to Any Job in Seconds

Chrome extension that instantly matches your resume against any job listing's keywords, reorders sections by relevance, and generates a tailored ATS-friendly PDF.

## How It Works

1. **Upload** your resume PDF (parsed and stored locally in your browser — never sent anywhere)
2. **Browse** to any job listing on LinkedIn, Indeed, Glassdoor, ZipRecruiter, etc.
3. **See** your ATS match score, matching keywords, and missing keywords (FREE)
4. **Edit** your resume sections with keyword guidance
5. **Download** a tailored, ATS-optimized resume PDF (one-time license, price set in config.js)

## Architecture

```
extension/
  manifest.json          MV3 manifest with content script injections
  config.js              LemonSqueezy config, job site selectors, stop words
  background.js          Service worker — badge management, install handler
  content.js             Content script — scrapes job descriptions from DOM
  content.css            Reserved for future page overlays
  resume-parser.js       PDF.js text extraction + heuristic section detection
  keyword-matcher.js     TF-based keyword extraction + matching engine
  pdf-builder.js         jsPDF-based tailored resume PDF generator
  popup.html             5-view popup UI
  popup.js               Popup controller — coordinates all modules
  popup.css              Popup styles
  libs/
    jspdf.umd.min.js     jsPDF library (client-side PDF generation)
    pdf.min.mjs          PDF.js library (PDF text extraction)
    pdf.worker.min.mjs   PDF.js web worker
  icons/
    icon16.png           Extension icon 16x16
    icon48.png           Extension icon 48x48
    icon128.png          Extension icon 128x128

web/                     Next.js landing page (deployed on Vercel)
  app/
    layout.js            Root layout with metadata
    page.js              Landing page (placeholder)
    welcome/
      page.js            Post-install welcome page (placeholder)
  styles/
    globals.css          Global CSS reset
  package.json           Next.js dependencies
  next.config.js         Next.js configuration
```

## Supported Job Sites

- LinkedIn Jobs
- Indeed
- Glassdoor
- ZipRecruiter
- Monster
- Dice
- Lever
- Greenhouse
- Workday

## Tech Stack

- **Chrome Extension** (Manifest V3)
- **PDF.js** — client-side PDF text extraction
- **jsPDF** — client-side PDF generation
- **LemonSqueezy** — license key validation (no Supabase needed)
- **Next.js** — landing page (Vercel)
- **Zero backend** — all processing happens in the browser

## Pricing

| Feature | Free | Paid (one-time) |
|---------|------|---------------|
| ATS Match Score | ✓ | ✓ |
| Missing Keywords | ✓ | ✓ |
| Section Reordering Preview | ✓ | ✓ |
| Edit with Keyword Guidance | ✓ | ✓ |
| Download Tailored PDF | ✘ | ✓ Unlimited |

## Setup for Development

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/` folder
4. Navigate to a job listing on LinkedIn/Indeed/Glassdoor
5. Click the ApplyReady icon to test

## Pre-Production Checklist

- [ ] Create LemonSqueezy product with license key enabled
- [ ] Update `config.js` with real LemonSqueezy store/product IDs and checkout URL
- [ ] Update `config.js` with real Vercel landing page URL
- [ ] Replace placeholder icons with final design
- [ ] Deploy web/ to Vercel
