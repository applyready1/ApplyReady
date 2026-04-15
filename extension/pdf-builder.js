/**
 * pdf-builder.js — Tailored Resume PDF Generator
 * 
 * Takes structured resume data (with reordered sections and highlighted
 * keywords) and generates a clean, ATS-friendly PDF using jsPDF.
 * 
 * Design: Single-column, minimal formatting, standard fonts.
 * This ensures maximum ATS compatibility.
 * 
 * All processing is 100% client-side.
 * 
 * Dependencies: libs/jspdf.umd.min.js
 * Imported by: popup.js
 */

/**
 * buildResumePDF - Generates a clean, ATS-friendly resume PDF
 * 
 * This creates a standard resume template, NOT a copy of the user's original.
 * The original resume formatting (bold, italic, special styles) is intentionally
 * NOT preserved - we reconstruct a clean, plain-text resume optimized for ATS systems.
 * 
 * The resume includes:
 * - User's contact information
 * - Sections reordered by job relevance
 * - Clean, readable formatting
 * - No complex styling (for ATS compatibility)
 */
function buildResumePDF(resumeData, matchingKeywords = [], options = {}) {
  const {
    fontFamily = 'helvetica',
    fontSize = 10,
    headerSize = 12,
    nameSize = 14,
    marginLeft = 15,
    marginRight = 15,
    marginTop = 12,
    marginBottom = 12
  } = options;

  /* global jspdf */
  const { jsPDF } = jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginLeft - marginRight;
  let y = marginTop;

  /**
   * Check if we need a page break
   */
  function checkPageBreak(neededSpace = 10) {
    if (y + neededSpace > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  }

  /**
   * Clean extracted text: remove PDF artifacts, normalize whitespace
   */
  function cleanText(text) {
    return text
      .replace(/[\%\|]/g, '') // Remove PDF extraction artifacts
      .replace(/\s+/g, ' ')    // Normalize multiple spaces
      .trim();
  }

  /**
   * Write a simple line of text (no formatting)
   */
  function writeLine(text, size = fontSize, isBold = false) {
    doc.setFont(fontFamily, isBold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);

    const cleanedText = cleanText(text);
    if (!cleanedText) return;

    const lines = doc.splitTextToSize(cleanedText, maxWidth);
    const lineHeight = size * 0.35;

    for (const line of lines) {
      checkPageBreak(lineHeight + 1);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
  }

  /**
   * Parse and render section content cleanly
   * Split by sentences for all section types
   */
  function formatSectionContent(sectionType, rawContent) {
    // Aggressive cleaning: remove all PDF artifacts
    let cleaned = rawContent
      .replace(/[\%\|\*\^\~\`]/g, '')  // Remove PDF extraction artifacts
      .replace(/[•\-]+\s*/g, '')        // Remove existing bullets
      .replace(/\s+/g, ' ')             // Collapse multiple spaces/newlines
      .replace(/—/g, '-')               // Normalize dashes
      .trim();

    if (!cleaned || cleaned.length < 5) return [];

    // Split into logical chunks by sentences
    const sentences = cleaned
      .split(/(?<=[a-z])\.\s+(?=[A-Z])|(?<=[a-z])\s+(?=[A-Z][a-z]+\s*[,—-])/g)
      .map(s => s.trim())
      .filter(s => s.length > 5);

    // If no sentences found, split by any capitalized section
    if (sentences.length === 0) {
      const parts = cleaned.split(/\s+(?=[A-Z])/);
      return parts.map(p => [p.trim()]).filter(p => p[0].length > 5);
    }

    return sentences.map(s => [s]);
  }

  // ── CONTACT INFORMATION ──────────────────────────────────
  
  const { contact } = resumeData;

  if (contact.name) {
    writeLine(contact.name, nameSize, true);
  }

  // Contact details line
  const contactParts = [];
  if (contact.email) contactParts.push(contact.email);
  if (contact.phone) contactParts.push(contact.phone);
  if (contact.linkedin) contactParts.push(contact.linkedin);
  
  if (contactParts.length) {
    writeLine(contactParts.join(' | '), fontSize - 1, false);
  }

  y += 3;

  // Horizontal separator
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 4;

  // ── SECTIONS ──────────────────────────────────────────────

  for (const section of resumeData.sections) {
    checkPageBreak(12);

    // Section header
    writeLine(section.title.toUpperCase(), headerSize, true);
    y += 1;

    // Parse and format section content
    const contentEntries = formatSectionContent(section.type, section.content);

    for (const entry of contentEntries) {
      if (entry.length === 0) continue;

      // Each entry is a single-item array [text]
      // Format as a bullet point
      const bulletText = '• ' + entry[0];
      writeLine(bulletText, fontSize, false);
      y += 0.5;
    }

    y += 2; // Gap between sections
  }

  return doc;
}

/**
 * Downloads the resume as a PDF file.
 * 
 * The generated PDF is a CLEAN, ATS-FRIENDLY template - NOT a replica of the user's original.
 * Original formatting (bold, italic, colors, special styling) is intentionally NOT preserved.
 * We reconstruct the resume in a plain, standard format optimized for Applicant Tracking Systems.
 * 
 * @param {{ contact: Object, sections: Array }} resumeData - Structured resume data
 * @param {string[]} matchingKeywords - Keywords from job matching
 * @param {string} jobTitle - Job title (optional, for filename)
 * @param {string} company - Company name (optional, for filename)
 */
function downloadResumePDF(resumeData, matchingKeywords = [], jobTitle = '', company = '') {
  const doc = buildResumePDF(resumeData, matchingKeywords);

  // Build a clean filename
  const name = resumeData.contact.name || 'Resume';
  const cleanName = name.replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, '_');
  const cleanCompany = company.replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, '_');

  const filename = cleanCompany
    ? `${cleanName}_${cleanCompany}_Tailored.pdf`
    : `${cleanName}_Tailored.pdf`;

  doc.save(filename);
}
