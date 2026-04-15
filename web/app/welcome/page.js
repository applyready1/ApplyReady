/**
 * welcome/page.js — Post-Install Welcome Page
 * 
 * Shown to users immediately after installing the extension.
 * Guides them through uploading their resume and using the tool.
 * 
 * Dependencies: constants.js (PRICE)
 */

import { PRICE } from '../constants';

export default function WelcomePage() {
  return (
    <main style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>
        🎉 Welcome to ApplyReady!
      </h1>
      <p style={{ fontSize: '1.1rem', color: '#6b7280', marginBottom: '32px' }}>
        You're all set. Here's how to get started in 3 steps.
      </p>

      {/* Step 1 */}
      <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Step 1: Upload Your Resume</h2>
        <p style={{ color: '#4b5563', fontSize: '14px' }}>
          Click the ApplyReady icon in your browser toolbar and upload your resume PDF.
          Your resume stays in your browser — we never see it.
        </p>
      </div>

      {/* Step 2 */}
      <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Step 2: Browse Jobs</h2>
        <p style={{ color: '#4b5563', fontSize: '14px' }}>
          Go to any job listing on LinkedIn, Indeed, Glassdoor, ZipRecruiter, or other supported sites.
          The extension icon will show a "JOB" badge when it detects a listing.
        </p>
      </div>

      {/* Step 3 */}
      <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Step 3: Match & Tailor</h2>
        <p style={{ color: '#4b5563', fontSize: '14px' }}>
          Click the icon to see your ATS match score, missing keywords, and optimized section order.
          Edit your resume with keyword guidance and download a tailored PDF.
        </p>
      </div>

      {/* Free vs Premium */}
      <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Free vs Premium</h2>
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '6px' }}>Feature</th>
              <th style={{ padding: '6px' }}>Free</th>
              <th style={{ padding: '6px' }}>{PRICE}</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px' }}>ATS Match Score</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>✓</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>✓</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px' }}>Missing Keywords</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>✓</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>✓</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px' }}>Section Reordering</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>✓ (preview)</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>✓</td>
            </tr>
            <tr>
              <td style={{ padding: '6px' }}>Download Tailored PDF</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>✘</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>✓ Unlimited</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Ready? Click the ApplyReady icon in your toolbar to upload your resume.
        </p>
        <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>
          🌍 Available worldwide — pay in your local currency at checkout.
        </p>
      </div>
    </main>
  );
}
