/**
 * popup.js — ApplyReady Popup Controller
 * 
 * Manages all popup views: resume upload, section review, job matching,
 * section editing, and PDF download. Coordinates between resume-parser,
 * keyword-matcher, and pdf-builder modules.
 * 
 * License validation is done directly against LemonSqueezy's API.
 * All resume data is stored in chrome.storage.local — never sent anywhere.
 * 
 * Dependencies: config.js, resume-parser.js, keyword-matcher.js, pdf-builder.js
 */

(function () {
  'use strict';

  // -- State --------------------------------------------------

  let resumeData = null;    // { contact, sections } from parser
  let matchResult = null;   // { score, matchingKeywords, ... } from matcher
  let currentJobData = null; // { jobTitle, company, jobDescription } from content script
  let isPremium = false;

  // -- DOM References -----------------------------------------

  const views = {
    upload: document.getElementById('view-upload'),
    review: document.getElementById('view-review'),
    noJob: document.getElementById('view-no-job'),
    match: document.getElementById('view-match'),
    edit: document.getElementById('view-edit')
  };

  // -- Initialization -----------------------------------------

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Inject dynamic price into all .price-tag elements
    document.querySelectorAll('.price-tag').forEach(el => {
      el.textContent = CONFIG.PRICE;
    });

    await loadPremiumStatus();
    await loadSavedResume();

    if (!resumeData) {
      showView('upload');
      setupUploadHandlers();
    } else {
      await tryMatchCurrentTab();
    }

    setupGlobalHandlers();
  }

  // -- View Management ----------------------------------------

  /**
   * Shows a single view, hides all others.
   * @param {string} viewName - Key from the views object
   */
  function showView(viewName) {
    for (const [name, el] of Object.entries(views)) {
      el.classList.toggle('hidden', name !== viewName);
    }
  }

  // -- Resume Upload ------------------------------------------

  function setupUploadHandlers() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const btnChoose = document.getElementById('btn-choose-file');

    btnChoose.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    // Drag and drop
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
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        handleFile(file);
      }
    });
  }

  /**
   * Reads a PDF file and parses it into structured resume data.
   * @param {File} file - The uploaded PDF file
   */
  async function handleFile(file) {
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    // Show loading state
    const uploadArea = document.getElementById('upload-area');
    uploadArea.innerHTML = '<div class="loading"><div class="spinner"></div><p>Parsing resume...</p></div>';

    try {
      const buffer = await file.arrayBuffer();
      resumeData = await parseResumePDF(buffer);
      showReviewView();
    } catch (err) {
      uploadArea.innerHTML = '<p style="color:#dc2626">Failed to parse PDF. Please try another file.</p>';
      console.error('PDF parse error:', err);
    }
  }

  // -- Review View --------------------------------------------

  /**
   * Displays the parsed resume for user review and correction.
   */
  function showReviewView() {
    showView('review');

    // Populate contact fields
    document.getElementById('contact-name').value = resumeData.contact.name || '';
    document.getElementById('contact-email').value = resumeData.contact.email || '';
    document.getElementById('contact-phone').value = resumeData.contact.phone || '';
    document.getElementById('contact-linkedin').value = resumeData.contact.linkedin || '';

    renderSectionCards('sections-list', resumeData.sections, true);

    // Handlers
    document.getElementById('btn-save-resume').addEventListener('click', saveResume);
    document.getElementById('btn-reupload').addEventListener('click', () => {
      resumeData = null;
      showView('upload');
      setupUploadHandlers();
    });
    document.getElementById('btn-add-section').addEventListener('click', addNewSection);
  }

  /**
   * Renders section cards in a container.
   * @param {string} containerId - DOM ID of the container
   * @param {Array} sections - Resume sections
   * @param {boolean} editable - Whether sections are editable
   */
  function renderSectionCards(containerId, sections, editable = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    sections.forEach((section, index) => {
      const card = document.createElement('div');
      card.className = 'section-card';
      card.dataset.index = index;

      card.innerHTML = `
        <div class="section-card-header">
          <span class="section-type-badge">${section.type}</span>
          ${editable ? `
            <div class="section-card-actions">
              <button class="btn-delete-section" title="Delete section">🗑️</button>
            </div>
          ` : ''}
        </div>
        <input class="section-title-input" value="${escapeHtml(section.title)}" 
               ${editable ? '' : 'readonly'} data-field="title" data-index="${index}">
        <textarea class="section-content-area" 
                  ${editable ? '' : 'readonly'} 
                  data-field="content" data-index="${index}">${escapeHtml(section.content)}</textarea>
      `;

      container.appendChild(card);
    });

    // Bind delete handlers
    if (editable) {
      container.querySelectorAll('.btn-delete-section').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const card = e.target.closest('.section-card');
          const idx = parseInt(card.dataset.index);
          sections.splice(idx, 1);
          renderSectionCards(containerId, sections, true);
        });
      });
    }
  }

  /**
   * Adds a new blank section to the resume.
   */
  function addNewSection() {
    resumeData.sections.push({
      type: 'custom',
      title: 'New Section',
      content: ''
    });
    renderSectionCards('sections-list', resumeData.sections, true);
  }

  /**
   * Reads edited values from the review form and saves to chrome.storage.local.
   */
  async function saveResume() {
    // Update contact from form
    resumeData.contact.name = document.getElementById('contact-name').value.trim();
    resumeData.contact.email = document.getElementById('contact-email').value.trim();
    resumeData.contact.phone = document.getElementById('contact-phone').value.trim();
    resumeData.contact.linkedin = document.getElementById('contact-linkedin').value.trim();

    // Update sections from form
    const titleInputs = document.querySelectorAll('#sections-list .section-title-input');
    const contentAreas = document.querySelectorAll('#sections-list .section-content-area');

    titleInputs.forEach((input, i) => {
      if (resumeData.sections[i]) {
        resumeData.sections[i].title = input.value.trim();
      }
    });
    contentAreas.forEach((area, i) => {
      if (resumeData.sections[i]) {
        resumeData.sections[i].content = area.value.trim();
      }
    });

    // Filter out empty sections
    resumeData.sections = resumeData.sections.filter(s => s.content.trim());

    // Save to local storage
    await chrome.storage.local.set({ resumeData });

    // Proceed to matching
    await tryMatchCurrentTab();
  }

  // -- Load Saved Resume --------------------------------------

  async function loadSavedResume() {
    const result = await chrome.storage.local.get('resumeData');
    if (result.resumeData) {
      resumeData = result.resumeData;
    }
  }

  // -- Try Matching Current Tab -------------------------------

  /**
   * Checks if the current tab is a job listing page.
   * If yes, scrapes and shows match results.
   * If no, shows the "no job" view with option to manually scrape.
   */
  async function tryMatchCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) { 
        showNoJobView(false);
        return;
      }

      // Check if we think it's a job page (content script should be checked)
      let isJobPage = false;
      try {
        const statusResponse = await chrome.tabs.sendMessage(tab.id, { action: 'isJobPage' });
        isJobPage = statusResponse && statusResponse.isJob;
      } catch (err) {
        // Content script not injected
        isJobPage = false;
      }

      // Try to scrape job data from the active tab
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeJob' });

        if (response && response.jobDescription) {
          currentJobData = response;
          showMatchView();
          return;
        }
      } catch (err) {
        // Scrape failed
      }

      // If we get here, show no-job view with manual scrape option based on page detection
      showNoJobView(isJobPage);
    } catch (err) {
      // Unexpected error
      showNoJobView(false);
    }
  }

  /**
   * Shows the no-job view with appropriate messaging and buttons.
   * @param {boolean} isJobPage - Whether we think this is a job page
   */
  function showNoJobView(isJobPage) {
    showView('noJob');

    const statusMsg = document.getElementById('job-status-message');
    const detectedInfo = document.getElementById('detected-info');
    const notDetectedInfo = document.getElementById('not-detected-info');

    if (isJobPage) {
      statusMsg.textContent = 'Job page detected, but needs manual review.';
      detectedInfo.style.display = 'block';
      notDetectedInfo.style.display = 'none';
    } else {
      statusMsg.textContent = 'Browse to a job listing to get started.';
      detectedInfo.style.display = 'none';
      notDetectedInfo.style.display = 'block';
    }
  }

  // -- Match View ---------------------------------------------

  /**
   * Displays the keyword match results for the current job listing.
   */
  function showMatchView() {
    showView('match');

    // Set job title & company
    document.getElementById('match-job-title').textContent =
      currentJobData.jobTitle || 'Job Listing';
    document.getElementById('match-company').textContent =
      currentJobData.company || currentJobData.site || '';

    // Run keyword matching
    matchResult = matchKeywords(currentJobData.jobDescription, resumeData);

    // Animate score ring
    renderScoreRing(matchResult.score);

    // Render keyword tags
    renderKeywordTags('matching-keywords', matchResult.matchingKeywords, 'match');
    renderKeywordTags('missing-keywords', matchResult.missingKeywords, 'missing');
    document.getElementById('matching-count').textContent = matchResult.matchingKeywords.length;
    document.getElementById('missing-count').textContent = matchResult.missingKeywords.length;

    // Render missing phrases
    if (matchResult.missingPhrases.length > 0) {
      renderKeywordTags('missing-phrases', matchResult.missingPhrases, 'phrase');
      document.getElementById('missing-phrases-count').textContent = matchResult.missingPhrases.length;
      document.getElementById('phrases-group').classList.remove('hidden');
    } else {
      document.getElementById('phrases-group').classList.add('hidden');
    }

    // Render reordered section list
    const reordered = reorderSections(resumeData.sections, matchResult.sectionScores);
    renderSectionOrder(reordered, matchResult.sectionScores);

    // Show/hide premium gate
    updatePremiumUI();

    // Button handlers
    document.getElementById('btn-tailor').addEventListener('click', handleTailor);
    document.getElementById('btn-edit-before-download').addEventListener('click', showEditView);
  }

  /**
   * Animates the score ring to show the match percentage.
   * @param {number} score - 0-100
   */
  function renderScoreRing(score) {
    const ring = document.getElementById('score-ring');
    const circle = document.getElementById('score-circle');
    const text = document.getElementById('score-text');

    // Calculate stroke offset (264 = circumference of r=42 circle)
    const offset = 264 - (264 * score / 100);
    circle.style.strokeDashoffset = offset;

    text.textContent = `${score}%`;

    // Color based on score
    ring.className = 'score-ring';
    if (score >= 70) ring.classList.add('score-high');
    else if (score >= 40) ring.classList.add('score-mid');
    else ring.classList.add('score-low');
  }

  /**
   * Renders keyword tags in a container.
   * @param {string} containerId - DOM ID
   * @param {string[]} keywords - Keywords to render
   * @param {string} type - 'match', 'missing', or 'phrase'
   */
  function renderKeywordTags(containerId, keywords, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = keywords
      .slice(0, 30) // Limit displayed tags
      .map(k => `<span class="keyword-tag ${type}">${escapeHtml(k)}</span>`)
      .join('');
  }

  /**
   * Renders the optimized section order with relevance scores.
   * @param {Array} sections - Reordered sections
   * @param {Object} sectionScores - Score per section type
   */
  function renderSectionOrder(sections, sectionScores) {
    const container = document.getElementById('section-order-list');
    container.innerHTML = sections.map((s, i) => `
      <div class="section-order-item">
        <span class="order-num">${i + 1}</span>
        <span class="section-name">${escapeHtml(s.title)}</span>
        <span class="section-score">${sectionScores[s.type] || 0}% match</span>
      </div>
    `).join('');
  }

  // -- Edit View ----------------------------------------------

  /**
   * Shows the edit view where users can modify sections with keyword guidance.
   */
  function showEditView() {
    showView('edit');

    // Show missing keywords as guidance
    const allMissing = [
      ...matchResult.missingKeywords.slice(0, 15),
      ...matchResult.missingPhrases.slice(0, 5)
    ];
    renderKeywordTags('edit-missing-keywords', allMissing, 'missing');

    // Render editable sections in optimized order
    const reordered = reorderSections(resumeData.sections, matchResult.sectionScores);
    renderSectionCards('edit-sections-list', reordered, true);

    // Handlers
    document.getElementById('btn-build-pdf').addEventListener('click', () => {
      readEditedSections();
      handleTailor();
    });
    document.getElementById('btn-back-to-match').addEventListener('click', showMatchView);
  }

  /**
   * Reads the edited section content from the edit view.
   */
  function readEditedSections() {
    const titleInputs = document.querySelectorAll('#edit-sections-list .section-title-input');
    const contentAreas = document.querySelectorAll('#edit-sections-list .section-content-area');

    const updatedSections = [];
    titleInputs.forEach((input, i) => {
      updatedSections.push({
        type: resumeData.sections[i]?.type || 'custom',
        title: input.value.trim(),
        content: contentAreas[i]?.value.trim() || ''
      });
    });

    resumeData.sections = updatedSections.filter(s => s.content.trim());

    // Re-run matching with updated resume
    matchResult = matchKeywords(currentJobData.jobDescription, resumeData);

    // Save updated resume
    chrome.storage.local.set({ resumeData });
  }

  // -- Tailor & Download --------------------------------------

  /**
   * Reorders sections, highlights keywords, and generates the tailored PDF.
   * Gated behind premium license check.
   */
  function handleTailor() {
    if (!isPremium) {
      updatePremiumUI();
      return;
    }

    // Reorder sections by relevance
    const tailoredSections = reorderSections(resumeData.sections, matchResult.sectionScores);

    // Build tailored resume data
    const tailoredResume = {
      contact: resumeData.contact,
      sections: tailoredSections
    };

    // Download PDF with matching keywords bolded
    downloadResumePDF(
      tailoredResume,
      matchResult.matchingKeywords,
      currentJobData.jobTitle,
      currentJobData.company
    );
  }

  // -- Premium / License --------------------------------------

  /**
   * Loads premium status from chrome.storage.local.
   */
  async function loadPremiumStatus() {
    if (CONFIG.FREE_MODE === 1) {
      isPremium = true;
      return;
    }
    const result = await chrome.storage.local.get('license');
    if (result.license && result.license.valid) {
      isPremium = true;
    }
  }

  /**
   * Shows/hides the premium gate and adjusts button visibility.
   */
  function updatePremiumUI() {
    const gate = document.getElementById('premium-gate');
    const actions = document.getElementById('match-actions');

    if (isPremium) {
      gate.classList.add('hidden');
      actions.classList.remove('hidden');
    } else {
      gate.classList.remove('hidden');
      // Still show buttons but tailor will trigger gate
    }

    // Bind premium handlers
    document.getElementById('btn-buy').addEventListener('click', () => {
      chrome.tabs.create({ url: CONFIG.CHECKOUT_URL });
      const hint = document.getElementById('email-hint');
      if (hint) hint.classList.remove('hidden');
    });

    document.getElementById('btn-activate-key').addEventListener('click', activateLicense);
  }

  /**
   * Validates and activates a license key against LemonSqueezy's API.
   */
  async function activateLicense() {
    const keyInput = document.getElementById('license-key-input');
    const status = document.getElementById('license-status');
    const key = keyInput.value.trim();

    if (!key) {
      status.textContent = 'Please enter a license key.';
      status.className = 'license-status error';
      return;
    }

    status.textContent = 'Validating...';
    status.className = 'license-status';

    try {
      const response = await fetch(CONFIG.LICENSE_ACTIVATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          license_key: key,
          instance_name: 'ApplyReady Chrome Extension'
        })
      });

      const data = await response.json();

      if (data.activated || data.valid) {
        isPremium = true;
        await chrome.storage.local.set({
          license: { valid: true, key, activatedAt: new Date().toISOString() }
        });
        status.textContent = '✓ License activated! You can now download tailored PDFs.';
        status.className = 'license-status success';
        updatePremiumUI();
      } else if (data.error) {
        status.textContent = `✘ ${data.error}`;
        status.className = 'license-status error';
      } else {
        status.textContent = '✘ Invalid license key. Please check and try again.';
        status.className = 'license-status error';
      }
    } catch (err) {
      status.textContent = '✘ Network error. Please try again.';
      status.className = 'license-status error';
      console.error('License activation error:', err);
    }
  }

  // -- Global Handlers ----------------------------------------

  function setupGlobalHandlers() {
    // Edit resume button (from no-job view)
    const btnEdit = document.getElementById('btn-edit-resume');
    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        if (resumeData) {
          showReviewView();
        } else {
          showView('upload');
          setupUploadHandlers();
        }
      });
    }

    // Manage license button
    const btnLicense = document.getElementById('btn-manage-license');
    if (btnLicense) {
      btnLicense.addEventListener('click', () => {
        // Show a simple prompt for license key
        const key = prompt('Enter your ApplyReady license key:');
        if (key) {
          document.getElementById('license-key-input').value = key;
          // Switch to a view that shows activation
          showView('match');
          activateLicense();
        }
      });
    }

    // Manual scrape button (from no-job view - not detected)
    const btnManualScrape = document.getElementById('btn-manual-scrape');
    if (btnManualScrape) {
      btnManualScrape.addEventListener('click', performManualScrape);
    }

    // Analyze button (from no-job view - detected but failed)
    const btnAnalyzeManual = document.getElementById('btn-analyze-manual');
    if (btnAnalyzeManual) {
      btnAnalyzeManual.addEventListener('click', performManualScrape);
    }
  }

  /**
   * Attempts to manually scrape the current page.
   */
  async function performManualScrape() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) { 
        alert('Could not access the current tab.');
        return;
      }

      // Show loading state
      const statusMsg = document.getElementById('job-status-message');
      statusMsg.textContent = 'Scraping page...';

      // Send manual scrape request to content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'manualScrape' });

      if (response && response.jobDescription) {
        // Success! We got job data
        currentJobData = response;
        showMatchView();
      } else {
        // Failed to extract job data
        statusMsg.textContent = 'Could not extract job information from this page. Please try navigating to a different job listing.';
        alert('Unable to extract job data. This page may not contain a job listing.');
      }
    } catch (err) {
      document.getElementById('job-status-message').textContent = 'Error during manual scrape.';
      alert('Error: ' + err.message);
      console.error('Manual scrape error:', err);
    }
  }

  // -- Utilities ----------------------------------------------

  /**
   * Escapes HTML special characters to prevent XSS.
   * @param {string} str - Raw string
   * @returns {string} - Escaped string
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

})();
