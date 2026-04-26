import React from "react";

export const metadata = {
  title: "How It Works - ApplyReady",
  description: "Learn how ApplyReady calculates your ATS match score.",
};

export default function HowItWorksPage() {
  return (
    <main className="workspace-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ApplyReady home">
          <img className="brand-icon" src="/favicon.ico" alt="" />
          <span>ApplyReady</span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="/#workspace">Workspace</a>
          <a href="/#editor">Resume</a>
          <a href="/how-it-works">How it works</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </header>

      <section className="intro-band">
        <div>
          <p className="eyebrow">Behind the scenes</p>
          <h1>How ApplyReady calculates your ATS score</h1>
        </div>
      </section>

      <section className="workspace-grid" style={{ display: 'block', maxWidth: '800px', margin: '2rem auto' }}>
        <div className="panel">
          <div className="panel-heading" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h2>The Matching Engine</h2>
            </div>
          </div>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>Our Applicant Tracking System (ATS) matching engine compares your resume against the provided Job Description (JD) using a transparent, weighted scoring system.</p>
          
          <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>1. Keyword Extraction</h3>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>First, we scan the JD to identify required and preferred skills, tools, and technical terms. We use a built-in dictionary and dynamic extraction to pull out the most important keywords.</p>
          
          <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>2. Intelligent Alias Matching</h3>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>We know that "JS" means "JavaScript" and "AWS" means "Amazon Web Services". Our engine uses an alias map to ensure you get credit for your skills regardless of the exact abbreviation used.</p>
          
          <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>3. Weighted Scoring</h3>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>Not all keywords are created equal. Finding a keyword in your Work Experience is worth more than just listing it in a Skills section. We apply the following weights:</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', lineHeight: '1.6' }}>
            <li><strong>Experience:</strong> 1.5x multiplier</li>
            <li><strong>Projects & Summary:</strong> 1.2x multiplier</li>
            <li><strong>Skills:</strong> 1.0x multiplier</li>
            <li><strong>Education:</strong> 0.7x multiplier</li>
          </ul>
          
          <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>4. Actionable Feedback</h3>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>Finally, the engine calculates a base score out of 100 based on the matched weights versus the total required weights. We also provide a list of missing keywords and phrases so you can quickly optimize your resume to hit that 100% mark.</p>
        </div>
      </section>
    </main>
  );
}