/**
 * component-ui.js — UI for editing resume components
 * 
 * Renders and manages component edit forms for skills, experience, education, projects.
 */

/**
 * Render a skill component row
 */
function renderSkillRow(skill) {
  return `
    <div class="component-row skill-row" data-id="${skill.id}">
      <div class="component-content">
        <div class="component-main">
          <strong>${skill.name}</strong>
          ${skill.category ? `<span class="badge">${skill.category}</span>` : ''}
        </div>
        <div class="component-meta">
          ${skill.proficiency ? `Proficiency: ${skill.proficiency}` : 'No proficiency level set'}
        </div>
      </div>
      <div class="component-actions">
        <button class="btn-edit" onclick="editSkill('${skill.id}')">Edit</button>
        <button class="btn-remove" onclick="removeComponentRow('${skill.id}')">Remove</button>
      </div>
    </div>
  `;
}

/**
 * Render experience component row
 */
function renderExperienceRow(exp) {
  return `
    <div class="component-row experience-row" data-id="${exp.id}">
      <div class="component-content">
        <div class="component-main">
          <strong>${exp.title}</strong> at <strong>${exp.company}</strong>
        </div>
        <div class="component-meta">
          ${exp.timeline || 'No timeline set'}
        </div>
        <div class="component-preview">
          ${exp.description.split('\n').slice(0, 2).join(' ') || 'No description'}
        </div>
      </div>
      <div class="component-actions">
        <button class="btn-edit" onclick="editExperience('${exp.id}')">Edit</button>
        <button class="btn-remove" onclick="removeComponentRow('${exp.id}')">Remove</button>
      </div>
    </div>
  `;
}

/**
 * Render education component row
 */
function renderEducationRow(edu) {
  return `
    <div class="component-row education-row" data-id="${edu.id}">
      <div class="component-content">
        <div class="component-main">
          <strong>${edu.degree}</strong>${edu.field ? ` in ${edu.field}` : ''}
        </div>
        <div class="component-meta">
          ${edu.school} • ${edu.timeline || 'No timeline'}
        </div>
        ${edu.description ? `<div class="component-preview">${edu.description}</div>` : ''}
      </div>
      <div class="component-actions">
        <button class="btn-edit" onclick="editEducation('${edu.id}')">Edit</button>
        <button class="btn-remove" onclick="removeComponentRow('${edu.id}')">Remove</button>
      </div>
    </div>
  `;
}

/**
 * Render project component row
 */
function renderProjectRow(proj) {
  return `
    <div class="component-row project-row" data-id="${proj.id}">
      <div class="component-content">
        <div class="component-main">
          <strong>${proj.name}</strong>
        </div>
        <div class="component-preview">
          ${proj.description || 'No description'}
        </div>
        ${proj.link ? `<div class="component-meta"><a href="${proj.link}" target="_blank">View Project</a></div>` : ''}
      </div>
      <div class="component-actions">
        <button class="btn-edit" onclick="editProject('${proj.id}')">Edit</button>
        <button class="btn-remove" onclick="removeComponentRow('${proj.id}')">Remove</button>
      </div>
    </div>
  `;
}

/**
 * Render edit form for skill
 */
function renderSkillForm(skill = null) {
  const id = skill?.id || '';
  const name = skill?.name || '';
  const category = skill?.category || '';
  const proficiency = skill?.proficiency || '';

  return `
    <div class="component-form skill-form">
      <div class="form-group">
        <label>Skill Name *</label>
        <input type="text" class="form-control" id="skill-name" placeholder="e.g., Python, Testing, Leadership" value="${name}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <input type="text" class="form-control" id="skill-category" placeholder="e.g., Programming, Communication" value="${category}">
        </div>
        <div class="form-group">
          <label>Proficiency Level</label>
          <select class="form-control" id="skill-proficiency">
            <option value="">-- Select --</option>
            <option ${proficiency === 'Expert' ? 'selected' : ''}>Expert</option>
            <option ${proficiency === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
            <option ${proficiency === 'Basic' ? 'selected' : ''}>Basic</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveSkillForm('${id}')">Save Skill</button>
        <button class="btn btn-secondary" onclick="cancelEdit()">Cancel</button>
      </div>
    </div>
  `;
}

/**
 * Render edit form for experience
 */
