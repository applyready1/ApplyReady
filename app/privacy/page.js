export default function PrivacyPolicy() {
  return (
    <main className="policy-page">
      <a className="policy-back" href="/">Back to ApplyReady</a>
      <h1>Privacy Policy</h1>
      <p className="policy-date">Last updated: April 25, 2026</p>

      <p>
        ApplyReady is a resume and job description matching workspace. In the current website build,
        uploaded resume PDFs are parsed in the browser, and the parsed resume data is saved in this tab's
        session storage. It resets when the tab is closed.
      </p>

      <h2>Data Stored Today</h2>
      <ul>
        <li>Parsed resume sections such as contact details, summary, skills, experience, education, and projects.</li>
        <li>The job description text pasted into the workspace.</li>
      </ul>

      <h2>Data Not Stored Today</h2>
      <ul>
        <li>No account system is active yet.</li>
        <li>No payment or subscription system is active yet.</li>
        <li>No credit card data is collected by ApplyReady.</li>
      </ul>

      <h2>Future Services</h2>
      <p>
        Supabase authentication, Supabase database storage, and LemonSqueezy billing are planned for a
        later release. This policy should be updated before those services are enabled in production.
      </p>

      <h2>Contact</h2>
      <p>
        Questions can be sent to <strong>applyready1@gmail.com</strong>.
      </p>
    </main>
  );
}
