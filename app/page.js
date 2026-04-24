/**
 * page.js — ApplyReady Landing Page
 * 
 * Public-facing landing page for the web platform.
 * Product description, feature highlights, pricing,
 * and sign-up button.
 * 
 * Dependencies: constants.js (PRICE)
 */

import { SUBSCRIPTION_DURATION } from './constants';

export default function LandingPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Navigation Bar */}
      <nav style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
        <a href="/dashboard" style={{ padding: '8px 16px', color: '#4b5563', textDecoration: 'none', fontWeight: '500', borderRadius: '6px' }}>Log in</a>
        <a href="/dashboard" style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', textDecoration: 'none', fontWeight: '500', borderRadius: '6px' }}>Sign up</a>
      </nav>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
        📄 ApplyReady
      </h1>
      <p style={{ fontSize: '1.25rem', color: '#6b7280', marginBottom: '32px' }}>
        Tailor your resume to any job listing in seconds. Free ATS matching. $2.99/month for unlimited PDF downloads.
      </p>

      {/* Hero Section */}
      <section style={{ background: '#eff6ff', borderRadius: '12px', padding: '32px', marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '16px' }}>How It Works</h2>
        <ol style={{ lineHeight: '2', paddingLeft: '20px' }}>
          <li>Sign up and securely upload your base resume PDF.</li>
          <li>Paste any Job Description into the analyzer.</li>
          <li>See your ATS match score and missing keywords instantly.</li>
          <li>Edit your sections with keyword guidance</li>
          <li>Download a tailored, ATS-optimized resume PDF</li>
        </ol>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#059669' }}>
          💡 Tailor your resume perfectly for any role in seconds, entirely from your browser.
        </p>
      </section>

      {/* Features */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '16px' }}>Why ApplyReady?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>✅ Secure Cloud Storage</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Log in from anywhere. Your parsed resume data is safely backed up in your account.</p>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>✅ Instant Matching</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>ATS keyword score in under 1 second. Free, unlimited scans.</p>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>🌐 Universal Paste</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No extensions needed. Just copy the job description from any site and paste it.</p>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>📋 Smart Reordering</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Sections auto-sorted by relevance. Most important skills first.</p>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>⚡ Cross-Device Access</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Access your tailored resumes from your laptop, tablet, or phone.</p>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>💰 $2.99/month</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Monthly subscription. No auto renewal. {SUBSCRIPTION_DURATION} license period.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: 'center', marginBottom: '32px' }}>
        <a
          href="/dashboard"
          style={{
            display: 'inline-block',
            background: '#3b82f6',
            color: '#fff',
            padding: '14px 32px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            textDecoration: 'none'
          }}
        >
          Get Started — Free
        </a>
        <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '8px' }}>
          Free ATS matching. $2.99/month for unlimited PDF downloads.
        </p>
        <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
          🌍 Available worldwide — pay in your local currency.
        </p>
      </section>

      {/* Important Disclaimer */}
      <section style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '4px', marginBottom: '32px' }}>
        <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#78350f' }}>
          <strong>📌 Important: About Your Original Resume</strong>
          <p style={{ marginTop: '8px', marginBottom: '0' }}>
            When you upload your resume, we don't preserve the original formatting (bold, italics, special fonts, colors, etc.). 
            Instead, we rebuild a <strong>clean, ATS-optimized resume</strong> using:
          </p>
          <ul style={{ marginTop: '8px', paddingLeft: '20px', marginBottom: '8px' }}>
            <li>Your extracted text and information</li>
            <li>Keywords matched from the job description</li>
            <li>Professional, readable formatting</li>
          </ul>
          <p style={{ marginTop: '8px', marginBottom: '0' }}>
            This approach maximizes your chances of <strong>passing through ATS systems</strong>, which often struggle with complex formatting anyway. 
            Your original resume remains safely in your browser — we don't store or modify it.
          </p>
        </div>
      </section>

      {/* Comparison */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '16px' }}>ApplyReady vs Competitors</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Feature</th>
              <th style={{ padding: '8px' }}>ApplyReady</th>
              <th style={{ padding: '8px' }}>The Leading Resume Scanner($50/mo)</th>
              <th style={{ padding: '8px' }}>The Premium Job Tracker ($29/mo)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px' }}>ATS Keyword Matching</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✓ Free</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✓</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✓</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px' }}>Tailored Resume PDF</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✓ $2.99/month</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✘</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✓</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px' }}>Privacy (no data sent)</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✓</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✘</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✘</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px' }}>No account required</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✓</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✘</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>✘</td>
            </tr>
            <tr>
              <td style={{ padding: '8px' }}>Price</td>
              <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>$2.99/month</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>$50/mo</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>$29/mo</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: '#9ca3af', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
          Price shown in USD. Checkout converts to your local currency automatically.
        </p>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px', paddingTop: '24px', borderTop: '1px solid #f3f4f6' }}>
        <p>© 2026 ApplyReady. All rights reserved.</p>
        <p style={{ marginTop: '4px' }}>
          <a href="/privacy" style={{ color: '#6b7280' }}>Privacy Policy</a>
        </p>
      </footer>
      </main>
    </div>
  );
}
