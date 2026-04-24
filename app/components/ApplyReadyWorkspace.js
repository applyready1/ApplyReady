"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseResumePDFv2 } from "../../lib/resume-parser-v2";
import { analyzeJobMatch } from "../../lib/matcher";
import { downloadResumePDFv2 } from "../../lib/pdf-builder-v2";
import {
  createEducation,
  createEmptyResume,
  createExperience,
  createProject,
  createSkill
} from "../../lib/resume-data";

const RESUME_STORAGE_KEY = "applyready.resume.v1";
const JD_STORAGE_KEY = "applyready.jobDescription.v1";

const sectionTabs = [
  { id: "contact", label: "Contact" },
  { id: "summary", label: "Summary" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "projects", label: "Projects" }
];

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function withId(item) {
  return { ...item, id: item.id || makeId() };
}

function normalizeResumeData(data) {
  const empty = createEmptyResume();
  const source = data && typeof data === "object" ? data : empty;

  return {
    contact: { ...empty.contact, ...(source.contact || {}) },
    summary: source.summary || "",
    skills: Array.isArray(source.skills) ? source.skills.map(withId) : [],
    experience: Array.isArray(source.experience) ? source.experience.map(withId) : [],
    education: Array.isArray(source.education) ? source.education.map(withId) : [],
    projects: Array.isArray(source.projects) ? source.projects.map(withId) : []
  };
}

function cloneResumeData(data) {
  const normalized = normalizeResumeData(data);
  return {
    contact: { ...normalized.contact },
    summary: normalized.summary,
    skills: normalized.skills.map((item) => ({ ...item })),
    experience: normalized.experience.map((item) => ({ ...item })),
    education: normalized.education.map((item) => ({ ...item })),
    projects: normalized.projects.map((item) => ({ ...item }))
  };
}

