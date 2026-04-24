"use client";
import { useState, useRef } from 'react';
import { parseResumePDFv2 } from '../../lib/resume-parser-v2';
import { analyzeJobMatch } from '../../lib/matcher';
import { downloadResumePDFv2 } from '../../lib/pdf-builder-v2';
import { createSkill, createExperience, createEducation } from '../../lib/resume-data';

export default function Dashboard() {
  const [step, setStep] = useState(1); // 1: Upload, 2: Paste JD, 3: Editor Flow
  const [resumeData, setResumeData] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isParsing, setIsParsing] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsedData = await parseResumePDFv2(buffer);
      setResumeData(parsedData);
      setStep(2);
    } catch (err) {
      alert("Error parsing PDF: " + err.message);
    }
    setIsParsing(false);
  };

  const handleAnalyze = () => {
    if (!jobDescription.trim()) return alert("Please paste a job description.");
    runAnalysis(resumeData);
    setStep(3);
  };

  const runAnalysis = (currentResume) => {
    const result = analyzeJobMatch(jobDescription, currentResume);
    setAnalysis(result);
  };

  // --- STATE MUTATORS (Instantly recalculates ATS score on edit!) ---
  const updateField = (section, id, field, value) => {
    const newData = { ...resumeData };
    const item = newData[section].find(x => x.id === id);
    if (item) item[field] = value;
    setResumeData(newData);
    runAnalysis(newData);
  };

  const removeItem = (section, id) => {
    const newData = { ...resumeData };
    newData[section] = newData[section].filter(x => x.id !== id);
    setResumeData(newData);
    runAnalysis(newData);
  };

  const addMissingSkill = (skillName) => {
    const newData = { ...resumeData };
    newData.skills.push(createSkill(skillName, 'Technical'));
    setResumeData(newData);
    runAnalysis(newData);
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: step === 3 ? '1200px' : '600px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', color: '#1e293b' }}>📄 ApplyReady Dashboard</h1>
          <p style={{ color: '#64748b' }}>Tailor your resume in seconds</p>
        </div>

        {/* STEP 1: UPLOAD RESUME */}
        {step === 1 && (
          <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', border: '2px dashed #cbd5e1', textAlign: 'center', cursor: 'pointer' }} onClick={() => fileInputRef.current.click()}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>{isParsing ? 'Parsing Document...' : 'Upload Base Resume PDF'}</h2>
            <p style={{ color: '#64748b', fontSize: '14px' }}>Click to select or drag and drop your existing resume here.</p>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" style={{ display: 'none' }} />
          </div>
        )}

        {/* STEP 2: PASTE JOB DESCRIPTION */}
        {step === 2 && (
          <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Paste Job Description</h2>
            <textarea 
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here (LinkedIn, Indeed, etc.)..."
              style={{ width: '100%', height: '300px', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', fontFamily: 'inherit', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>← Back</button>
              <button onClick={handleAnalyze} style={{ padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Analyze Match →</button>
            </div>
          </div>
        )}

        {/* STEP 3: SPLIT VIEW EDITOR */}
        {step === 3 && analysis && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            
            {/* LEFT PANE: ATS Score & Keywords */}
            <div style={{ flex: '0 0 320px', background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', position: 'sticky', top: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', border: `8px solid ${analysis.score > 70 ? '#10b981' : analysis.score > 40 ? '#f59e0b' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '32px', fontWeight: 'bold', color: '#1e293b' }}>
                  {analysis.score}%
                </div>
                <p style={{ marginTop: '8px', fontWeight: '600', color: '#64748b' }}>ATS Match Score</p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', color: '#0f766e', marginBottom: '8px' }}>✓ Matched Skills ({analysis.matchingKeywords.length})</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {analysis.matchingKeywords.map(kw => <span key={kw} style={{ background: '#ccfbf1', color: '#047857', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{kw}</span>)}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '14px', color: '#b91c1c', marginBottom: '8px' }}>✗ Missing Skills ({analysis.missingKeywords.length})</h3>
                <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Click a skill to quick-add it to your resume!</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {analysis.missingKeywords.map(kw => (
                    <span key={kw} onClick={() => addMissingSkill(kw)} style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: '1px solid #fca5a5' }}>
                      + {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT PANE: Resume Editor Form */}
            <div style={{ flex: '1', background: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                <h2 style={{ fontSize: '20px' }}>Resume Sections</h2>
                <button onClick={() => downloadResumePDFv2(resumeData)} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Download PDF 📥
                </button>
              </div>

              {/* Skills Editor */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '12px' }}>🛠️ Skills</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {resumeData.skills.map(skill => (
                    <div key={skill.id} style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <input 
                        value={skill.name} 
                        onChange={e => updateField('skills', skill.id, 'name', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: '13px', width: `${Math.max(skill.name.length, 5)}ch`, outline: 'none' }}
                      />
                      <button onClick={() => removeItem('skills', skill.id)} style={{ background: 'none', border: 'none', color: '#ef4444', marginLeft: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => { const d = {...resumeData}; d.skills.push(createSkill('New Skill')); setResumeData(d); }} style={{ background: '#e0f2fe', color: '#1d4ed8', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>+ Add</button>
                </div>
              </div>

              {/* Experience Editor */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '12px' }}>💼 Experience</h3>
                {resumeData.experience.map((exp, index) => (
                  <div key={exp.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px', position: 'relative' }}>
                    <button onClick={() => removeItem('experience', exp.id)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>🗑️</button>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Job Title</label>
                        <input value={exp.title} onChange={e => updateField('experience', exp.id, 'title', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Company</label>
                        <input value={exp.company} onChange={e => updateField('experience', exp.id, 'company', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Timeline</label>
                        <input value={exp.timeline} onChange={e => updateField('experience', exp.id, 'timeline', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Description Bullets (one per line, no bullet symbols needed)</label>
                      <textarea value={exp.description} onChange={e => updateField('experience', exp.id, 'description', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', minHeight: '80px', resize: 'vertical' }} />
                    </div>
                  </div>
                ))}
                <button onClick={() => { const d = {...resumeData}; d.experience.push(createExperience('New Company', 'Title', 'Date', 'Description')); setResumeData(d); }} style={{ width: '100%', background: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>+ Add Experience</button>
              </div>

              {/* Education Editor */}
              <div>
                <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '12px' }}>🎓 Education</h3>
                {resumeData.education.map((edu, index) => (
                  <div key={edu.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px', position: 'relative' }}>
                    <button onClick={() => removeItem('education', edu.id)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>🗑️</button>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Degree</label>
                        <input value={edu.degree} onChange={e => updateField('education', edu.id, 'degree', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>School</label>
                        <input value={edu.school} onChange={e => updateField('education', edu.id, 'school', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => { const d = {...resumeData}; d.education.push(createEducation('School', 'Degree', 'Field', 'Date', '')); setResumeData(d); }} style={{ width: '100%', background: '#f1f5f9', color: '#475569', border: '1px dashed #cbd5e1', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>+ Add Education</button>
              </div>

            </div>
          </div>
        )}
      </div>
    </main>
  );
}