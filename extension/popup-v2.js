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
            
            // First check if this is even a job page
            chrome.tabs.sendMessage(tabs[0].id, { action: 'isJobPage' }, (response) => {
              
              if (response && response.isJobPage) {
                // Try to get full job data
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getJobData' }, (jobResponse) => {
                  if (jobResponse && jobResponse.jobData) {
                    currentJobData = jobResponse.jobData;
                    showJobMatchView();
                  } else {
                    // Even without full data, show match view (user can manual scrape)
                    showJobMatchView();
                  }
                }).catch((err) => {
                  showJobMatchView();
                });
              } else {
                showNoJobView();
              }
            }).catch((err) => {
              showNoJobView();
            });
          }
        });
      }
    } catch (error) {
    }
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

  function showJobMatchView() {
    if (!currentJobData || !resumeData) {
      showComponentEditView();
      return;
    }

    showView('match');
    
    // Update job info
    document.getElementById('match-job-title').textContent = currentJobData.jobTitle || 'Job Match';
    document.getElementById('match-company').textContent = currentJobData.company || 'Company';

    // TODO: Calculate actual ATS match score and keywords
    // For now, show placeholder
    const scoreRing = document.getElementById('score-circle');
    const scoreText = document.getElementById('score-text');
    const mockScore = 65;
    
    if (scoreRing) {
      const circumference = 2 * Math.PI * 42;
      const offset = circumference - (mockScore / 100) * circumference;
      scoreRing.style.strokeDashoffset = offset;
    }
    if (scoreText) scoreText.textContent = mockScore + '%';

    // Setup action buttons
    setupMatchViewButtons();
  }

  function setupMatchViewButtons() {
    const btnTailor = document.getElementById('btn-tailor');
    const btnEdit = document.getElementById('btn-edit-before-download');
    const btnBuy = document.getElementById('btn-buy');
    const btnActivateKey = document.getElementById('btn-activate-key');
    const licenseInput = document.getElementById('license-key-input');

    if (btnTailor) {
      btnTailor.onclick = () => {
        // Check if licensed
        chrome.storage.local.get('licenseKey', (result) => {
          if (result.licenseKey) {
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

    if (btnActivateKey) {
      btnActivateKey.onclick = () => {
        const key = licenseInput?.value?.trim();
        if (!key) {
          alert('Please enter a license key');
          return;
        }
        
        // Store the key (in a real app, validate with backend first)
        chrome.storage.local.set({ licenseKey: key }, () => {
          alert('License key activated!');
          document.getElementById('premium-gate').classList.add('hidden');
        });
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
            chrome.tabs.sendMessage(tabs[0].id, { action: 'manualScrape' }, (response) => {
              if (response && response.jobData) {
                currentJobData = response.jobData;
                showJobMatchView();
              } else {
                alert('Could not scrape job data. Make sure you\'re on a job listing page.');
                btnManualScrape.disabled = false;
                btnManualScrape.textContent = 'Try Manual Scraping';
              }
            }).catch((err) => {
              alert('Could not contact the page. Make sure you\'re on a job listing page.');
              btnManualScrape.disabled = false;
              btnManualScrape.textContent = 'Try Manual Scraping';
            });
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
    const btnDownload = document.getElementById('btn-download-pdf');

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

    if (btnDownload) {
      btnDownload.onclick = () => {
        showDownloadOptions();
      };
    }
  }

  function showDownloadOptions() {
    updateContactInfo();
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 20px;
      width: 90%;
      max-width: 320px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      text-align: center;
    `;

    dialog.innerHTML = `
      <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #1f2937;">Download as</h2>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280;">Choose your preferred format:</p>
      
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="download-pdf-btn" style="
          padding: 10px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
          📄 PDF Format
        </button>
        
        <button id="download-doc-btn" style="
          padding: 10px;
          background: #059669;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        " onmouseover="this.style.background='#047857'" onmouseout="this.style.background='#059669'">
          📝 Word Format (HTML)
        </button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const pdfBtn = dialog.querySelector('#download-pdf-btn');
    const docBtn = dialog.querySelector('#download-doc-btn');

    pdfBtn.onclick = () => {
      modal.remove();
      downloadResumePDFv2(resumeData);
    };

    docBtn.onclick = () => {
      modal.remove();
      downloadResumeHtml(resumeData, null, '', '');
    };

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  function updateContactInfo() {
    resumeData.contact.name = document.getElementById('contact-name')?.value || '';
    resumeData.contact.email = document.getElementById('contact-email')?.value || '';
    resumeData.contact.phone = document.getElementById('contact-phone')?.value || '';
    resumeData.contact.linkedin = document.getElementById('contact-linkedin')?.value || '';
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
    const description = document.getElementById('exp-description')?.value.trim();

    if (!title || !company) {
      alert('Job title and company are required');
      return;
    }

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
    const description = document.getElementById('edu-description')?.value.trim();

    if (!degree || !school) {
      alert('Degree and school are required');
      return;
    }

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
    const description = document.getElementById('proj-description')?.value.trim();
    const link = document.getElementById('proj-link')?.value.trim();

    if (!name || !description) {
      alert('Project name and description are required');
      return;
    }

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