function resumeHasContent(resume) {
  const data = normalizeResumeData(resume);
  return Boolean(
    data.contact.name ||
      data.contact.email ||
      data.contact.phone ||
      data.contact.linkedin ||
      data.summary ||
      data.skills.length ||
      data.experience.length ||
      data.education.length ||
      data.projects.length
  );
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function scoreTone(score) {
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ title, detail }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export default function ApplyReadyWorkspace() {
  const fileInputRef = useRef(null);
  const [hydrated, setHydrated] = useState(false);
  const [activeSection, setActiveSection] = useState("contact");
  const [resumeData, setResumeData] = useState(() => createEmptyResume());
  const [jobDescription, setJobDescription] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const storedResume = window.localStorage.getItem(RESUME_STORAGE_KEY);
      const storedJd = window.localStorage.getItem(JD_STORAGE_KEY);

      if (storedResume) {
        setResumeData(normalizeResumeData(JSON.parse(storedResume)));
      }
      if (storedJd) {
        setJobDescription(storedJd);
      }
    } catch (storageError) {
      setError("Stored resume data could not be loaded.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resumeData));
  }, [hydrated, resumeData]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(JD_STORAGE_KEY, jobDescription);
  }, [hydrated, jobDescription]);

  const hasResume = useMemo(() => resumeHasContent(resumeData), [resumeData]);
  const analysis = useMemo(() => {
    if (!hasResume || !jobDescription.trim()) return null;
    return analyzeJobMatch(jobDescription, resumeData);
  }, [hasResume, jobDescription, resumeData]);

  const resumeStats = useMemo(() => {
    const words = [
      resumeData.summary,
      ...resumeData.experience.map((item) => `${item.title} ${item.company} ${item.description}`),
      ...resumeData.projects.map((item) => `${item.name} ${item.description}`),
      ...resumeData.education.map((item) => `${item.degree} ${item.school} ${item.description}`),
      ...resumeData.skills.map((item) => item.name)
    ].join(" ");

    return {
      words: countWords(words),
      skills: resumeData.skills.length,
      experience: resumeData.experience.length,
      projects: resumeData.projects.length
    };
  }, [resumeData]);

  function mutateResume(updater) {
    setResumeData((current) => {
      const next = cloneResumeData(current);
      updater(next);
      return next;
    });
  }

  function updateContact(field, value) {
    mutateResume((next) => {
      next.contact[field] = value;
    });
  }

  function updateSummary(value) {
    mutateResume((next) => {
      next.summary = value;
    });
  }

  function updateItem(section, id, field, value) {
    mutateResume((next) => {
      const item = next[section].find((entry) => entry.id === id);
      if (item) item[field] = value;
    });
  }

  function removeItem(section, id) {
    mutateResume((next) => {
      next[section] = next[section].filter((entry) => entry.id !== id);
    });
  }

  function addSkill(name = "New skill", category = "Other") {
    mutateResume((next) => {
      const alreadyExists = next.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase());
      if (!alreadyExists) {
        next.skills.push(createSkill(name, category));
      }
    });
    setActiveSection("skills");
  }

  async function parseFile(file) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Upload a PDF resume.");
      return;
    }

    setIsParsing(true);
    setError("");
    setMessage("");

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseResumePDFv2(buffer);
      setResumeData(normalizeResumeData(parsed));
      setActiveSection("contact");
      setMessage("Resume parsed and saved locally.");
    } catch (parseError) {
      setError(parseError.message || "Resume parsing failed.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    parseFile(event.dataTransfer.files?.[0]);
  }

  async function handleDownload() {
    if (!hasResume) {
      setError("Add or upload resume data before downloading.");
      return;
    }

    setError("");
    try {
      await downloadResumePDFv2(resumeData);
      setMessage("PDF generated.");
    } catch (downloadError) {
      setError(downloadError.message || "PDF generation failed.");
    }
  }

  function clearWorkspace() {
    const shouldClear = window.confirm("Clear saved resume and job description from this browser?");
    if (!shouldClear) return;

    setResumeData(createEmptyResume());
    setJobDescription("");
    setActiveSection("contact");
    setMessage("Workspace cleared.");
    setError("");
  }

  return (
    <main className="workspace-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ApplyReady home">
          <img className="brand-icon" src="/favicon.ico" alt="" />
          <span>ApplyReady</span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#workspace">Workspace</a>
          <a href="#editor">Resume</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </header>

      <section className="intro-band">
        <div>
          <p className="eyebrow">Website-first ATS workspace</p>
          <h1>Paste a job description, tune your resume, and download a clean ATS PDF.</h1>
        </div>
        <div className="intro-actions">
          <button className="button primary" type="button" onClick={() => fileInputRef.current?.click()}>
            Upload resume
          </button>
          <button className="button subtle" type="button" onClick={clearWorkspace}>
            Clear
          </button>
        </div>
      </section>

      <section className="workspace-grid" id="workspace">
        <div className="panel upload-panel" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Resume profile</p>
              <h2>Base resume</h2>
            </div>
            <span className="status-pill">{hydrated ? "Saved locally" : "Loading"}</span>
          </div>

          <button className="dropzone" type="button" onClick={() => fileInputRef.current?.click()}>
            <span className="dropzone-title">{isParsing ? "Parsing resume" : "Upload PDF resume"}</span>
            <span className="dropzone-detail">PDF only. Parsed sections stay in this browser for now.</span>
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => parseFile(event.target.files?.[0])}
          />

          <div className="stats-grid">
            <div>
              <strong>{resumeStats.words}</strong>
              <span>words</span>
            </div>
            <div>
              <strong>{resumeStats.skills}</strong>
              <span>skills</span>
            </div>
            <div>
              <strong>{resumeStats.experience}</strong>
              <span>roles</span>
            </div>
            <div>
              <strong>{resumeStats.projects}</strong>
              <span>projects</span>
            </div>
          </div>

          {(message || error) && (
            <div className={error ? "notice error" : "notice"}>{error || message}</div>
          )}
        </div>

        <div className="panel jd-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Job description</p>
              <h2>ATS scan</h2>
            </div>
            <span className="status-pill">{countWords(jobDescription)} words</span>
          </div>

          <textarea
            className="jd-input"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the full job description here."
          />
        </div>
      </section>

      <section className="analysis-layout">
        <aside className="score-panel panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Match score</p>
              <h2>ATS result</h2>
            </div>
          </div>

          {analysis ? (
            <>
              <div className={`score-ring ${scoreTone(analysis.score)}`}>
                <strong>{analysis.score}%</strong>
                <span>match</span>
              </div>
              <div className="coverage-row">
                <span>Required coverage</span>
                <strong>
                  {analysis.requiredTotal ? `${analysis.requiredMatched}/${analysis.requiredTotal}` : "N/A"}
                </strong>
              </div>
              <div className="coverage-row">
                <span>Suggested first section</span>
                <strong>{analysis.suggestedSectionOrder?.[0] || "Resume"}</strong>
              </div>
              <button className="button primary full-width" type="button" onClick={handleDownload}>
                Download PDF
              </button>
            </>
          ) : (
            <EmptyState title="No scan yet" detail="Add resume data and paste a job description." />
          )}
        </aside>

        <div className="keyword-panel panel">
          <div className="keyword-columns">
            <KeywordList title="Matched keywords" tone="match" keywords={analysis?.matchingKeywords || []} />
            <KeywordList title="Missing keywords" tone="missing" keywords={analysis?.missingKeywords || []} onAdd={addSkill} />
            <KeywordList title="Missing phrases" tone="phrase" keywords={analysis?.missingPhrases || []} />
          </div>

          {analysis?.suggestedSectionOrder?.length > 0 && (
            <div className="section-order">
              <span>Section order</span>
              <div>
                {analysis.suggestedSectionOrder.map((section) => (
                  <button key={section} type="button" onClick={() => setActiveSection(section.toLowerCase())}>
                    {section}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="editor-layout" id="editor">
        <div className="section-tabs" role="tablist" aria-label="Resume sections">
          {sectionTabs.map((tab) => (
            <button
              key={tab.id}
              className={activeSection === tab.id ? "active" : ""}
              type="button"
              onClick={() => setActiveSection(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="editor-panel panel">
          {activeSection === "contact" && (
            <div className="form-grid two-col">
              <Field label="Full name">
                <input value={resumeData.contact.name} onChange={(event) => updateContact("name", event.target.value)} />
              </Field>
              <Field label="Email">
                <input value={resumeData.contact.email} onChange={(event) => updateContact("email", event.target.value)} />
              </Field>
              <Field label="Phone">
                <input value={resumeData.contact.phone} onChange={(event) => updateContact("phone", event.target.value)} />
              </Field>
              <Field label="LinkedIn or portfolio">
                <input value={resumeData.contact.linkedin} onChange={(event) => updateContact("linkedin", event.target.value)} />
              </Field>
            </div>
          )}

          {activeSection === "summary" && (
            <Field label="Professional summary">
              <textarea rows="9" value={resumeData.summary} onChange={(event) => updateSummary(event.target.value)} />
            </Field>
          )}

          {activeSection === "skills" && (
            <div className="editor-stack">
              <div className="inline-actions">
                <button className="button subtle" type="button" onClick={() => addSkill()}>
                  Add skill
                </button>
              </div>
              {resumeData.skills.length ? (
                resumeData.skills.map((skill) => (
                  <div className="editor-card skill-card" key={skill.id}>
                    <Field label="Skill">
                      <input value={skill.name} onChange={(event) => updateItem("skills", skill.id, "name", event.target.value)} />
                    </Field>
                    <Field label="Category">
                      <input value={skill.category || ""} onChange={(event) => updateItem("skills", skill.id, "category", event.target.value)} />
                    </Field>
                    <button className="icon-button danger" type="button" onClick={() => removeItem("skills", skill.id)} aria-label={`Remove ${skill.name}`}>
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState title="No skills yet" detail="Add skills manually or quick-add missing keywords after a scan." />
              )}
            </div>
          )}

          {activeSection === "experience" && (
            <div className="editor-stack">
              <div className="inline-actions">
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => mutateResume((next) => next.experience.push(createExperience("", "", "", "")))}
                >
                  Add experience
                </button>
              </div>
              {resumeData.experience.length ? (
                resumeData.experience.map((item) => (
                  <ExperienceCard key={item.id} item={item} updateItem={updateItem} removeItem={removeItem} />
                ))
              ) : (
                <EmptyState title="No experience yet" detail="Add roles and accomplishment bullets." />
              )}
            </div>
          )}

          {activeSection === "education" && (
            <div className="editor-stack">
              <div className="inline-actions">
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => mutateResume((next) => next.education.push(createEducation("", "", "", "", "")))}
                >
                  Add education
                </button>
              </div>
              {resumeData.education.length ? (
                resumeData.education.map((item) => (
                  <EducationCard key={item.id} item={item} updateItem={updateItem} removeItem={removeItem} />
                ))
              ) : (
                <EmptyState title="No education yet" detail="Add degrees, certifications, or coursework." />
              )}
            </div>
          )}

          {activeSection === "projects" && (
            <div className="editor-stack">
              <div className="inline-actions">
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => mutateResume((next) => next.projects.push(createProject("", "", "")))}
                >
                  Add project
                </button>
              </div>
              {resumeData.projects.length ? (
                resumeData.projects.map((item) => (
                  <ProjectCard key={item.id} item={item} updateItem={updateItem} removeItem={removeItem} />
                ))
              ) : (
                <EmptyState title="No projects yet" detail="Add projects that match the role." />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function KeywordList({ title, tone, keywords, onAdd }) {
  return (
    <div className="keyword-list">
      <h3>{title}</h3>
      {keywords.length ? (
        <div className="tags">
          {keywords.map((keyword) => (
            <button
              className={`tag ${tone}`}
              key={keyword}
              type="button"
              onClick={onAdd ? () => onAdd(keyword, "ATS keyword") : undefined}
              disabled={!onAdd}
            >
              {onAdd ? `Add ${keyword}` : keyword}
            </button>
          ))}
        </div>
      ) : (
        <span className="muted">None yet</span>
      )}
    </div>
  );
}

function ExperienceCard({ item, updateItem, removeItem }) {
  return (
    <div className="editor-card">
      <div className="form-grid three-col">
        <Field label="Job title">
          <input value={item.title} onChange={(event) => updateItem("experience", item.id, "title", event.target.value)} />
        </Field>
        <Field label="Company">
          <input value={item.company} onChange={(event) => updateItem("experience", item.id, "company", event.target.value)} />
        </Field>
        <Field label="Timeline">
          <input value={item.timeline} onChange={(event) => updateItem("experience", item.id, "timeline", event.target.value)} />
        </Field>
      </div>
      <Field label="Accomplishments">
        <textarea rows="6" value={item.description} onChange={(event) => updateItem("experience", item.id, "description", event.target.value)} />
      </Field>
      <div className="card-actions">
        <button className="button danger" type="button" onClick={() => removeItem("experience", item.id)}>
          Remove role
        </button>
      </div>
    </div>
  );
}

function EducationCard({ item, updateItem, removeItem }) {
  return (
    <div className="editor-card">
      <div className="form-grid two-col">
        <Field label="Degree">
          <input value={item.degree} onChange={(event) => updateItem("education", item.id, "degree", event.target.value)} />
        </Field>
        <Field label="School">
          <input value={item.school} onChange={(event) => updateItem("education", item.id, "school", event.target.value)} />
        </Field>
        <Field label="Field">
          <input value={item.field || ""} onChange={(event) => updateItem("education", item.id, "field", event.target.value)} />
        </Field>
        <Field label="Timeline">
          <input value={item.timeline} onChange={(event) => updateItem("education", item.id, "timeline", event.target.value)} />
        </Field>
      </div>
      <Field label="Details">
        <textarea rows="4" value={item.description || ""} onChange={(event) => updateItem("education", item.id, "description", event.target.value)} />
      </Field>
      <div className="card-actions">
        <button className="button danger" type="button" onClick={() => removeItem("education", item.id)}>
          Remove education
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ item, updateItem, removeItem }) {
  return (
    <div className="editor-card">
      <div className="form-grid two-col">
        <Field label="Project name">
          <input value={item.name} onChange={(event) => updateItem("projects", item.id, "name", event.target.value)} />
        </Field>
        <Field label="Link">
          <input value={item.link || ""} onChange={(event) => updateItem("projects", item.id, "link", event.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <textarea rows="5" value={item.description} onChange={(event) => updateItem("projects", item.id, "description", event.target.value)} />
      </Field>
      <div className="card-actions">
        <button className="button danger" type="button" onClick={() => removeItem("projects", item.id)}>
          Remove project
        </button>
      </div>
    </div>
  );
}
