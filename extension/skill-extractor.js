/**
 * skill-extractor.js — Extract skills from job postings
 * 
 * Contains utilities to extract and suggest skills from job descriptions.
 * Works with content.js to pass skills to the popup.
 */

/**
 * Common skill categories and keywords
 */
const SKILL_CATEGORIES = {
  'Programming Languages': [
    'Python', 'JavaScript', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'Swift',
    'PHP', 'TypeScript', 'Kotlin', 'Scala', 'Haskell', 'Perl', 'R', 'MATLAB'
  ],
  'Web Technologies': [
    'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'ASP.NET',
    'HTML', 'CSS', 'REST', 'GraphQL', 'WebSocket', 'AJAX', 'jQuery'
  ],
  'Databases': [
    'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Oracle', 'Redis', 'Elasticsearch',
    'DynamoDB', 'Cassandra', 'Firebase'
  ],
  'Cloud & DevOps': [
    'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins',
    'GitLab', 'GitHub Actions', 'Terraform', 'Ansible', 'CloudFormation'
  ],
  'Data & Analytics': [
    'Data Analysis', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch',
    'Pandas', 'NumPy', 'Scikit-learn', 'Excel', 'Tableau', 'Power BI', 'SQL'
  ],
  'Testing & QA': [
    'Unit Testing', 'Integration Testing', 'Selenium', 'Cypress', 'Jest', 'Pytest',
    'JUnit', 'Test Automation', 'BDD', 'TDD', 'JIRA'
  ],
  'Soft Skills': [
    'Leadership', 'Communication', 'Problem Solving', 'Project Management',
    'Teamwork', 'Critical Thinking', 'Collaboration', 'Time Management',
    'Presentation', 'Negotiation'
  ]
};

/**
 * Extract skills from job description
 */
function extractSkillsFromJobDescription(jobDescription) {
  if (!jobDescription) return [];

  const lowerDesc = jobDescription.toLowerCase();
  const foundSkills = new Set();

  // Search for each skill in the job description
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    for (const skill of skills) {
      const skillLower = skill.toLowerCase();
      
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${skillLower}\\b`, 'gi');
      if (regex.test(lowerDesc)) {
        foundSkills.add({ name: skill, category });
      }
    }
  }

  return Array.from(foundSkills);
}

/**
 * Get skills that are in the job description but NOT in the user's resume
 */
function getMissingSkills(jobDescription, resumeSkills) {
  const jobSkills = extractSkillsFromJobDescription(jobDescription);
  const resumeSkillNames = new Set(
    resumeSkills.map(s => s.name.toLowerCase())
  );

  return jobSkills.filter(skill =>
    !resumeSkillNames.has(skill.name.toLowerCase())
  );
}

/**
 * Suggest skills to add based on job posting
 */
function suggestSkillsForJob(jobDescription, resumeSkills, topN = 5) {
  const missingSkills = getMissingSkills(jobDescription, resumeSkills);
  
  // Group by category
  const byCategory = {};
  for (const skill of missingSkills) {
    if (!byCategory[skill.category]) {
      byCategory[skill.category] = [];
    }
    byCategory[skill.category].push(skill.name);
  }

  // Convert to sorted array of categories with skills
  const suggestions = Object.entries(byCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, topN);

  return suggestions;
}

/**
 * Create skill suggestion UI
 */
function renderSkillSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    return '<p style="color: #6b7280;">No skills to suggest</p>';
  }

  let html = '<div class="skill-suggestions">';

  for (const [category, skills] of suggestions) {
    html += `<div class="suggestion-group">
      <h4>${category}</h4>
      <div class="suggestion-tags">`;

    for (const skill of skills) {
      html += `
        <button class="suggestion-tag" onclick="addSkillFromJobPosting('${skill}')" title="Add ${skill}">
          + ${skill}
        </button>`;
    }

    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

/**
 * CSS for skill suggestions (add to popup.css or use inline)
 */
function getSkillSuggestionStyles() {
  return `
    <style>
      .skill-suggestions {
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 8px;
        padding: 12px;
        margin: 12px 0;
      }

      .suggestion-group {
        margin-bottom: 10px;
      }

      .suggestion-group:last-child {
        margin-bottom: 0;
      }

      .suggestion-group h4 {
        font-size: 12px;
        font-weight: 600;
        color: #92400e;
        margin-bottom: 6px;
      }

      .suggestion-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .suggestion-tag {
        padding: 5px 10px;
        border: 1px solid #fcd34d;
        background: #fef3c7;
        color: #92400e;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .suggestion-tag:hover {
        background: #fde68a;
        border-color: #f59e0b;
      }
    </style>
  `;
}
