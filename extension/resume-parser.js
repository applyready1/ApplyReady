/**
 * resume-parser.js — PDF Resume Text Extraction & Section Detection
 * 
 * Extracts raw text from uploaded PDF using PDF.js, then uses heuristic
 * regex patterns to detect and split resume into structured sections.
 * User can correct any mis-detected sections (one-time setup).
 * 
 * All processing is 100% client-side. No data leaves the browser.
 * 
 * Dependencies: libs/pdf.min.mjs (PDF.js library)
 * Imported by: popup.js
 */

/**
 * Extracts raw text from a PDF file using PDF.js.
 * @param {ArrayBuffer} pdfBuffer - The PDF file as an ArrayBuffer
 * @returns {Promise<string>} - The extracted plain text
 */
async function extractTextFromPDF(pdfBuffer) {
  const pdfjsLib = await import(chrome.runtime.getURL('libs/pdf.min.mjs'));

  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.mjs');

  const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
  const textParts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by their Y position to reconstruct lines
    const lines = {};
    for (const item of textContent.items) {
      const y = Math.round(item.transform[5]); // Y coordinate
      if (!lines[y]) lines[y] = [];
      lines[y].push({ x: item.transform[4], text: item.str });
    }

    // Sort by Y descending (top of page first), then X ascending within each line
    const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineItems = lines[y].sort((a, b) => a.x - b.x);
      const lineText = lineItems.map(item => item.text).join(' ').trim();
      if (lineText) textParts.push(lineText);
    }
  }

  return textParts.join('\n');
}

/**
 * Detects whether a line of text is a section header.
 * Uses the patterns defined in CONFIG.SECTION_PATTERNS.
 * @param {string} line - A single line of text
 * @returns {string|null} - The section type key (e.g., 'skills') or null
 */
function detectSectionType(line) {
  const trimmed = line.trim();

  // Skip very long lines (headers are typically short)
  if (trimmed.length > 60) return null;

  // Skip lines that look like bullet points or regular content
  if (/^[•\-\*\d]/.test(trimmed)) return null;

  for (const [type, pattern] of Object.entries(CONFIG.SECTION_PATTERNS)) {
    if (pattern.test(trimmed)) return type;
  }

  return null;
}

/**
 * Extracts contact info (name, email, phone, LinkedIn) from the top of the resume.
 * Assumes contact info is in the first few lines before any section header.
 * @param {string[]} lines - All lines of the resume
 * @returns {{ name: string, email: string, phone: string, linkedin: string, endIndex: number }}
 */
function extractContactInfo(lines) {
  const contact = { name: '', email: '', phone: '', linkedin: '', endIndex: 0 };

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Stop if we hit a section header
    if (detectSectionType(line)) {
      contact.endIndex = i;
      break;
    }

    // Email
    const emailMatch = line.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) {
      contact.email = emailMatch[0];
      // Remove email from line, remaining might be other info
      const remaining = line.replace(emailMatch[0], '').trim();
      if (remaining && !contact.phone) {
        const phoneInRemaining = remaining.match(/[\+]?[\d\s\-\(\)]{7,}/);
        if (phoneInRemaining) contact.phone = phoneInRemaining[0].trim();
      }
      continue;
    }

    // Phone
    const phoneMatch = line.match(/[\+]?[\(]?\d{1,4}[\)]?[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,9}/);
    if (phoneMatch && line.length < 30) {
      contact.phone = phoneMatch[0].trim();
      continue;
    }

    // LinkedIn URL
    if (/linkedin\.com/i.test(line)) {
      contact.linkedin = line;
      continue;
    }

    // First non-empty, non-contact line is likely the name
    if (!contact.name && i < 3 && line.length < 50 && !/[@\d]/.test(line)) {
      contact.name = line;
    }

    contact.endIndex = i + 1;
  }

  return contact;
}

/**
 * Parses raw resume text into structured sections.
 * Returns an object with contact info and an array of detected sections.
 * @param {string} rawText - The full text extracted from the PDF
 * @returns {{ contact: Object, sections: Array<{ type: string, title: string, content: string }> }}
 */
function parseResumeText(rawText) {
  const lines = rawText.split('\n');
  const contact = extractContactInfo(lines);

  const sections = [];
  let currentSection = null;
  let currentContent = [];

  for (let i = contact.endIndex; i < lines.length; i++) {
    const line = lines[i];
    const sectionType = detectSectionType(line);

    if (sectionType) {
      // Save previous section
      if (currentSection) {
        sections.push({
          type: currentSection.type,
          title: currentSection.title,
          content: currentContent.join('\n').trim()
        });
      }
      currentSection = { type: sectionType, title: line.trim() };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    } else {
      // Content before any detected section — treat as summary if substantial
      if (line.trim().length > 20) {
        if (!currentSection) {
          currentSection = { type: 'summary', title: 'Summary' };
          currentContent = [];
        }
        currentContent.push(line);
      }
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push({
      type: currentSection.type,
      title: currentSection.title,
      content: currentContent.join('\n').trim()
    });
  }

  return { contact, sections };
}

/**
 * Full pipeline: Takes a PDF ArrayBuffer, extracts text, parses into sections.
 * @param {ArrayBuffer} pdfBuffer - The uploaded PDF file
 * @returns {Promise<{ contact: Object, sections: Array }>}
 */
async function parseResumePDF(pdfBuffer) {
  const rawText = await extractTextFromPDF(pdfBuffer);
  return parseResumeText(rawText);
}
