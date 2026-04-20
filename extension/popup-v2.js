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

  // ── DOM REFS ───────────────────────────────────────────

  const views = {
    upload: document.getElementById('view-upload'),
    review: document.getElementById('view-review'),
    noJob: document.getElementById('view-no-job'),
    match: document.getElementById('view-match'),
    edit: document.getElementById('view-edit')
  };

  // ── INIT ───────────────────────────────────────────────

  
  // Also try immediate init in case DOM is already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);  // Small delay to ensure everything is ready
  }

  async function init() {
    
    try {
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

    const jobLower = jobDescription.toLowerCase();
    const resumeText = getResumeAsText(resumeData).toLowerCase();

    // Extract TECHNICAL keywords from job description (focus on concrete skills/tools)
    const jobKeywords = extractTechnicalKeywords(jobDescription);
    
    // Compare keywords
    const matchingKeywords = jobKeywords.filter(keyword =>
      resumeText.includes(keyword.toLowerCase())
    );

    const missingKeywords = jobKeywords.filter(keyword =>
      !resumeText.includes(keyword.toLowerCase())
    );

    // Extract ACTIONABLE phrases from job description (things that could be in resume)
    const jobPhrases = extractActionablePhrases(jobDescription);
    const missingPhrases = jobPhrases.filter(phrase =>
      !resumeText.includes(phrase.toLowerCase())
    ).slice(0, 5); // Limit to top 5

    // Calculate ATS score: weighted formula
    // Only count technical keywords, not generic requirements
    const technicalKeywordScore = jobKeywords.length > 0 
      ? Math.round((matchingKeywords.length / jobKeywords.length) * 100)
      : 50; // Default to 50% if no keywords found (resume bias)

    // Bonus/penalty based on resume comprehensiveness
    let baseScore = technicalKeywordScore;
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
      suggestedSectionOrder
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

  function setupMatchViewButtons() {
    const btnTailor = document.getElementById('btn-tailor');
    const btnEdit = document.getElementById('btn-edit-before-download');
    const btnBuy = document.getElementById('btn-buy');
    const btnManageLicense = document.getElementById('btn-manage-license');
    const btnActivateKey = document.getElementById('btn-activate-key');
    const licenseInput = document.getElementById('license-key-input');

    if (btnTailor) {
      btnTailor.onclick = () => {
        // Check if licensed (includes test key check)
        const testKey = `DEV_${new Date().getFullYear()}_APPLYREADY_TEST_LICENSE`;
        chrome.storage.local.get(['licenseKey'], (result) => {
          // Accept either stored key or hidden test development key
          if (result.licenseKey || localStorage.getItem('applyready_test') === 'true') {
            showDownloadOptions();
          } else {
            alert('Please activate a license key first');
            document.getElementById('premium-gate').classList.remove('hidden');
          }
        });
      };
    }

    if (btnEdit) {
      btnEdit.onclick = () => {
        showComponentEditView();
      };
    }

    if (btnBuy) {
      btnBuy.onclick = () => {
        const checkoutUrl = CONFIG?.CHECKOUT_URL || 'https://applyready-lake.vercel.app';
        chrome.tabs.create({ url: checkoutUrl });
      };
    }

    if (btnManageLicense) {
      btnManageLicense.onclick = () => {
        // Show premium gate on manual page
        const premiumGateManual = document.getElementById('premium-gate-manual');
        if (premiumGateManual) {
          premiumGateManual.classList.remove('hidden');
          // Focus on license input for easy typing
          setTimeout(() => {
            const input = document.getElementById('license-key-input-manual');
            if (input) {
              input.focus();
              input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 100);
        }
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
        
        const testKey = `DEV_${new Date().getFullYear()}_APPLYREADY_TEST_LICENSE`;
        
        if (key === testKey || (key.startsWith('DEV_') && key.includes('_APPLYREADY_TEST_LICENSE'))) {
          localStorage.setItem('applyready_test', 'true');
          chrome.storage.local.set({ licenseKey: key }, () => {
            alert('✓ Test license key activated!');
            document.getElementById('premium-gate').classList.add('hidden');
            licenseInput.value = '';
            location.reload();
          });
        } else {
          chrome.storage.local.set({ licenseKey: key }, () => {
            alert('✓ License key activated!');
            document.getElementById('premium-gate').classList.add('hidden');
            licenseInput.value = '';
            location.reload();
          });
        }
      };
    }

    // Handle license key activation on manual page
    const btnActivateKeyManual = document.getElementById('btn-activate-key-manual');
    const licenseInputManual = document.getElementById('license-key-input-manual');
    
    if (btnActivateKeyManual) {
      btnActivateKeyManual.onclick = () => {
        const key = licenseInputManual?.value?.trim();
        if (!key) {
          alert('Please enter a license key');
          return;
        }
        
        const testKey = `DEV_${new Date().getFullYear()}_APPLYREADY_TEST_LICENSE`;
        
        if (key === testKey || (key.startsWith('DEV_') && key.includes('_APPLYREADY_TEST_LICENSE'))) {
          localStorage.setItem('applyready_test', 'true');
          chrome.storage.local.set({ licenseKey: key }, () => {
            alert('✓ Test license key activated!');
            document.getElementById('premium-gate-manual').classList.add('hidden');
            licenseInputManual.value = '';
            location.reload();
          });
        } else {
          chrome.storage.local.set({ licenseKey: key }, () => {
            alert('✓ License key activated!');
            document.getElementById('premium-gate-manual').classList.add('hidden');
            licenseInputManual.value = '';
            location.reload();
          });
        }
      };
    }
  }

  // ── VIEW MANAGEMENT ────────────────────────────────────

  function showView(viewName) {
    for (const [name, el] of Object.entries(views)) {
      if (el) el.classList.toggle('hidden', name !== viewName);
    }
  }

  // ── RESUME UPLOAD ──────────────────────────────────────

  function setupUploadHandlers() {
    
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const btnChoose = document.getElementById('btn-choose-file');

    // --- BUTTON HANDLER ---
    if (btnChoose && fileInput) {
      
      // Don't clone - just add fresh listener
      btnChoose.addEventListener('click', function handler(e) {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    } else {
    }

    // --- FILE INPUT HANDLER ---
    if (fileInput) {
      fileInput.addEventListener('change', function handleFileChange(e) {
        if (e.target.files[0]) {
          handleFile(e.target.files[0]);
        } else {
        }
      });
    } else {
    }

    // --- DRAG & DROP ---
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });

      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
      });

      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) {
          if (e.dataTransfer.files[0].type === 'application/pdf') {
            handleFile(e.dataTransfer.files[0]);
          } else {
            alert('Please drop a PDF file');
          }
        }
      });
    } else {
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
        showNoJobView();  // Switch to job detection view after saving
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
      } else {
        const skill = createSkill(name, category, proficiency);
        addSkill(resumeData, skill);
      }

      saveResume();
      showComponentEditView();
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
    } else {
      const exp = createExperience(company, title, timeline, description);
      addExperience(resumeData, exp);
    }

    saveResume();
    showComponentEditView();
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
    } else {
      const edu = createEducation(school, degree, field, timeline, description);
      addEducation(resumeData, edu);
    }

    saveResume();
    showComponentEditView();
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
    } else {
      const proj = createProject(name, description, link);
      addProject(resumeData, proj);
    }

    saveResume();
    showComponentEditView();
  };

  window.removeComponentRow = function (componentId) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    // Try to remove from each section
    removeSkill(resumeData, componentId);
    removeExperience(resumeData, componentId);
    removeEducation(resumeData, componentId);
    removeProject(resumeData, componentId);

    saveResume();
    showComponentEditView();
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
    saveResume();
    alert(`Added "${skillName}" to your skills!`);
  };

})();
