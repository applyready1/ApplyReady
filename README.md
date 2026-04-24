# ApplyReady

ApplyReady is a website-first resume workspace. A user uploads a resume PDF, pastes a job description, gets an ATS match score, edits parsed resume sections, quick-adds missing keywords, and downloads a clean ATS-friendly PDF.

## Current Scope

- Website model only. No browser extension flow remains in the app.
- No authentication, Supabase persistence, subscription checks, or Pro labeling yet.
- Resume data and pasted job descriptions are temporarily persisted in browser local storage.
- PDF parsing and PDF generation run client-side through the files in `public/libs`.

## App Flow

1. Upload a base resume PDF or enter resume data manually.
2. Paste a job description into the workspace.
3. Review the ATS score, matched keywords, missing keywords, missing phrases, and suggested section order.
4. Edit contact, summary, skills, experience, education, and projects.
5. Download an ATS-friendly PDF.

## Project Structure

```text
app/
  components/
    ApplyReadyWorkspace.js   Main website workspace
  dashboard/page.js          Backward-compatible route to the workspace
  globals.css                Global UI styles
  layout.js                  Metadata and root document shell
  page.js                    Home route
  privacy/page.js            Current privacy policy
lib/
  matcher.js                 JD/resume matching and section ordering
  pdf-builder-v2.js          Client-side jsPDF resume export
  resume-data.js             Resume data factories
  resume-parser-v2.js        Client-side PDF.js resume parser
public/libs/
  jspdf.umd.min.js
  pdf.min.mjs
  pdf.worker.min.mjs
```

## Planned Integrations

- Supabase Auth for accounts.
- Supabase database storage for parsed resume data linked to users.
- LemonSqueezy checkout and webhook handling for monthly subscription state.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

This repository currently expects `npm`/Node to be available locally. The current shell used for this edit did not have `npm` or `node` on `PATH`, so build verification could not be run here.
