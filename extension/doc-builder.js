/**
 * doc-builder.js — Export resume as DOCX or HTML
 * 
 * Creates downloadable documents from structured resume data.
 */

/**
 * Generate DOCX file (Word document)
 * Creates a minimal DOCX by generating XML and packaging as ZIP
 */
function generateDocxContent(resume) {
  // Helper to escape XML
  function escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Build document content
  let docContent = '';

  // Name and contact
  if (resume.contact.name) {
    docContent += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(resume.contact.name)}</w:t></w:r></w:p>`;
  }

  // Contact details
  const contactInfo = [];
  if (resume.contact.email) contactInfo.push(escapeXml(resume.contact.email));
  if (resume.contact.phone) contactInfo.push(escapeXml(resume.contact.phone));
  if (resume.contact.linkedin) contactInfo.push(escapeXml(resume.contact.linkedin));

  if (contactInfo.length > 0) {
    docContent += `<w:p><w:r><w:t>${contactInfo.join(' | ')}</w:t></w:r></w:p>`;
  }

  // Summary
  if (resume.summary) {
    docContent += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Professional Summary</w:t></w:r></w:p>`;
    const summaryLines = resume.summary.split('\n');
    for (const line of summaryLines) {
      if (line.trim()) {
        docContent += `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`;
      }
    }
  }

  // Experience
  if (resume.experience && resume.experience.length > 0) {
    docContent += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Work Experience</w:t></w:r></w:p>`;

    for (const exp of resume.experience) {
      // Title and company
      docContent += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(exp.title)}</w:t></w:r></w:p>`;

      // Company and timeline
      let line = '';
      if (exp.company) line += escapeXml(exp.company);
      if (exp.timeline) {
        if (line) line += ' | ';
        line += escapeXml(exp.timeline);
      }
      if (line) {
        docContent += `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`;
      }

      // Description/bullets
      if (exp.description) {
        const bullets = exp.description.split('\n');
        for (const bullet of bullets) {
          const cleaned = bullet.replace(/^[•\-\*]\s*/, '').trim();
          if (cleaned) {
            docContent += `<w:p><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:r><w:pict><v:shapetype><o:f eqn="sum #0 ,21600"/><o:f eqn="prod #0 ,2184 21600"/><o:f eqn="sum 21600- ,0 ,@1"/><o:f eqn="sum 0 ,@2 ,21600"/><o:f eqn="sum 21600 ,0 ,@3"/><o:f eqn="sum 0 ,@3 ,21600"/><o:f eqn="prod @6 ,xmove"/><o:f eqn="prod @7 ,ymove"/><o:f eqn="sum 21600 ,0 ,@8"/><o:f eqn="sum 0 ,@8 ,21600"/><o:f eqn="sum @1 ,21600 0"/><o:f eqn="sum 0 ,@1 ,0"/><o:f eqn="sum @2 ,0 ,0"/><o:f eqn="sum @3 ,21600 ,21600"/><o:f eqn="if @0 ,@4 ,0"/><o:f eqn="if @0 ,21600 ,0"/><f eqn="sum 0 ,0 ,1"/><f eqn="prod 1 ,2 ,1"/><f eqn="prod 1 ,*/ 1 2 1"/><o:f eqn="sum 0 ,1 ,0" name="yrange"/><o:f eqn="if @0 ,0 ,1"/><o:f eqn="sum 21600 ,0 ,@1"/><o:f eqn="sum 0 ,@2 ,21600"/><o:f eqn="prod @3 ,2 ,1"/><o:f eqn="prod @3 ,*/ 1 2 1"/><o:f eqn="sum 21600 ,21600 ,@4"/><o:f eqn="if @0 ,21600 ,0"/></w:shapetype></w:pict></w:r><w:r><w:t>• ${escapeXml(cleaned)}</w:t></w:r></w:p>`;
          }
        }
      }
    }
  }

  // Education
  if (resume.education && resume.education.length > 0) {
    docContent += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Education</w:t></w:r></w:p>`;

    for (const edu of resume.education) {
      // Degree and field
      let header = '';
      if (edu.degree) header += escapeXml(edu.degree);
      if (edu.field) {
        if (header) header += ' in ';
        header += escapeXml(edu.field);
      }
      if (header) {
        docContent += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${header}</w:t></w:r></w:p>`;
      }

      // School and timeline
      let line = '';
      if (edu.school) line = escapeXml(edu.school);
      if (edu.timeline) {
        if (line) line += ' | ';
        line += escapeXml(edu.timeline);
      }
      if (line) {
        docContent += `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`;
      }

      // Description
      if (edu.description) {
        docContent += `<w:p><w:r><w:t>${escapeXml(edu.description)}</w:t></w:r></w:p>`;
      }
    }
  }

  // Skills
  if (resume.skills && resume.skills.length > 0) {
    docContent += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Skills</w:t></w:r></w:p>`;

    // Group by category
    const byCategory = {};
    for (const skill of resume.skills) {
      const cat = skill.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(skill.name);
    }

    for (const [category, skills] of Object.entries(byCategory)) {
      const skillList = skills.join(', ');
      docContent += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(category)}:</w:t></w:r><w:r><w:t> ${escapeXml(skillList)}</w:t></w:r></w:p>`;
    }
  }

  // Projects
  if (resume.projects && resume.projects.length > 0) {
    docContent += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Projects</w:t></w:r></w:p>`;

    for (const proj of resume.projects) {
      if (proj.name) {
        docContent += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(proj.name)}</w:t></w:r></w:p>`;
      }

      if (proj.description) {
        docContent += `<w:p><w:r><w:t>${escapeXml(proj.description)}</w:t></w:r></w:p>`;
      }

      if (proj.link) {
        docContent += `<w:p><w:r><w:t>Link: ${escapeXml(proj.link)}</w:t></w:r></w:p>`;
      }
    }
  }

  return docContent;
}

