/**
 * popup.js — Main popup controller with component-based resume editing
 * 
 * Orchestrates:
 * - Resume upload and parsing (v2)
 * - Component editing UI
 * - PDF generation (v2)
 * - Storage management
 */

(function () {
  'use strict';

  // ── STATE ──────────────────────────────────────────────

  let resumeData = null;  // Component-structured resume
  let currentEditingComponent = null;
  let currentEditingType = null;
  let currentJobData = null;  // Job data from content script { jobTitle, company, jobDescription }
  let savedScrollPosition = 0; // Saves scroll position when entering edit form
  let lastEditedComponentId = null; // Saves ID of component to auto-scroll back to

  // ── DOM REFS ───────────────────────────────────────────

  const views = {
    upload: document.getElementById('view-upload'),
    review: document.getElementById('view-review'),
    noJob: document.getElementById('view-no-job'),
    match: document.getElementById('view-match'),
    edit: document.getElementById('view-edit')
  };

  /**
   * Activate license instance (machine binding)
   * @param {string} licenseKey - The license key to activate
   * @returns {Promise<{activated: boolean, instanceId?: string, error?: string}>}
   */
  async function activateLicenseInstance(licenseKey) {
    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          license_key: licenseKey,
          instance_name: `ApplyReady-${new Date().toISOString().split('T')[0]}`
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        return { activated: false, error: error.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (data.activated === true && data.instance && data.instance.id) {
        return { activated: true, instanceId: data.instance.id };
      } else {
        return { activated: false, error: data.error || 'Activation failed' };
      }
    } catch (error) {
      return { activated: false, error: `Activation error: ${error.message}` };
    }
  }

  /**
   * Validate license key with LemonSqueezy API (requires instance_id for validation)
   * @param {string} licenseKey - The license key to validate
   * @param {string} instanceId - The instance ID from activation
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async function validateLicenseKeyWithAPI(licenseKey, instanceId) {
    try {
      const body = {
        license_key: licenseKey
      };
      if (instanceId) {
        body.instance_id = instanceId;
      }

      const response = await fetch(CONFIG.LICENSE_VALIDATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        return { valid: false, error: `Validation failed: HTTP ${response.status}` };
      }

      const data = await response.json();
      if (data.valid === true) {
        return { valid: true };
      } else {
        return { valid: false, error: data.error || 'Invalid license key' };
      }
    } catch (error) {
      return { valid: false, error: `Validation error: ${error.message}` };
    }
  }

  /**
   * Deactivate license instance (remove machine binding)
   * @param {string} licenseKey - The license key to deactivate
   * @param {string} instanceId - The instance ID to deactivate
   * @returns {Promise<{deactivated: boolean, error?: string}>}
   */
  async function deactivateLicenseInstance(licenseKey, instanceId) {
    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          license_key: licenseKey,
          instance_id: instanceId
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        return { deactivated: false, error: error.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (data.deactivated === true) {
        return { deactivated: true };
      } else {
        return { deactivated: false, error: data.error || 'Deactivation failed' };
      }
    } catch (error) {
      return { deactivated: false, error: `Deactivation error: ${error.message}` };
    }
  }

  // ── INIT ───────────────────────────────────────────────

  
  // Also try immediate init in case DOM is already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);  // Small delay to ensure everything is ready
  }

  async function init() {
    
    try {
      // Migrate old license keys to new format with activation date
      await migrateLicenseKeys();
      
      // Check license status on init - queries LemonSqueezy API every time
      const licenseInfo = await getLicenseExpirationInfo();
      if (licenseInfo.status === 'expired') {
        console.warn('License expired:', licenseInfo.message);
        // Clear expired license
        chrome.storage.local.remove('licenseKeyData');
        // Show alert to user
        alert(`⏰ ${licenseInfo.message}\n\nPlease purchase a new license to continue using premium features.`);
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');

      if (mode === 'split') {
        document.body.classList.add('split-mode');
        const style = document.createElement('style');
        style.textContent = `
          body.split-mode { display: flex; flex-direction: row; width: 100vw; height: 100vh; margin: 0; padding: 0; background: #f8fafc; overflow: hidden; }
          body.split-mode > .view { display: none !important; }
          body.split-mode > #view-match, body.split-mode > #view-review { display: block !important; flex: 1; width: 50%; height: 100vh; overflow-y: auto; box-sizing: border-box; background: white; position: relative; }
          body.split-mode > #view-match { border-right: 2px solid #e2e8f0; }
          body.split-mode .hidden { display: none !important; }
          body.split-mode #btn-edit-before-download, body.split-mode #btn-reupload { display: none !important; }
          body.split-mode .header h1 { font-size: 20px; }
          @media (max-width: 768px) {
            body.split-mode { flex-direction: column; }
            body.split-mode > #view-match, body.split-mode > #view-review { width: 100%; height: 50vh; }
            body.split-mode > #view-match { border-right: none; border-bottom: 2px solid #e2e8f0; }
          }
        `;
        document.head.appendChild(style);

        const result = await chrome.storage.local.get(['applyReadyResume', 'currentJobData']);
        if (result.applyReadyResume) resumeData = result.applyReadyResume;
        if (result.currentJobData) currentJobData = result.currentJobData;

        setupGlobalHandlers();

        if (resumeData && currentJobData) {
          showJobMatchView();
          showComponentEditView();
          showView('review'); 
        } else {
          document.body.innerHTML = '<div style="padding: 20px;">Error loading data. Please try reopening the extension.</div>';
        }
        return;
      }

      await loadResume();
      
      setupGlobalHandlers();
      
      setupMessageListener();
      
      if (!resumeData) {
        showView('upload');
        setupUploadHandlers();
      } else {
        // Resume exists - check if we're on a job site
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            // Send message with error handling
            chrome.tabs.sendMessage(tabs[0].id, { action: 'isJobPage' }, (response) => {
              if (chrome.runtime.lastError) {
                // Content script may not be loaded, try injecting it
                injectContentScriptAndCheckJob(tabs[0].id);
              } else if (response && response.isJobPage) {
                // Try to get full job data
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getJobData' }, (jobResponse) => {
                  if (jobResponse && jobResponse.jobData) {
                    currentJobData = jobResponse.jobData;
                    showJobMatchView();
                  } else {
                    // Even without full data, show match view (user can manual scrape)
                    showJobMatchView();
                  }
                });
              } else {
                showNoJobView();
              }
            });
          }
        });
      }
    } catch (error) {
    }
  }

  /**
   * Migrate old license key format to new format with activation date
   */
  function migrateLicenseKeys() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['licenseKey', 'licenseKeyData'], (result) => {
        // If already migrated, nothing to do
        if (result.licenseKeyData) {
          resolve();
          return;
        }

        // If old format exists, migrate it
        if (result.licenseKey) {
          const licenseKeyData = {
            key: result.licenseKey
          };
          chrome.storage.local.set({ licenseKeyData }, () => {
            // Also clear old format
            chrome.storage.local.remove('licenseKey');
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }

  function injectContentScriptAndCheckJob(tabId) {
    // Inject config.js first, then content.js
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['config.js']
    }, () => {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      }, () => {
        // After injection, send the isJobPage message again
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'isJobPage' }, (response) => {
            if (response && response.isJobPage) {
              chrome.tabs.sendMessage(tabId, { action: 'getJobData' }, (jobResponse) => {
                if (jobResponse && jobResponse.jobData) {
                  currentJobData = jobResponse.jobData;
                  showJobMatchView();
                } else {
                  showJobMatchView();
                }
              });
            } else {
              showNoJobView();
            }
          });
        }, 100);
      });
    });
  }

  function performManualScrape(tabId) {
    const btnManualScrape = document.getElementById('btn-manual-scrape');
    
    chrome.tabs.sendMessage(tabId, { action: 'manualScrape' }, (response) => {
      if (response && response.jobData) {
        currentJobData = response.jobData;
        showJobMatchView();
      } else if (chrome.runtime.lastError) {
        // Content script not loaded, inject it first
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['config.js']
        }, () => {
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          }, () => {
            // After injection, try scraping again
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, { action: 'manualScrape' }, (response2) => {
                if (response2 && response2.jobData) {
                  currentJobData = response2.jobData;
                  showJobMatchView();
                } else {
                  alert('Could not scrape job data from this page. Make sure you\'re on a job listing.');
                  btnManualScrape.disabled = false;
                  btnManualScrape.textContent = 'Try Manual Scraping';
                }
              });
            }, 100);
          });
        });
      } else {
        alert('Could not scrape job data from this page. Make sure you\'re on a job listing.');
        btnManualScrape.disabled = false;
        btnManualScrape.textContent = 'Try Manual Scraping';
      }
    });
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'jobPageDetected' && request.hasJob) {
        // Update job data and switch to match view if popup is open on a job site
        currentJobData = {
          jobTitle: request.jobTitle,
          company: request.company
        };
        if (resumeData) {
          // Request full job data from content script and show match view
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'getJobData' }, (response) => {
                if (response && response.jobData) {
                  currentJobData = response.jobData;
                  showJobMatchView();
                }
              }).catch(() => {
                // Fallback: show with partial data
                showJobMatchView();
              });
            }
          });
        }
      }
    });
  }

  /**
   * Analyze resume vs job posting for keyword matching
   */
  function analyzeJobMatch(jobDescription, resumeData) {
    if (!jobDescription || !resumeData) {
      return {
        score: 0,
        matchingKeywords: [],
        missingKeywords: [],
        missingPhrases: [],
        suggestedSectionOrder: []
      };
    }

    const SKILL_ALIASES = {
      'javascript': ['js', 'node.js', 'nodejs', 'es6', 'ecmascript'],
      'machine learning': ['ml', 'ai/ml', 'predictive modeling', 'deep learning'],
      'project management': ['pmp', 'scrum master', 'agile', 'program management'],
      'sql': ['mysql', 'postgresql', 'postgres', 't-sql', 'plsql'],
      'react': ['reactjs', 'react.js', 'next.js', 'nextjs'],
      'python': ['python3', 'pandas', 'numpy'],
      'aws': ['amazon web services', 'ec2', 's3'],
      'gcp': ['google cloud platform', 'google cloud'],
      'azure': ['microsoft azure'],
      'ci/cd': ['continuous integration', 'continuous deployment', 'jenkins', 'github actions']
    };

    function matchWithAliases(text, keyword) {
      if (!text || !keyword) return false;
      const aliases = SKILL_ALIASES[keyword.toLowerCase()] || [];
      const allTerms = [keyword, ...aliases];
      const textLower = text.toLowerCase();
      return allTerms.some(term => {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
        return regex.test(textLower);
      });
    }

    function extractJDSkillsSection(fullText) {
      const sectionHeaders = [
        'requirements', 'qualifications', "what you'll need",
        'skills', 'you have', "we're looking for", 'must have',
        'what you bring', 'experience'
      ];
      
      const lines = fullText.split('\n');
      let inSkillsSection = false;
      const skillLines = [];
      
      lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        if (sectionHeaders.some(h => lowerLine.includes(h) && line.length < 50)) {
          inSkillsSection = true;
        }
        if (inSkillsSection && /^(about|benefits|compensation|salary|what we offer|who we are|perks)/i.test(line) && line.length < 50) {
          inSkillsSection = false;
        }
        if (inSkillsSection) skillLines.push(line);
      });
      
      const result = skillLines.join('\n').trim();
      return result.length > 50 ? result : fullText;
    }

    function classifyKeywords(jdText) {
      const required = new Set();
      const preferred = new Set();
      const lines = jdText.split('\n');
      
      lines.forEach(line => {
        const isRequired = /must|required|essential|minimum|you have/i.test(line);
        const isPreferred = /preferred|nice to have|bonus|ideally|plus/i.test(line);
        
        const skills = extractTechnicalKeywords(line);
        if (isRequired) {
          skills.forEach(s => required.add(s));
        } else if (isPreferred) {
          skills.forEach(s => preferred.add(s));
        } else {
          skills.forEach(s => required.add(s));
        }
      });
      
      return { required: Array.from(required), preferred: Array.from(preferred) };
    }

    const jobLower = jobDescription.toLowerCase();
    const resumeText = getResumeAsText(resumeData).toLowerCase();
    
    const resumeSectionsText = {
      experience: resumeData.experience?.map(e => `${e.title} ${e.company} ${e.description}`).join(' ') || '',
      skills: resumeData.skills?.map(s => `${s.name} ${s.category}`).join(' ') || '',
      summary: resumeData.summary || '',
      education: resumeData.education?.map(e => `${e.degree} ${e.school} ${e.field} ${e.description}`).join(' ') || '',
      projects: resumeData.projects?.map(p => `${p.name} ${p.description}`).join(' ') || ''
    };

    const focusedJD = extractJDSkillsSection(jobDescription);
    const classified = classifyKeywords(focusedJD);
    const requiredKeywords = classified.required;
    const preferredKeywords = classified.preferred;
    
    const allKeywordsSet = new Set([...requiredKeywords, ...preferredKeywords]);
    if (allKeywordsSet.size === 0) {
      extractTechnicalKeywords(jobDescription).forEach(k => allKeywordsSet.add(k));
    }
    const jobKeywords = Array.from(allKeywordsSet);

    const matchingKeywords = [];
    const missingKeywords = [];
    const contextualFeedback = [];

    let totalWeight = 0;
    let matchedWeight = 0;

    const SECTION_WEIGHTS = {
      experience: 1.5,
      projects: 1.2,
      summary: 1.2,
      skills: 1.0,
      education: 0.7
    };

    jobKeywords.forEach(keyword => {
      let isMatch = false;
      let maxWeightFound = 0;
      
      for (const [section, text] of Object.entries(resumeSectionsText)) {
        if (matchWithAliases(text, keyword)) {
          isMatch = true;
          maxWeightFound = Math.max(maxWeightFound, SECTION_WEIGHTS[section] || 1.0);
        }
      }

      totalWeight += 1.0; 

      if (isMatch) {
        matchingKeywords.push(keyword);
        matchedWeight += maxWeightFound || 1.0;
        
        let inSkills = matchWithAliases(resumeSectionsText.skills, keyword);
        let inExperience = matchWithAliases(resumeSectionsText.experience, keyword);
        let inProjects = matchWithAliases(resumeSectionsText.projects, keyword);
        
        if (inSkills && !inExperience && !inProjects) {
          contextualFeedback.push(`⚠️ "${keyword}" appears in Skills only. Add it to an Experience bullet for higher weight.`);
        }
      } else {
        missingKeywords.push(keyword);
      }
    });

    const jobPhrases = extractActionablePhrases(focusedJD);
    const missingPhrases = jobPhrases.filter(phrase =>
      !matchWithAliases(resumeText, phrase)
    ).slice(0, 5); // Limit to top 5

    const technicalKeywordScore = totalWeight > 0 
      ? Math.round((matchedWeight / totalWeight) * 100)
      : 50;

    let reqMatched = 0, reqTotal = requiredKeywords.length;
    requiredKeywords.forEach(kw => {
        if(matchWithAliases(resumeText, kw)) reqMatched++;
    });
    let prefMatched = 0, prefTotal = preferredKeywords.length;
    preferredKeywords.forEach(kw => {
        if(matchWithAliases(resumeText, kw)) prefMatched++;
    });

    let baseScore = Math.min(100, technicalKeywordScore);
    const resumeHasExperience = resumeText.includes('experience') || resumeText.length > 200;
    const resumeHasSkills = resumeData.skills && resumeData.skills.length > 0;
    
    if (resumeHasExperience && resumeHasSkills) {
      baseScore = Math.min(100, baseScore + 10); // Bonus for comprehensive resume
    }

    // Calculate optimized section order based on job requirements
    const suggestedSectionOrder = calculateSuggestedSectionOrder(jobDescription, resumeData);

    return {
      score: Math.min(100, Math.max(0, baseScore)), // Ensure 0-100 range
      matchingKeywords: matchingKeywords.slice(0, 10), // Top 10
      missingKeywords: missingKeywords.slice(0, 10),   // Top 10
      missingPhrases: missingPhrases,
      suggestedSectionOrder,
      requiredMatched: reqMatched,
      requiredTotal: reqTotal,
      preferredMatched: prefMatched,
      preferredTotal: prefTotal,
      contextualFeedback: contextualFeedback.slice(0, 3)
    };
  }

  /**
   * Extract keywords from text based on role-specific and generic keywords
   * Covers multiple industries: Tech, Finance, Marketing, Sales, HR, Design, etc.
   */
  function extractTechnicalKeywords(text) {
    if (!text) return [];

    const textLower = text.toLowerCase();
    const found = new Set();

    // Comprehensive keyword list across multiple industries
    const allKeywords = {
      // --- PROGRAMMING & TECH ---
      programming: [
        'Python', 'JavaScript', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'PHP', 'TypeScript', 'Kotlin', 'Swift',
        'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'FastAPI',
        'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Firebase',
        'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Google Cloud',
        'Git', 'Jenkins', 'CI/CD', 'REST API', 'GraphQL'
      ],
      
      // --- BUSINESS & FINANCE ---
      business: [
        'Financial modeling', 'Budgeting', 'Forecasting', 'Analysis', 'Reporting',
        'SAP', 'Oracle', 'QuickBooks', 'Excel', 'Salesforce', 'CRM',
        'ROI', 'KPI', 'Business Intelligence', 'Data Analysis',
        'Accounting', 'Bookkeeping', 'Audit', 'Compliance',
        'Project Management', 'Agile', 'Scrum', 'Waterfall'
      ],

      // --- MARKETING & SALES ---
      marketing: [
        'SEO', 'SEM', 'Google Analytics', 'Social Media Marketing', 'Email Marketing',
        'Content Marketing', 'PPC', 'Advertising', 'Brand Management',
        'Adobe Creative Suite', 'Photoshop', 'Illustrator', 'InDesign',
        'Copywriting', 'Graphic Design', 'Video Editing', 'Marketing Automation',
        'HubSpot', 'Mailchimp', 'Google Ads', 'Facebook Ads', 'LinkedIn', 'Twitter'
      ],

      // --- HEALTHCARE ---
      healthcare: [
        'Electronic Health Records', 'EHR', 'HIPAA', 'Patient Care', 'Clinical',
        'Nursing', 'Pharmacy', 'Medical Coding', 'ICD-10', 'Billing',
        'Medical Terminology', 'Patient Assessment', 'Medical Records',
        'EMR', 'Clinical Documentation', 'Quality Assurance'
      ],

      // --- DESIGN & CREATIVE ---
      design: [
        'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'After Effects',
        'UI Design', 'UX Design', 'Wireframing', 'Prototyping', 'Design Systems',
        'User Research', 'Accessibility', 'Responsive Design', 'Mobile Design',
        'Branding', 'Typography', 'Color Theory', 'Visual Design'
      ],

      // --- HUMAN RESOURCES ---
      hr: [
        'Recruitment', 'Hiring', 'Employee Relations', 'Performance Management',
        'Payroll', 'Benefits Administration', 'HRIS', 'Workday', 'ADP',
        'Training & Development', 'Onboarding', 'Compliance', 'Labor Laws',
        'Talent Acquisition', 'Employer Branding', 'Compensation'
      ],

      // --- OPERATIONS & SUPPLY CHAIN ---
      operations: [
        'Supply Chain', 'Inventory Management', 'Logistics', 'ERP', 'SAP',
        'Process Improvement', 'Lean', 'Six Sigma', 'Quality Assurance',
        'Vendor Management', 'Procurement', 'Warehousing', 'Distribution',
        'Operations Management', 'Optimization', 'Cost Reduction'
      ],

      // --- CUSTOMER SERVICE ---
      service: [
        'Customer Service', 'Call Center', 'Technical Support', 'Help Desk',
        'CRM', 'Zendesk', 'Intercom', 'Slack', 'Communication',
        'Problem Solving', 'Customer Satisfaction', 'Retention',
        'Ticketing System', 'Live Chat', 'Email Support'
      ],

      // --- DATA & ANALYTICS ---
      data: [
        'Data Analysis', 'SQL', 'Python', 'R', 'Tableau', 'Power BI',
        'Machine Learning', 'Statistics', 'Business Intelligence', 'ETL',
        'Data Visualization', 'Google Analytics', 'BigQuery', 'Apache Spark',
        'Data Warehouse', 'Data Mining', 'Predictive Analytics'
      ],

      // --- LEGAL ---
      legal: [
        'Contract Management', 'Legal Research', 'Case Management', 'Litigation',
        'Compliance', 'Regulatory', 'IP Law', 'Employment Law',
        'Legal Writing', 'Document Review', 'Due Diligence', 'Legal Analysis'
      ],

      // --- EDUCATION ---
      education: [
        'Curriculum Development', 'Lesson Planning', 'Student Assessment',
        'Teaching', 'Online Learning', 'LMS', 'Canvas', 'Blackboard',
        'Classroom Management', 'Instruction', 'Mentoring', 'Training',
        'Educational Technology', 'Distance Learning'
      ],

      // --- LOGISTICS & TRANSPORTATION ---
      logistics: [
        'Route Optimization', 'Fleet Management', 'Dispatch', 'Tracking',
        'Warehouse Management', 'Inventory Control', 'Shipping', 'Customs',
        'DOT Compliance', 'HAZMAT', 'Supply Chain', 'Procurement'
      ],

      // --- REAL ESTATE ---
      realestate: [
        'Property Management', 'Leasing', 'Sales', 'Appraisal', 'Valuation',
        'MLS', 'CRM', 'Negotiation', 'Contract Drafting', 'Market Analysis',
        'Tenant Relations', 'Maintenance Coordination', 'Compliance'
      ]
    };

    // Check all keywords across all categories
    for (const [category, keywords] of Object.entries(allKeywords)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        if (regex.test(textLower)) {
          found.add(keyword);
        }
      }
    }

    return Array.from(found).filter(k => k.length > 2);
  }

  /**
   * Extract ACTIONABLE phrases from job description
   * Only phrases that someone might realistically include in their resume
   * Excludes generic requirement descriptions
   * Works across all industries
   */
  function extractActionablePhrases(text) {
    if (!text) return [];

    // Phrases that describe ACTIONS or ACCOMPLISHMENTS someone could mention
    // NOT generic requirement descriptions like "bachelor's degree"
    const actionablePhrases = [
      // Development & Engineering
      'end-to-end development', 'full stack', 'frontend development',
      'backend development', 'mobile development', 'web development',
      'api development', 'software development', 'code review',
      
      // Technical Skills
      'performance optimization', 'security implementation', 'database design',
      'system architecture', 'technical leadership', 'agile methodology',
      'cross-functional collaboration', 'team leadership', 'mentoring',
      
      // Testing & Documentation
      'automated testing', 'unit testing', 'integration testing',
      'deployment', 'infrastructure', 'monitoring', 'technical documentation',
      
      // Analysis & Strategy
      'data analysis', 'market analysis', 'financial analysis',
      'strategic planning', 'process improvement', 'optimization',
      'root cause analysis', 'competitor analysis',
      
      // Business & Project Management
      'project management', 'stakeholder management', 'vendor management',
      'budget management', 'resource allocation', 'risk management',
      'timeline management', 'deliverable management',
      
      // Sales & Marketing
      'sales strategy', 'marketing campaign', 'brand development',
      'customer acquisition', 'lead generation', 'pipeline management',
      'relationship building', 'territory management',
      
      // Finance & Operations
      'financial modeling', 'cost reduction', 'revenue growth',
      'efficiency improvement', 'process automation', 'supply chain optimization',
      'inventory management', 'vendor negotiation',
      
      // Design & UX
      'user experience', 'user interface', 'design systems',
      'wireframing', 'prototyping', 'user research', 'accessibility',
      
      // HR & Training
      'team building', 'recruiting', 'employee development',
      'training program', 'onboarding', 'retention strategy',
      
      // Quality & Compliance
      'quality assurance', 'quality control', 'compliance', 'audit',
      'standards implementation', 'best practices'
    ];

    const textLower = text.toLowerCase();
    const found = [];

    for (const phrase of actionablePhrases) {
      if (textLower.includes(phrase.toLowerCase())) {
        found.push(phrase);
      }
    }

    return found.slice(0, 5); // Return top 5 actionable phrases
  }

  /**
   * Legacy compatibility - kept for reference
   */
  function extractKeywords(text) {
    return extractTechnicalKeywords(text);
  }

  /**
   * Legacy compatibility - kept for reference
   */
  function extractPhrases(text) {
    return extractActionablePhrases(text);
  }

  /**
   * Convert resume to searchable text
   */
  function getResumeAsText(resumeData) {
    let text = '';
    
    if (resumeData.contact) {
      text += `${resumeData.contact.name} ${resumeData.contact.email} ${resumeData.contact.phone} ${resumeData.contact.linkedin} `;
    }

    if (resumeData.skills && Array.isArray(resumeData.skills)) {
      text += resumeData.skills.map(s => `${s.name} ${s.category}`).join(' ');
    }

    if (resumeData.experience && Array.isArray(resumeData.experience)) {
      text += resumeData.experience.map(e => `${e.title} ${e.company} ${e.description}`).join(' ');
    }

    if (resumeData.education && Array.isArray(resumeData.education)) {
      text += resumeData.education.map(e => `${e.degree} ${e.school} ${e.field}`).join(' ');
    }

    if (resumeData.projects && Array.isArray(resumeData.projects)) {
      text += resumeData.projects.map(p => `${p.name} ${p.description}`).join(' ');
    }

    return text;
  }

  /**
   * Calculate suggested section order based on job requirements
   */
  function calculateSuggestedSectionOrder(jobDescription, resumeData) {
    const order = [];
    const jobLower = jobDescription.toLowerCase();

    // Order priority based on job requirements
    if (jobLower.includes('experience') || jobLower.includes('year')) {
      order.push({ section: 'experience', label: '💼 Experience' });
    }

    if (jobLower.includes('skill') || jobLower.includes('expertise')) {
      order.push({ section: 'skills', label: '🎯 Skills' });
    }

    if (jobLower.includes('project') || jobLower.includes('portfolio')) {
      order.push({ section: 'projects', label: '📁 Projects' });
    }

    if (jobLower.includes('education') || jobLower.includes('degree')) {
      order.push({ section: 'education', label: '🎓 Education' });
    }

    // If order is empty, use default
    if (order.length === 0) {
      order.push(
        { section: 'experience', label: '💼 Experience' },
        { section: 'skills', label: '🎯 Skills' },
        { section: 'projects', label: '📁 Projects' },
        { section: 'education', label: '🎓 Education' }
      );
    }

    return order;
  }

  function showJobMatchView() {
    if (!currentJobData || !resumeData) {
      showComponentEditView();
      return;
    }

    showView('match');
    
    // Update job info
    document.getElementById('match-job-title').textContent = currentJobData.jobTitle || 'Job Match';
    document.getElementById('match-company').textContent = currentJobData.company || 'Company';

    // Perform actual ATS analysis
    const jobDescription = currentJobData.jobDescription || currentJobData.description || '';
    const analysis = analyzeJobMatch(jobDescription, resumeData);

    // Update score ring
    const scoreRing = document.getElementById('score-circle');
    const scoreText = document.getElementById('score-text');
    
    if (scoreRing) {
      const circumference = 2 * Math.PI * 42;
      const offset = circumference - (analysis.score / 100) * circumference;
      scoreRing.style.strokeDashoffset = offset;
    }
    if (scoreText) scoreText.textContent = analysis.score + '%';

    const statsContainerId = 'req-pref-stats';
    let statsContainer = document.getElementById(statsContainerId);
    if (!statsContainer) {
      statsContainer = document.createElement('div');
      statsContainer.id = statsContainerId;
      statsContainer.style.fontSize = '12px';
      statsContainer.style.marginTop = '12px';
      statsContainer.style.background = '#f8fafc';
      statsContainer.style.padding = '8px';
      statsContainer.style.borderRadius = '6px';
      const scoreGroup = document.querySelector('.score-group') || document.getElementById('view-match');
      if (scoreGroup) scoreGroup.appendChild(statsContainer);
    }
    statsContainer.innerHTML = `
      <div style="margin-bottom: 4px;"><strong>Required Skills:</strong> ${analysis.requiredMatched}/${analysis.requiredTotal} matched (${analysis.requiredTotal > 0 ? Math.round((analysis.requiredMatched/analysis.requiredTotal)*100) : 0}%)</div>
      ${analysis.preferredTotal > 0 ? `<div><strong>Preferred Skills:</strong> ${analysis.preferredMatched}/${analysis.preferredTotal} matched (${Math.round((analysis.preferredMatched/analysis.preferredTotal)*100)}%)</div>` : ''}
    `;

    // Populate matching keywords
    const matchingKeywordsEl = document.getElementById('matching-keywords');
    const matchingCountEl = document.getElementById('matching-count');
    if (matchingKeywordsEl) {
      matchingKeywordsEl.innerHTML = analysis.matchingKeywords
        .map(kw => `<span class="keyword-tag match">${escapeHtml(kw)}</span>`)
        .join('');
      if (matchingCountEl) matchingCountEl.textContent = analysis.matchingKeywords.length;
    }

    // Populate missing keywords
    const missingKeywordsEl = document.getElementById('missing-keywords');
    const missingCountEl = document.getElementById('missing-count');
    if (missingKeywordsEl) {
      missingKeywordsEl.innerHTML = analysis.missingKeywords
        .map(kw => `<span class="keyword-tag missing">${escapeHtml(kw)}</span>`)
        .join('');
      if (missingCountEl) missingCountEl.textContent = analysis.missingKeywords.length;
    }

    // Populate missing phrases
    const missingPhrasesEl = document.getElementById('missing-phrases');
    const missingPhrasesCountEl = document.getElementById('missing-phrases-count');
    if (missingPhrasesEl) {
      missingPhrasesEl.innerHTML = analysis.missingPhrases
        .map(phrase => `<span class="keyword-tag phrase">${escapeHtml(phrase)}</span>`)
        .join('');
      if (missingPhrasesCountEl) missingPhrasesCountEl.textContent = analysis.missingPhrases.length;
      
      // Hide section if no missing phrases
      const phrasesGroup = document.getElementById('phrases-group');
      if (phrasesGroup) {
        phrasesGroup.style.display = analysis.missingPhrases.length > 0 ? 'block' : 'none';
      }
    }

    const feedbackContainerId = 'contextual-feedback';
    let feedbackContainer = document.getElementById(feedbackContainerId);
    if (!feedbackContainer && analysis.contextualFeedback && analysis.contextualFeedback.length > 0) {
      feedbackContainer = document.createElement('div');
      feedbackContainer.id = feedbackContainerId;
      feedbackContainer.style.fontSize = '12px';
      feedbackContainer.style.marginTop = '12px';
      feedbackContainer.style.color = '#b45309';
      feedbackContainer.style.background = '#fffbeb';
      feedbackContainer.style.padding = '8px';
      feedbackContainer.style.borderRadius = '6px';
      const keywordsSection = document.getElementById('missing-keywords')?.parentElement;
      if (keywordsSection) keywordsSection.appendChild(feedbackContainer);
    }
    if (feedbackContainer) feedbackContainer.innerHTML = analysis.contextualFeedback.map(f => `<div style="margin-bottom: 4px;">${escapeHtml(f)}</div>`).join('');

    // Populate section order
    const sectionOrderList = document.getElementById('section-order-list');
    if (sectionOrderList && analysis.suggestedSectionOrder.length > 0) {
      sectionOrderList.innerHTML = analysis.suggestedSectionOrder
        .map((item, idx) => `<div class="section-order-item"><span class="order-num">${idx + 1}</span> <span class="section-name">${item.label}</span></div>`)
        .join('');
    }

    // Setup action buttons
    setupMatchViewButtons();
  }

  // ── LICENSE EXPIRATION UTILITIES ────────────────────────

  /**
   * Check if license is valid by querying LemonSqueezy API
   * License expires 30 days after purchase
   */
  function isLicenseValid() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['licenseKeyData'], (result) => {
        if (!result.licenseKeyData || !result.licenseKeyData.key) {
          resolve(false);
          return;
        }

        const licenseKey = result.licenseKeyData.key;
        const instanceId = result.licenseKeyData.instanceId;
        
        // Test licenses are always valid
        if (licenseKey && (licenseKey.startsWith('DEV_') && licenseKey.includes('_APPLYREADY_TEST_LICENSE'))) {
          resolve(true);
          return;
        }

        // Query LemonSqueezy API to check validity
        validateLicenseKeyWithAPI(licenseKey, instanceId).then((result) => {
          resolve(result.valid);
        }).catch((error) => {
          resolve(false);
        });
      });
    });
  }

  /**
   * Get license expiration info by querying LemonSqueezy API
   */
  function getLicenseExpirationInfo() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['licenseKeyData'], (result) => {
        if (!result.licenseKeyData || !result.licenseKeyData.key) {
          resolve({ status: 'invalid', message: 'No valid license found' });
          return;
        }

        const licenseKey = result.licenseKeyData.key;
        const instanceId = result.licenseKeyData.instanceId;
        
        // Test licenses never expire
        if (licenseKey && (licenseKey.startsWith('DEV_') && licenseKey.includes('_APPLYREADY_TEST_LICENSE'))) {
          resolve({ status: 'valid', message: 'Test License (Valid)' });
          return;
        }

        // Query LemonSqueezy API for validation
        validateLicenseKeyWithAPI(licenseKey, instanceId).then((apiResult) => {
          if (apiResult.valid) {
            resolve({ 
              status: 'valid', 
              message: 'License is valid'
            });
          } else {
            resolve({ status: 'expired', message: apiResult.error || 'License expired or invalid' });
          }
        }).catch((error) => {
          resolve({ status: 'error', message: 'Could not verify license' });
        });
      });
    });
  }

  function setupMatchViewButtons() {

    const btnTailor = document.getElementById('btn-tailor');
    const btnEdit = document.getElementById('btn-edit-before-download');
    const btnBuy = document.getElementById('btn-buy');
    const btnActivateKey = document.getElementById('btn-activate-key');
    const licenseInput = document.getElementById('license-key-input');

    if (btnTailor) {
      btnTailor.onclick = () => {
        // Check if licensed and not expired
        chrome.storage.local.get(['licenseKeyData'], (result) => {
          if (!result.licenseKeyData) {
            alert('Please activate a license key first');
            document.getElementById('premium-gate').classList.remove('hidden');
            return;
          }

          // Check expiration
          isLicenseValid().then((isValid) => {
            if (isValid) {
              showDownloadOptions();
            } else {
              // Get expiration info to show user
              getLicenseExpirationInfo().then((info) => {
                alert(`License ${info.status === 'expired' ? 'Expired' : 'Invalid'}: ${info.message}\n\nPlease activate a new license key.`);
                document.getElementById('premium-gate').classList.remove('hidden');
              });
            }
          });
        });
      };
    }

    if (btnEdit) {
      btnEdit.onclick = () => {
        chrome.storage.local.set({ currentJobData: currentJobData }, () => {
          chrome.windows.getCurrent((currentWindow) => {
            const width = 1000;
            const height = 800;
            let left = 100, top = 100;
            if (currentWindow) {
              left = Math.max(0, currentWindow.left + (currentWindow.width - width) / 2);
              top = Math.max(0, currentWindow.top + 50);
            }
            chrome.windows.create({
              url: chrome.runtime.getURL('popup.html?mode=split'),
              type: 'popup',
              width: width,
              height: height,
              left: Math.round(left),
              top: Math.round(top)
            });
            window.close();
          });
        });
      };
    }

    if (btnBuy) {
      btnBuy.onclick = () => {
        const checkoutUrl = CONFIG?.CHECKOUT_URL || 'https://applyready-lake.vercel.app';
        chrome.tabs.create({ url: checkoutUrl });
      };
    }

    // Handle license key activation on match view (main activate button)
    if (btnActivateKey) {
      btnActivateKey.onclick = () => {
        const key = licenseInput?.value?.trim();
        if (!key) {
          alert('Please enter a license key');
          return;
        }
        
        // Disable button during validation
        btnActivateKey.disabled = true;
        btnActivateKey.textContent = 'Validating...';
        
        const testKey = `DEV_${new Date().getFullYear()}_APPLYREADY_TEST_LICENSE`;
        
        // Check if test key
        if (key === testKey || (key.startsWith('DEV_') && key.includes('_APPLYREADY_TEST_LICENSE'))) {
          const licenseKeyData = {
            key: key
          };
          localStorage.setItem('applyready_test', 'true');
          chrome.storage.local.set({ licenseKeyData }, () => {
            alert('✓ Test license key activated!\n\nYour license is valid indefinitely.');
            document.getElementById('premium-gate').classList.add('hidden');
            licenseInput.value = '';
            location.reload();
          });
        } else {
          // First activate on this machine to get instance_id
          activateLicenseInstance(key).then((activateResult) => {
            if (activateResult.activated && activateResult.instanceId) {
              // Store license key and instance ID - tied to this machine
              const licenseKeyData = { 
                key: key,
                instanceId: activateResult.instanceId
              };
              chrome.storage.local.set({ licenseKeyData }, () => {
                alert(`✓ License key activated!\n\nYour license is now active on this machine.`);
                document.getElementById('premium-gate').classList.add('hidden');
                licenseInput.value = '';
                location.reload();
              });
            } else {
              alert(`✗ License already activated\n\n${activateResult.error || 'This license key is already in use on another machine. Please deactivate it there first, or contact support.'}`);
              btnActivateKey.disabled = false;
              btnActivateKey.textContent = 'Activate';
            }
          }).catch((error) => {
            alert(`✗ Activation error\n\n${error.message}`);
            btnActivateKey.disabled = false;
            btnActivateKey.textContent = 'Activate';
          });
        }
      };
    }

    // Deactivate license button
    const btnDeactivate = document.getElementById('btn-deactivate');
    if (btnDeactivate) {
      // Check if license is activated
      chrome.storage.local.get(['licenseKeyData'], (result) => {
        if (result.licenseKeyData && result.licenseKeyData.key) {
          // License is activated - show button
          btnDeactivate.classList.remove('hidden');
        } else {
          // License is not activated - hide button
          btnDeactivate.classList.add('hidden');
        }
      });

      btnDeactivate.onclick = () => {
        if (!confirm('Are you sure you want to deactivate this license? You will need to re-enter your license key to use the extension on this machine.')) {
          return;
        }

        chrome.storage.local.get(['licenseKeyData'], (result) => {
          if (!result.licenseKeyData || !result.licenseKeyData.key) {
            alert('No license key found to deactivate');
            return;
          }

          const licenseKey = result.licenseKeyData.key;
          const instanceId = result.licenseKeyData.instanceId;

          // Test licenses don't need deactivation
          if (licenseKey.startsWith('DEV_') && licenseKey.includes('_APPLYREADY_TEST_LICENSE')) {
            chrome.storage.local.remove('licenseKeyData', () => {
              alert('✓ Test license deactivated.\n\nPlease reload the extension.');
              location.reload();
            });
            return;
          }

          // Deactivate on this machine
          deactivateLicenseInstance(licenseKey, instanceId).then((result) => {
            if (result.deactivated) {
              chrome.storage.local.remove('licenseKeyData', () => {
                alert('✓ License deactivated!\n\nYou can now activate this license on another machine, or re-enter it here.');
                location.reload();
              });
            } else {
              alert(`✗ Deactivation failed\n\n${result.error || 'Could not deactivate license. Please try again or contact support.'}`);
            }
          }).catch((error) => {
            alert(`✗ Deactivation error\n\n${error.message}`);
          });
        });
      };
    }

    // Manual page license key activation removed - users can only activate via main premium gate
  }

  // ── VIEW MANAGEMENT ────────────────────────────────────

  function showView(viewName) {
    const isSplitMode = document.body.classList.contains('split-mode');
    for (const [name, el] of Object.entries(views)) {
      if (el) {
        if (isSplitMode && (name === 'match' || name === 'review')) {
          el.classList.remove('hidden');
        } else {
          el.classList.toggle('hidden', name !== viewName);
        }
      }
    }
  }

  function updateSplitModeMatch() {
    if (document.body.classList.contains('split-mode')) {
      showJobMatchView();
    }
  }

  // ── RESUME UPLOAD ──────────────────────────────────────

  function setupUploadHandlers() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const btnChoose = document.getElementById('btn-choose-file');

    // Verify elements exist
    if (!btnChoose || !fileInput) {
      return;
    }

    // Button click - open file dialog
    btnChoose.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput.click();
    };

    // File input change - handle selected file
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          handleFile(file);
        } else {
          alert('Please select a PDF file');
          fileInput.value = '';
        }
      }
    };

    // Drag & drop support
    if (uploadArea) {
      uploadArea.ondragover = (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      };

      uploadArea.ondragleave = () => {
        uploadArea.classList.remove('drag-over');
      };

      uploadArea.ondrop = (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          const file = e.dataTransfer.files[0];
          if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            handleFile(file);
          } else {
            alert('Please drop a PDF file');
          }
        }
      };
    }
  }

  async function handleFile(file) {
    
    try {
      // Show loading state
      const uploadArea = document.getElementById('upload-area');
      if (uploadArea) {
        uploadArea.innerHTML = '<div style="text-align: center; padding: 20px;"><p>📄 Parsing resume...</p><p style="font-size: 12px; color: #999; margin-top: 10px;">This may take a moment...</p></div>';
      } else {
      }

      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const buffer = e.target.result;
          
          resumeData = await parseResumePDFv2(buffer);
          
          if (!resumeData) {
            throw new Error('Parser returned empty result');
          }

          await saveResume();
          
          showComponentEditView();
        } catch (error) {
          
          // Use global error reporter if available
          if (window.reportError) {
            window.reportError('handleFile.parse', error, {
              bufferSize: e.target.result.byteLength,
              resumeDataExists: !!resumeData
            });
          }

          
          const errorMsg = error.message || String(error);
          showErrorView(errorMsg);
        }
      };

      reader.onerror = (err) => {
        const errorMsg = `File read error: ${err}`;
        showErrorView(errorMsg);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      showErrorView(error.message || 'Unknown error occurred');
    }
  }

  function showErrorView(errorMessage) {
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
      uploadArea.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 10px;">❌</div>
          <h3 style="color: #dc2626; margin: 10px 0;">Error Parsing Resume</h3>
          <p style="color: #6b7280; background: #f9fafb; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 12px; word-break: break-word;">
            ${escapeHtml(errorMessage)}
          </p>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0;">
            💡 Tips: Ensure the file is a valid PDF. Try re-exporting your resume as PDF from Word/Google Docs.
          </p>
          <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 10px;">Retry</button>
        </div>
      `;
    }
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // ── COMPONENT EDIT VIEW ────────────────────────────────

  function showComponentEditView() {
    showView('review');
    
    // Populate contact info
    document.getElementById('contact-name').value = resumeData.contact.name || '';
    document.getElementById('contact-email').value = resumeData.contact.email || '';
    document.getElementById('contact-phone').value = resumeData.contact.phone || '';
    document.getElementById('contact-linkedin').value = resumeData.contact.linkedin || '';

    // Populate component sections
    const sectionsList = document.getElementById('sections-list');
    if (sectionsList) {
      let html = renderResumeComponents(resumeData);
      
      // Add buttons to add new components
      html += `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <button id="btn-add-skill" class="add-component-btn">+ Add Skill</button>
          <button id="btn-add-experience" class="add-component-btn">+ Add Experience</button>
          <button id="btn-add-education" class="add-component-btn">+ Add Education</button>
          <button id="btn-add-project" class="add-component-btn">+ Add Project</button>
        </div>
      `;
      
      sectionsList.innerHTML = html;
      
      // Attach event listeners after rendering
      attachComponentEventListeners();
    }

    // Setup buttons
    setupComponentButtons();
    setupAddComponentButtons();

    // Restore scroll position if returning from an edit form
    setTimeout(() => {
      let scrolled = false;
      if (lastEditedComponentId) {
        const row = document.querySelector(`[data-id="${lastEditedComponentId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          scrolled = true;
        }
        lastEditedComponentId = null;
      }
      
      if (!scrolled && savedScrollPosition > 0) {
        const viewReview = document.getElementById('view-review');
        if (viewReview) viewReview.scrollTop = savedScrollPosition;
        window.scrollTo(0, savedScrollPosition);
      }
      savedScrollPosition = 0;
    }, 50); // Increased timeout slightly to ensure HTML has rendered
  }

  function showNoJobView() {
    showView('noJob');
    
    const detectedInfo = document.getElementById('detected-info');
    const notDetectedInfo = document.getElementById('not-detected-info');
    const jobStatusMsg = document.getElementById('job-status-message');
    
    // Default to not detected (user hasn't navigated to job site yet)
    if (detectedInfo) detectedInfo.style.display = 'none';
    if (notDetectedInfo) notDetectedInfo.style.display = 'block';
    if (jobStatusMsg) jobStatusMsg.innerHTML = '✅ Resume saved! Now navigate to a job listing.';
    
    // Setup button handlers
    const btnEdit = document.getElementById('btn-edit-resume');
    const btnManualScrape = document.getElementById('btn-manual-scrape');
    const btnAnalyzeManual = document.getElementById('btn-analyze-manual');
    
    if (btnEdit) {
      btnEdit.onclick = () => showComponentEditView();
    }
    
    if (btnManualScrape) {
      btnManualScrape.onclick = () => {
        btnManualScrape.disabled = true;
        btnManualScrape.textContent = 'Scraping...';
        
        // Get the active tab and send scrape message
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            performManualScrape(tabs[0].id);
          }
        });
      };
    }
    
    if (btnAnalyzeManual) {
      btnAnalyzeManual.onclick = () => {
        if (currentJobData && resumeData) {
          showJobMatchView();
        }
      };
    }
  }

  function setupComponentButtons() {
    const btnSave = document.getElementById('btn-save-resume');
    const btnReupload = document.getElementById('btn-reupload');

    if (btnSave) {
      btnSave.onclick = () => {
        updateContactInfo();
        saveResume();
        if (document.body.classList.contains('split-mode')) {
          updateSplitModeMatch();
          const originalText = btnSave.textContent;
          btnSave.textContent = '✓ Saved!';
          setTimeout(() => { if (btnSave) btnSave.textContent = originalText; }, 2000);
        } else {
          showNoJobView();
        }
      };
    }

    if (btnReupload) {
      btnReupload.onclick = () => {
        resumeData = null;
        showView('upload');
        setupUploadHandlers();
      };
    }
  }

  function checkLicenseAndDownload() {
    chrome.storage.local.get(['licenseKey'], (result) => {
      if (result.licenseKey || localStorage.getItem('applyready_test') === 'true') {
        showDownloadOptions();
      } else {
        alert('PDF download requires a license key. Please activate your license to continue.');
        // Optionally show license gate if you want to let them purchase
      }
    });
  }

  function showDownloadOptions() {
    updateContactInfo();
    // Direct download without modal
    downloadResumePDFv2(resumeData);
  }

  function updateContactInfo() {
    // Only update from form if we're on the review view (contact fields visible)
    const contactNameEl = document.getElementById('contact-name');
    const contactEmailEl = document.getElementById('contact-email');
    const contactPhoneEl = document.getElementById('contact-phone');
    const contactLinkedinEl = document.getElementById('contact-linkedin');
    
    // Only update if fields exist (on review view) to avoid overwriting with empty values
    if (contactNameEl && contactNameEl.offsetParent !== null) {
      resumeData.contact.name = contactNameEl.value || '';
      resumeData.contact.email = contactEmailEl?.value || '';
      resumeData.contact.phone = contactPhoneEl?.value || '';
      resumeData.contact.linkedin = contactLinkedinEl?.value || '';
    }
    // If fields don't exist or aren't visible, don't overwrite the stored contact data
  }

  // ── COMPONENT EDITING ──────────────────────────────────

  window.editSkill = function (skillId) {
    const skill = resumeData.skills.find(s => s.id === skillId);
    showComponentForm('skill', skill);
  };

  window.editExperience = function (expId) {
    const exp = resumeData.experience.find(e => e.id === expId);
    showComponentForm('experience', exp);
  };

  window.editEducation = function (eduId) {
    const edu = resumeData.education.find(e => e.id === eduId);
    showComponentForm('education', edu);
  };

  window.editProject = function (projId) {
    const proj = resumeData.projects.find(p => p.id === projId);
    showComponentForm('project', proj);
  };

  function showComponentForm(type, component = null) {
    const viewReview = document.getElementById('view-review');
    savedScrollPosition = Math.max(viewReview?.scrollTop || 0, window.scrollY || document.documentElement.scrollTop || 0);
    lastEditedComponentId = component ? component.id : null;

    currentEditingComponent = component;
    currentEditingType = type;

    let formHtml = '';
    if (type === 'skill') {
      formHtml = renderSkillForm(component);
    } else if (type === 'experience') {
      formHtml = renderExperienceForm(component);
    } else if (type === 'education') {
      formHtml = renderEducationForm(component);
    } else if (type === 'project') {
      formHtml = renderProjectForm(component);
    }

    const sectionsList = document.getElementById('sections-list');
    if (sectionsList) {
      sectionsList.innerHTML = formHtml;
      
      // Attach event listeners to form buttons after rendering
      setTimeout(() => {
        attachFormEventListeners();
      }, 0);
    }
  }

  window.cancelEdit = function () {
    currentEditingComponent = null;
    currentEditingType = null;
    showComponentEditView();
  };

  window.saveSkillForm = function (skillId) {
    try {
      const name = document.getElementById('skill-name')?.value.trim();
      const category = document.getElementById('skill-category')?.value.trim();
      const proficiency = document.getElementById('skill-proficiency')?.value;

      if (!name) {
        alert('Skill name is required');
        return;
      }

      if (skillId) {
        updateSkill(resumeData, skillId, { name, category, proficiency });
        lastEditedComponentId = skillId;
      } else {
        const skill = createSkill(name, category, proficiency);
        addSkill(resumeData, skill);
        lastEditedComponentId = skill.id;
      }

      saveResume();
      showComponentEditView();
      updateSplitModeMatch();
    } catch (error) {
      alert('Error saving skill: ' + error.message);
      showComponentEditView();
    }
  };

  window.saveExperienceForm = function (expId) {
    const title = document.getElementById('exp-title')?.value.trim();
    const company = document.getElementById('exp-company')?.value.trim();
    const timeline = document.getElementById('exp-timeline')?.value.trim();
    let description = document.getElementById('exp-description')?.value.trim();

    if (!title || !company) {
      alert('Job title and company are required');
      return;
    }

    // CRITICAL: Remove ALL bullet characters from description before saving
    description = description
      .split('\n')
      .map(line => line.replace(/^[%|•\-*§¶`^~]+\s*/g, '').trim())
      .filter(line => line.length > 0)
      .join('\n');

    if (expId) {
      updateExperience(resumeData, expId, { title, company, timeline, description });
      lastEditedComponentId = expId;
    } else {
      const exp = createExperience(company, title, timeline, description);
      addExperience(resumeData, exp);
      lastEditedComponentId = exp.id;
    }

    saveResume();
    showComponentEditView();
    updateSplitModeMatch();
  };

  window.saveEducationForm = function (eduId) {
    const degree = document.getElementById('edu-degree')?.value.trim();
    const school = document.getElementById('edu-school')?.value.trim();
    const field = document.getElementById('edu-field')?.value.trim();
    const timeline = document.getElementById('edu-timeline')?.value.trim();
    let description = document.getElementById('edu-description')?.value.trim();

    if (!degree || !school) {
      alert('Degree and school are required');
      return;
    }

    // CRITICAL: Remove ALL bullet characters from description before saving
    description = description
      .split('\n')
      .map(line => line.replace(/^[%|•\-*§¶`^~]+\s*/g, '').trim())
      .filter(line => line.length > 0)
      .join('\n');

    if (eduId) {
      updateEducation(resumeData, eduId, { school, degree, field, timeline, description });
      lastEditedComponentId = eduId;
    } else {
      const edu = createEducation(school, degree, field, timeline, description);
      addEducation(resumeData, edu);
      lastEditedComponentId = edu.id;
    }

    saveResume();
    showComponentEditView();
    updateSplitModeMatch();
  };

  window.saveProjectForm = function (projId) {
    const name = document.getElementById('proj-name')?.value.trim();
    let description = document.getElementById('proj-description')?.value.trim();
    const link = document.getElementById('proj-link')?.value.trim();

    if (!name || !description) {
      alert('Project name and description are required');
      return;
    }

    // CRITICAL: Remove ALL bullet characters from description before saving
    description = description
      .split('\n')
      .map(line => line.replace(/^[%|•\-*§¶`^~]+\s*/g, '').trim())
      .filter(line => line.length > 0)
      .join('\n');

    if (projId) {
      updateProject(resumeData, projId, { name, description, link });
      lastEditedComponentId = projId;
    } else {
      const proj = createProject(name, description, link);
      addProject(resumeData, proj);
      lastEditedComponentId = proj.id;
    }

    saveResume();
    showComponentEditView();
    updateSplitModeMatch();
  };

  window.removeComponentRow = function (componentId) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    // Try to remove from each section
    removeSkill(resumeData, componentId);
    removeExperience(resumeData, componentId);
    removeEducation(resumeData, componentId);
    removeProject(resumeData, componentId);
    lastEditedComponentId = null; // Clear ID so raw scroll fallback is used

    saveResume();
    showComponentEditView();
    updateSplitModeMatch();
  };

  // ── ADD COMPONENT BUTTONS ──────────────────────────────

  function setupAddComponentButtons() {
    const btnAddSkill = document.getElementById('btn-add-skill');
    const btnAddExp = document.getElementById('btn-add-experience');
    const btnAddEdu = document.getElementById('btn-add-education');
    const btnAddProj = document.getElementById('btn-add-project');

    if (btnAddSkill) {
      btnAddSkill.onclick = () => showComponentForm('skill');
    }
    if (btnAddExp) {
      btnAddExp.onclick = () => showComponentForm('experience');
    }
    if (btnAddEdu) {
      btnAddEdu.onclick = () => showComponentForm('education');
    }
    if (btnAddProj) {
      btnAddProj.onclick = () => showComponentForm('project');
    }
  }

  // ── STORAGE ────────────────────────────────────────────

  async function saveResume() {
    if (resumeData) {
      await chrome.storage.local.set({ applyReadyResume: resumeData });
    }
  }

  async function loadResume() {
    const result = await chrome.storage.local.get('applyReadyResume');
    if (result.applyReadyResume) {
      resumeData = result.applyReadyResume;
    }
  }

  // ── GLOBAL HANDLERS ────────────────────────────────────

  function setupGlobalHandlers() {
    setupAddComponentButtons();
  }

  // ── ADD SKILL FROM JOB POSTING ─────────────────────────

  window.addSkillFromJobPosting = function (skillName) {
    if (!resumeData) {
      alert('Please upload a resume first');
      return;
    }

    // Check if skill already exists
    if (resumeData.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase())) {
      alert('This skill is already in your resume');
      return;
    }

    // Add new skill
    const skill = createSkill(skillName);
    addSkill(resumeData, skill);
    lastEditedComponentId = skill.id;
    saveResume();
    if (document.body.classList.contains('split-mode')) {
      showComponentEditView();
      updateSplitModeMatch();
    }
    alert(`Added "${skillName}" to your skills!`);
  };

})();
