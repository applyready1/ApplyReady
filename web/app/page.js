/**
 * page.js — ApplyReady Landing Page
 * 
 * Public-facing landing page for the Chrome extension.
 * Product description, feature highlights, pricing,
 * and Chrome Web Store install button.
 * 
 * Dependencies: constants.js (PRICE)
 */

import { PRICE } from './constants';

export default function LandingPage() {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
        📄 ApplyReady
      </h1>
      <p style={{ fontSize: '1.25rem', color: '#6b7280', marginBottom: '32px' }}>
        Tailor your resume to any job listing in seconds. Free ATS matching. {PRICE} one-time for PDF download.
      </p>

      {/* Hero Section */}
      <section style={{ background: '#eff6ff', borderRadius: '12px', padding: '32px', marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '16px' }}>How It Works</h2>
        <ol style={{ lineHeight: '2', paddingLeft: '20px' }}>
          <li>Upload your resume PDF (stays in your browser — we never see it)</li>
          <li>Browse to any job listing on LinkedIn, Indeed, Glassdoor, etc.</li>
          <li>See your ATS match score and missing keywords instantly</li>
          <li>Edit your sections with keyword guidance</li>
          <li>Download a tailored, ATS-optimized resume PDF</li>
        </ol>
      </section>

      {/* Features */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '16px' }}>Why ApplyReady?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>✅ 100% Private</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Your resume never leaves your browser. Zero data collection.</p>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>✅ Instant Matching</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>ATS keyword score in under 1 second. Free, unlimited scans.</p>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>📋 Smart Reordering</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Sections auto-sorted by relevance. Most important skills first.</p>
          </div>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong>💰 {PRICE} Once, Yours Forever</strong>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No subscription. No credits. One payment, unlimited use.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: 'center', marginBottom: '32px' }}>
        <a
          href="https://chromewebstore.google.com/detail/PLACEHOLDER_EXTENSION_ID"
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
          Add to Chrome — Free
        </a>
        <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '8px' }}>
          Free ATS matching. {PRICE} one-time for PDF download.
        </p>
        <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
          🌍 Available worldwide — pay in your local currency.
        </p>
      </section>

      {/* Comparison */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '16px' }}>ApplyReady vs Competitors</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Feature</th>
              <th style={{ padding: '8px' }}>ApplyReady</th>
              <th style={{ padding: '8px' }}>Jobscan ($50/mo)</th>
              <th style={{ padding: '8px' }}>Teal ($29/mo)</th>
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
              <td style={{ padding: '8px', textAlign: 'center' }}>✓ {PRICE} once</td>
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
              <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>{PRICE} once</td>
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
  );
}