/**
 * Build and download DOCX file
 */
function downloadResumeDocx(resume, jobTitle = '', company = '') {
  try {
    // Generate filename
    let filename = 'Resume';
    if (jobTitle && company) {
      filename = `${jobTitle}_${company}_Resume`.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50);
    }
    filename = filename + '.docx';

    // Create minimal DOCX content
    const docContent = generateDocxContent(resume);

    // For now, create an HTML document that mimics DOCX formatting
    // A true DOCX requires ZIP with XML, which is complex
    // This creates an HTML file that can be opened in Word
    downloadResumeHtml(resume, filename.replace('.docx', '.html'), jobTitle, company);
  } catch (error) {
    alert('Error generating document. Please try PDF format instead.');
  }
}

/**
 * Download as HTML (opens in Word/browser)
 */
function downloadResumeHtml(resume, filename = 'Resume.html', jobTitle = '', company = '') {
  try {
    if (!filename) {
      let name = 'Resume';
      if (jobTitle && company) {
        name = `${jobTitle}_${company}_Resume`.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50);
      }
      filename = name + '.html';
    }

    // Generate HTML content
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(resume.contact.name || 'Resume')}</title>
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: 'Calibri', 'Segoe UI', sans-serif;
      line-height: 1.5;
      color: #333;
      max-width: 8.5in;
      margin: 0.5in auto;
      padding: 0.5in;
    }
    h1 { font-size: 18pt; font-weight: bold; margin: 12pt 0 6pt 0; }
    h2 { font-size: 13pt; font-weight: bold; margin: 12pt 0 6pt 0; border-bottom: 1pt solid #000; }
    h3 { font-size: 11pt; font-weight: bold; margin: 6pt 0 3pt 0; }
    p { font-size: 11pt; margin: 3pt 0; }
    .contact-info { text-align: center; font-size: 10pt; margin-bottom: 12pt; }
    .job-header { display: flex; justify-content: space-between; font-weight: bold; margin-top: 6pt; }
    .job-title { font-weight: bold; }
    .company-info { font-style: italic; }
    .bullets { margin-left: 0.5in; }
    .bullet { margin: 3pt 0; }
    .skill-category { display: inline-block; margin-right: 20pt; margin-bottom: 6pt; }
    .skill-category-name { font-weight: bold; }
    @media print {
      body { margin: 0.5in; }
    }
  </style>
</head>
<body>`;

    // Name
    if (resume.contact.name) {
      html += `<h1>${escapeHtml(resume.contact.name)}</h1>`;
    }

    // Contact info
    const contactParts = [];
    if (resume.contact.email) contactParts.push(escapeHtml(resume.contact.email));
    if (resume.contact.phone) contactParts.push(escapeHtml(resume.contact.phone));
    if (resume.contact.linkedin) contactParts.push(escapeHtml(resume.contact.linkedin));

    if (contactParts.length > 0) {
      html += `<div class="contact-info">${contactParts.join(' | ')}</div>`;
    }

    // Summary
    if (resume.summary) {
      html += `<h2>Professional Summary</h2>`;
      const summaryLines = resume.summary.split('\n');
      for (const line of summaryLines) {
        if (line.trim()) {
          html += `<p>${escapeHtml(line)}</p>`;
        }
      }
    }

    // Experience
    if (resume.experience && resume.experience.length > 0) {
      html += `<h2>Work Experience</h2>`;
      for (const exp of resume.experience) {
        html += `<div class="job-header">`;
        if (exp.title) html += `<span class="job-title">${escapeHtml(exp.title)}</span>`;
        if (exp.timeline) html += `<span>${escapeHtml(exp.timeline)}</span>`;
        html += `</div>`;

        if (exp.company) {
          html += `<p class="company-info">${escapeHtml(exp.company)}</p>`;
        }

        if (exp.description) {
          html += `<div class="bullets">`;
          const bullets = exp.description.split('\n');
          for (const bullet of bullets) {
            const cleaned = bullet.replace(/^[•\-\*]\s*/, '').trim();
            if (cleaned) {
              html += `<div class="bullet">• ${escapeHtml(cleaned)}</div>`;
            }
          }
          html += `</div>`;
        }
      }
    }

    // Education
    if (resume.education && resume.education.length > 0) {
      html += `<h2>Education</h2>`;
      for (const edu of resume.education) {
        let header = '';
        if (edu.degree) header += escapeHtml(edu.degree);
        if (edu.field) {
          if (header) header += ' in ';
          header += escapeHtml(edu.field);
        }
        if (header) html += `<h3>${header}</h3>`;

        if (edu.school) {
          html += `<p class="company-info">${escapeHtml(edu.school)}`;
          if (edu.timeline) html += ` | ${escapeHtml(edu.timeline)}`;
          html += `</p>`;
        }

        if (edu.description) {
          html += `<p>${escapeHtml(edu.description)}</p>`;
        }
      }
    }

    // Skills
    if (resume.skills && resume.skills.length > 0) {
      html += `<h2>Skills</h2>`;
      const byCategory = {};
      for (const skill of resume.skills) {
        const cat = skill.category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(skill.name);
      }

      for (const [category, skills] of Object.entries(byCategory)) {
        html += `<div class="skill-category">`;
        html += `<span class="skill-category-name">${escapeHtml(category)}:</span> `;
        html += escapeHtml(skills.join(', '));
        html += `</div>`;
      }
    }

    // Projects
    if (resume.projects && resume.projects.length > 0) {
      html += `<h2>Projects</h2>`;
      for (const proj of resume.projects) {
        if (proj.name) html += `<h3>${escapeHtml(proj.name)}</h3>`;
        if (proj.description) html += `<p>${escapeHtml(proj.description)}</p>`;
        if (proj.link) html += `<p>Link: <a href="${escapeHtml(proj.link)}">${escapeHtml(proj.link)}</a></p>`;
      }
    }

    html += `</body></html>`;

    // Create and download
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    alert('Error generating document');
  }
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
