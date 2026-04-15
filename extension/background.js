/**
 * background.js â€” ApplyReady Service Worker
 * 
 * Handles extension lifecycle events:
 * - Sets badge icon/text when content script detects a job page
 * - Opens welcome page on first install
 * - Manages communication between popup and content scripts
 * 
 * Dependencies: config.js
 */

// â”€â”€ Installation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: CONFIG.WELCOME_PAGE_URL });
  }
});

// â”€â”€ Badge Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Listens for messages from content.js indicating a job page was detected.
 * Shows a green badge with "JOB" text on the extension icon.
 */
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'jobPageDetected' && message.hasJob && sender.tab) {
    chrome.action.setBadgeText({ text: 'JOB', tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: sender.tab.id });
  }
});

// â”€â”€ Tab Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Clears the badge when the user navigates away from a job page.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