function renderExperienceForm(exp = null) {
  const id = exp?.id || '';
  const company = exp?.company || '';
  const title = exp?.title || '';
  const timeline = exp?.timeline || '';
  const description = exp?.description || '';

  return `
    <div class="component-form experience-form">
      <div class="form-row">
        <div class="form-group">
          <label>Job Title *</label>
          <input type="text" class="form-control" id="exp-title" placeholder="e.g., Senior Engineer" value="${title}">
        </div>
        <div class="form-group">
          <label>Company *</label>
          <input type="text" class="form-control" id="exp-company" placeholder="e.g., Google" value="${company}">
        </div>
      </div>
      <div class="form-group">
        <label>Timeline</label>
        <input type="text" class="form-control" id="exp-timeline" placeholder="e.g., Jan 2020 - Present" value="${timeline}">
      </div>
      <div class="form-group">
        <label>Description (one bullet per line)</label>
        <textarea class="form-control" id="exp-description" placeholder="• Led team of 5 engineers&#10;• Improved performance by 40%" rows="5">${description}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveExperienceForm('${id}')">Save Experience</button>
        <button class="btn btn-secondary" onclick="cancelEdit()">Cancel</button>
      </div>
    </div>
  `;
}

/**
 * Render edit form for education
 */
function renderEducationForm(edu = null) {
  const id = edu?.id || '';
  const school = edu?.school || '';
  const degree = edu?.degree || '';
  const field = edu?.field || '';
  const timeline = edu?.timeline || '';
  const description = edu?.description || '';

  return `
    <div class="component-form education-form">
      <div class="form-row">
        <div class="form-group">
          <label>Degree *</label>
          <input type="text" class="form-control" id="edu-degree" placeholder="e.g., Bachelor of Science" value="${degree}">
        </div>
        <div class="form-group">
          <label>Field of Study</label>
          <input type="text" class="form-control" id="edu-field" placeholder="e.g., Computer Science" value="${field}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>School/University *</label>
          <input type="text" class="form-control" id="edu-school" placeholder="e.g., MIT" value="${school}">
        </div>
        <div class="form-group">
          <label>Timeline</label>
          <input type="text" class="form-control" id="edu-timeline" placeholder="e.g., 2018 - 2022" value="${timeline}">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="form-control" id="edu-description" placeholder="GPA, honors, relevant coursework, etc." rows="3">${description}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveEducationForm('${id}')">Save Education</button>
        <button class="btn btn-secondary" onclick="cancelEdit()">Cancel</button>
      </div>
    </div>
  `;
}

/**
 * Render edit form for project
 */
function renderProjectForm(proj = null) {
  const id = proj?.id || '';
  const name = proj?.name || '';
  const description = proj?.description || '';
  const link = proj?.link || '';

  return `
    <div class="component-form project-form">
      <div class="form-group">
        <label>Project Name *</label>
        <input type="text" class="form-control" id="proj-name" placeholder="e.g., Resume Tailor App" value="${name}">
      </div>
      <div class="form-group">
        <label>Description *</label>
        <textarea class="form-control" id="proj-description" placeholder="Describe the project and your role" rows="4">${description}</textarea>
      </div>
      <div class="form-group">
        <label>Project Link</label>
        <input type="url" class="form-control" id="proj-link" placeholder="https://github.com/..." value="${link}">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="saveProjectForm('${id}')">Save Project</button>
        <button class="btn btn-secondary" onclick="cancelEdit()">Cancel</button>
      </div>
    </div>
  `;
}

/**
 * Render all components for a resume
 */
function renderResumeComponents(resume) {
  let html = '';

  // Skills
  if (resume.skills && resume.skills.length > 0) {
    html += '<div class="component-section"><h3>Skills</h3>';
    html += resume.skills.map(s => renderSkillRow(s)).join('');
    html += '</div>';
  }

  // Experience
  if (resume.experience && resume.experience.length > 0) {
    html += '<div class="component-section"><h3>Work Experience</h3>';
    html += resume.experience.map(e => renderExperienceRow(e)).join('');
    html += '</div>';
  }

  // Education
  if (resume.education && resume.education.length > 0) {
    html += '<div class="component-section"><h3>Education</h3>';
    html += resume.education.map(e => renderEducationRow(e)).join('');
    html += '</div>';
  }

  // Projects
  if (resume.projects && resume.projects.length > 0) {
    html += '<div class="component-section"><h3>Projects</h3>';
    html += resume.projects.map(p => renderProjectRow(p)).join('');
    html += '</div>';
  }

  return html;
}
