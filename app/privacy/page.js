/**
 * privacy/page.js — ApplyReady Privacy Policy
 * 
 * Privacy policy for the web platform.
 * Explains how we handle user data with Supabase auth and storage.
 * 
 * Dependencies: None (Next.js page component)
 */

export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif', lineHeight: '1.7' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Privacy Policy</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '32px' }}>Last updated: April 22, 2026</p>

      <p style={{ marginBottom: '24px' }}>
        ApplyReady ("we", "our", "the platform") is a web application that helps job seekers
        tailor their resumes to job listings. This privacy policy explains what data we collect, how we
        use it, and your rights.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>1. Data Collection and Storage</h2>
      <p style={{ marginBottom: '12px' }}>
        When you create an account, we store your parsed resume data and account information securely using Supabase. This allows you to log in from any device and instantly access your tailored resumes.
      </p>
      <ul style={{ paddingLeft: '24px', marginBottom: '24px' }}>
        <li><strong>Account Data</strong> — your email address used for authentication.</li>
        <li><strong>Resume Data</strong> — the parsed text and sections from your uploaded PDF.</li>
      </ul>
      <p style={{ marginBottom: '24px' }}>
        We do not sell, share, or transfer your resume data to any third-party advertisers or data brokers.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>2. Job Description Processing</h2>
      <p style={{ marginBottom: '24px' }}>
        When you paste a job description into ApplyReady, we process this text to perform ATS keyword matching against your resume data.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>3. Subscriptions & Payments</h2>
      <p style={{ marginBottom: '24px' }}>
        ApplyReady uses a monthly subscription model. All payments and subscription states are handled securely through 
        <strong> LemonSqueezy</strong>. We do not store your credit card information. We receive webhooks from LemonSqueezy to update your account's subscription status. LemonSqueezy's own privacy policy governs their handling of purchase data: <a href="https://www.lemonsqueezy.com/privacy" style={{ color: '#3b82f6' }}>https://www.lemonsqueezy.com/privacy</a>.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>4. Third-Party Services</h2>
      <p style={{ marginBottom: '12px' }}>The application interacts with the following third-party services:</p>
      <ul style={{ paddingLeft: '24px', marginBottom: '24px' }}>
        <li><strong>Supabase</strong> — For secure database and authentication infrastructure.</li>
        <li><strong>LemonSqueezy</strong> — For payment processing and subscription management.</li>
      </ul>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>5. Children's Privacy</h2>
      <p style={{ marginBottom: '24px' }}>
        ApplyReady is not directed at children under 13. We do not knowingly collect any data from children.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>6. Changes to This Policy</h2>
      <p style={{ marginBottom: '24px' }}>
        If we update this privacy policy, we will revise the "Last updated" date at the top of this page.
        Continued use of the platform after changes constitutes acceptance of the updated policy.
      </p>

      <h2 style={{ fontSize: '1.25rem', marginTop: '28px', marginBottom: '8px' }}>7. Contact</h2>
      <p style={{ marginBottom: '32px' }}>
        If you have questions about this privacy policy, please contact us at: <br />
        <strong>applyready1@gmail.com</strong>
      </p>

      <footer style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px', paddingTop: '24px', borderTop: '1px solid #f3f4f6' }}>
        <p>© 2026 ApplyReady. All rights reserved.</p>
      </footer>
    </main>
  );
}
