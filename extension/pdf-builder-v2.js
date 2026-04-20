/**
 * pdf-builder-v2.js — Structured Resume to PDF
 * 
 * Takes component-structured resume data and generates a clean PDF.
 * Much simpler since data is already in proper format.
 */

function buildResumePDFv2(resume, options = {}) {
  const {
    fontFamily = 'helvetica',
    fontSize = 10,
    headerSize = 13,
    subHeaderSize = 11,
    nameSize = 16,
    marginLeft = 15,
    marginRight = 15,
    marginTop = 12,
    marginBottom = 12,
    lineSpacing = 1.3
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

  // Safe text cleanup
  function cleanText(text) {
    if (!text) return '';
    // Remove ALL bullet/indexing characters and artifacts
    let cleaned = text.replace(/[%|§¶`^~•\-\*]/g, '').trim();
    // Remove any line that starts only with indexing (%, |, •, -, *, etc)
    cleaned = cleaned.replace(/^[%|•\-\*§¶`^~]\s*/gm, '').trim();
    return cleaned;
  }

  function checkPageBreak(neededSpace = 10) {
    if (y + neededSpace > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  }

  function addText(text, size = fontSize, isBold = false, indentMM = 0) {
    const cleaned = cleanText(text);
    if (!cleaned) return;

    doc.setFont(fontFamily, isBold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);

    const effectiveWidth = maxWidth - indentMM;
    const wrappedLines = doc.splitTextToSize(cleaned, effectiveWidth);
    const lineHeight = (size / 72) * 25.4 * lineSpacing;

    wrappedLines.forEach(line => {
      checkPageBreak(lineHeight);
      doc.text(line, marginLeft + indentMM, y);
      y += lineHeight;
    });
  }

  function addSpace(mm = 2) {
    y += mm;
  }

  function addLine() {
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 3;
  }

  // ── NAME AND CONTACT ──────────────────────

  if (resume.contact.name) {
    addText(resume.contact.name, nameSize, true);
    addSpace(1);
  }

  const contactParts = [];
  if (resume.contact.email) contactParts.push(resume.contact.email);
  if (resume.contact.phone) contactParts.push(resume.contact.phone);
  if (resume.contact.linkedin) contactParts.push(resume.contact.linkedin);

  if (contactParts.length > 0) {
    addText(contactParts.join(' - '), fontSize - 1, false);
  }

  addSpace(3);
  // ── SUMMARY ───────────────────────────────

  if (resume.summary) {
    checkPageBreak(15);
    addText('PROFESSIONAL SUMMARY', headerSize, true);
    addSpace(1);
    addText(resume.summary, fontSize, false);
    addSpace(4);
  }

  // ── EXPERIENCE ────────────────────────────

  if (resume.experience && resume.experience.length > 0) {
    addSpace(2); // Add line space before section
    checkPageBreak(20);
    addText('WORK EXPERIENCE', headerSize, true);
    addSpace(1.5);

    for (const exp of resume.experience) {
      checkPageBreak(15);

      // Job title
      if (exp.title) {
        addText(exp.title, subHeaderSize, true);
        addSpace(0.3);
      }

      // Company and timeline
      const meta = [exp.company, exp.timeline].filter(x => x).join(' — ');
      if (meta) {
        addText(meta, fontSize - 0.5, false);
        addSpace(0.5);
      }

      // Description (clean bullets from each line)
      if (exp.description) {
        const lines = exp.description.split('\n').filter(b => b.trim());
        for (const line of lines) {
          // Remove bullet characters from beginning of each line
          const cleanedLine = line.replace(/^[%|•\-\*§¶`^~]+\s*/g, '').trim();
          if (cleanedLine.length > 0) {
            addText(cleanedLine, fontSize, false, 2);
            addSpace(0.6);
          }
        }
      }

      addSpace(1.5);
    }

    addSpace(1);
  }

  // ── EDUCATION ─────────────────────────────

  if (resume.education && resume.education.length > 0) {
    addSpace(2); // Add line space before section
    checkPageBreak(20);
    addText('EDUCATION', headerSize, true);
    addSpace(1.5);

    for (const edu of resume.education) {
      checkPageBreak(12);

      // Degree and field
      let degreeStr = edu.degree;
      if (edu.field) degreeStr += ' in ' + edu.field;
      if (degreeStr) {
        addText(degreeStr, subHeaderSize, true);
        addSpace(0.3);
      }

      // School and timeline
      const meta = [edu.school, edu.timeline].filter(x => x).join(' — ');
      if (meta) {
        addText(meta, fontSize - 0.5, false);
        addSpace(0.5);
      }

      // Description
      if (edu.description) {
        addText(edu.description, fontSize, false);
      }

      addSpace(1.5);
    }

    addSpace(1);
  }

  // ── SKILLS ────────────────────────────────

  if (resume.skills && resume.skills.length > 0) {
    addSpace(2); // Add line space before section
    checkPageBreak(15);
    addText('SKILLS', headerSize, true);
    addSpace(1.5);

    // Group skills by category if available
    const byCategory = {};
    const uncategorized = [];

    for (const skill of resume.skills) {
      if (skill.category) {
        if (!byCategory[skill.category]) byCategory[skill.category] = [];
        byCategory[skill.category].push(skill);
      } else {
        uncategorized.push(skill);
      }
    }

    // Render categorized skills
    for (const [category, skills] of Object.entries(byCategory)) {
      addText(category, subHeaderSize, true);
      const skillNames = skills.map(s => s.name).join(', ');
      addText(skillNames, fontSize, false);
      addSpace(1);
    }

    // Render uncategorized skills
    if (uncategorized.length > 0) {
      const skillNames = uncategorized.map(s => s.name).join(', ');
      addText(skillNames, fontSize, false);
    }

    addSpace(1.5);
  }

  // ── PROJECTS ──────────────────────────────

  if (resume.projects && resume.projects.length > 0) {
    addSpace(2); // Add line space before section
    checkPageBreak(15);
    addText('PROJECTS', headerSize, true);
    addSpace(1.5);

    for (const proj of resume.projects) {
      checkPageBreak(10);

      if (proj.name) {
        addText(proj.name, subHeaderSize, true);
        addSpace(0.3);
      }

      if (proj.description) {
        addText(proj.description, fontSize, false);
      }

      addSpace(1.2);
    }
  }

  return doc;
}

/**
 * Download the resume PDF
 */
function downloadResumePDFv2(resume, jobTitle = '', company = '') {
  const doc = buildResumePDFv2(resume);

  const name = (resume.contact.name || 'Resume').replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, '_');
  const cleanCompany = company.replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, '_');

  const filename = cleanCompany
    ? `${name}_${cleanCompany}_Resume.pdf`
    : `${name}_Resume.pdf`;

  doc.save(filename);
}
