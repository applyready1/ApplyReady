/**
 * resume-data.js — Structured Resume Data Model
 * 
 * Defines a component-based resume structure that's easy to edit and render.
 * Each component (skill, project, experience, education) is self-contained.
 * 
 * This approach makes it easy to:
 * - Edit individual components
 * - Add/remove items
 * - Add skills from job postings
 * - Generate clean PDFs
 */

/**
 * Create an empty resume structure
 */
function createEmptyResume() {
  return {
    contact: {
      name: '',
      email: '',
      phone: '',
      linkedin: ''
    },
    summary: '',
    skills: [],        // Array of skill objects
    projects: [],      // Array of project objects
    education: [],     // Array of education objects
    experience: []     // Array of experience objects
  };
}

/**
 * Create a skill component
 */
function createSkill(name = '', category = '', proficiency = '') {
  return {
    id: generateId(),
    name: name.trim(),
    category: category.trim(),  // e.g., "Programming", "Testing", "Communication"
    proficiency: proficiency.trim()  // e.g., "Expert", "Intermediate", "Basic"
  };
}

/**
 * Create a project component
 */
function createProject(name = '', description = '', link = '') {
  return {
    id: generateId(),
    name: name.trim(),
    description: description.trim(),
    link: link.trim()
  };
}

/**
 * Create an education component
 */
function createEducation(school = '', degree = '', field = '', timeline = '', description = '') {
  return {
    id: generateId(),
    school: school.trim(),
    degree: degree.trim(),         // e.g., "Bachelor of Science"
    field: field.trim(),           // e.g., "Computer Science"
    timeline: timeline.trim(),     // e.g., "2018 - 2022"
    description: description.trim()
  };
}

/**
 * Create an experience component
 */
function createExperience(company = '', title = '', timeline = '', description = '') {
  return {
    id: generateId(),
    company: company.trim(),
    title: title.trim(),
    timeline: timeline.trim(),     // e.g., "Jan 2023 - Present"
    description: description.trim()  // Bullet points or paragraph
  };
}

/**
 * Generate a unique ID for components
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a skill to resume
 */
function addSkill(resume, skill) {
  if (!resume.skills) resume.skills = [];
  resume.skills.push(skill);
  return resume;
}

/**
 * Remove a skill from resume by ID
 */
function removeSkill(resume, skillId) {
  if (!resume.skills) return resume;
  resume.skills = resume.skills.filter(s => s.id !== skillId);
  return resume;
}

/**
 * Update a skill in resume
 */
function updateSkill(resume, skillId, updates) {
  if (!resume.skills) return resume;
  const skill = resume.skills.find(s => s.id === skillId);
  if (skill) {
    Object.assign(skill, updates);
  }
  return resume;
}

/**
 * Add experience to resume
 */
function addExperience(resume, experience) {
  if (!resume.experience) resume.experience = [];
  resume.experience.push(experience);
  return resume;
}

/**
 * Remove experience by ID
 */
function removeExperience(resume, expId) {
  if (!resume.experience) return resume;
  resume.experience = resume.experience.filter(e => e.id !== expId);
  return resume;
}

/**
 * Update experience
 */
function updateExperience(resume, expId, updates) {
  if (!resume.experience) return resume;
  const exp = resume.experience.find(e => e.id === expId);
  if (exp) {
    Object.assign(exp, updates);
  }
  return resume;
}

/**
 * Similar helpers for education and projects
 */
function addEducation(resume, education) {
  if (!resume.education) resume.education = [];
  resume.education.push(education);
  return resume;
}

function removeEducation(resume, eduId) {
  if (!resume.education) return resume;
  resume.education = resume.education.filter(e => e.id !== eduId);
  return resume;
}

function updateEducation(resume, eduId, updates) {
  if (!resume.education) return resume;
  const edu = resume.education.find(e => e.id === eduId);
  if (edu) {
    Object.assign(edu, updates);
  }
  return resume;
}

function addProject(resume, project) {
  if (!resume.projects) resume.projects = [];
  resume.projects.push(project);
  return resume;
}

function removeProject(resume, projId) {
  if (!resume.projects) return resume;
  resume.projects = resume.projects.filter(p => p.id !== projId);
  return resume;
}

function updateProject(resume, projId, updates) {
  if (!resume.projects) return resume;
  const proj = resume.projects.find(p => p.id === projId);
  if (proj) {
    Object.assign(proj, updates);
  }
  return resume;
}
