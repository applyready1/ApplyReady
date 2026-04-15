/**
 * privacy/page.js — ApplyReady Privacy Policy
 * 
 * Required for Chrome Web Store compliance.
 * Emphasizes that all resume data stays local in the browser.
 * 
 * Dependencies: None (Next.js page component)
 */

export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif', lineHeight: '1.7' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Privacy Policy</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '32px' }}>Last updated: April 15, 2026</p>

      <p style={{ marginBottom: '24px' }}>
        ApplyReady ("we", "our", "the extension") is a Chrome browser extension that helps job seekers
        tailor their resumes to job listings. This privacy policy explains what data we collect, how we
        use it, and your rights.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>1. Data We Do NOT Collect</h2>
      <p style={{ marginBottom: '12px' }}>
        ApplyReady is designed with privacy as a core principle. We do <strong>not</strong>:
      </p>
      <ul style={{ paddingLeft: '24px', marginBottom: '24px' }}>
        <li>Upload, transmit, or store your resume on any server</li>
        <li>Collect any personally identifiable information (name, email, phone, address)</li>
        <li>Track your browsing history or job searches</li>
        <li>Use cookies, analytics, or third-party tracking scripts</li>
        <li>Sell, share, or transfer any data to third parties</li>
        <li>Access any data on pages you visit beyond the job description text</li>
      </ul>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>2. Data Stored Locally</h2>
      <p style={{ marginBottom: '12px' }}>
        The following data is stored <strong>locally in your browser</strong> using Chrome's built-in
        storage (<code>chrome.storage.local</code>). This data never leaves your device:
      </p>
      <ul style={{ paddingLeft: '24px', marginBottom: '24px' }}>
        <li><strong>Your resume data</strong> — the parsed text and sections from your uploaded PDF</li>
        <li><strong>License key</strong> — your activation status (valid/invalid) and the key itself</li>
      </ul>
      <p style={{ marginBottom: '24px' }}>
        You can delete all locally stored data at any time by removing the extension from Chrome
        or by clearing the extension's storage in <code>chrome://extensions</code>.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>3. Job Page Scraping</h2>
      <p style={{ marginBottom: '24px' }}>
        When you visit a supported job listing page (LinkedIn, Indeed, Glassdoor, ZipRecruiter,
        Monster, Dice, Lever, Greenhouse, Workday), the extension reads the job description text
        from the page DOM to perform keyword matching. This text is processed entirely within your
        browser and is <strong>never sent to any server</strong>. The extension does not read or
        access any other content on these pages.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>4. License Key Validation</h2>
      <p style={{ marginBottom: '24px' }}>
        When you activate a license key, the extension sends <strong>only the license key string</strong> to
        LemonSqueezy's license validation API (<code>api.lemonsqueezy.com</code>) to verify your
        purchase. No personal information, resume data, or browsing data is included in this request.
        LemonSqueezy's own privacy policy governs their handling of purchase data: <a href="https://www.lemonsqueezy.com/privacy" style={{ color: '#3b82f6' }}>https://www.lemonsqueezy.com/privacy</a>.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>5. Permissions</h2>
      <p style={{ marginBottom: '12px' }}>The extension requests the following Chrome permissions:</p>
      <ul style={{ paddingLeft: '24px', marginBottom: '24px' }}>
        <li><strong>storage</strong> — to save your resume data and license key locally in your browser</li>
        <li><strong>activeTab</strong> — to read the job description from the currently open tab when you click the extension icon</li>
      </ul>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>6. Third-Party Services</h2>
      <p style={{ marginBottom: '12px' }}>The extension interacts with one third-party service:</p>
      <ul style={{ paddingLeft: '24px', marginBottom: '24px' }}>
        <li><strong>LemonSqueezy</strong> — for license key validation only. No user data is shared beyond the license key string.</li>
      </ul>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>7. Children's Privacy</h2>
      <p style={{ marginBottom: '24px' }}>
        ApplyReady is not directed at children under 13. We do not knowingly collect any data from children.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>8. Changes to This Policy</h2>
      <p style={{ marginBottom: '24px' }}>
        If we update this privacy policy, we will revise the "Last updated" date at the top of this page.
        Continued use of the extension after changes constitutes acceptance of the updated policy.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>9. Contact</h2>
      <p style={{ marginBottom: '32px' }}>
        If you have questions about this privacy policy, please contact us at: <br />
        <strong>ApplyReady.ext@gmail.com</strong>
      </p>

      <footer style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px', paddingTop: '24px', borderTop: '1px solid #f3f4f6' }}>
        <p>© 2026 ApplyReady. All rights reserved.</p>
      </footer>
    </main>
  );
}
