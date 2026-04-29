import React, { useState, useEffect, useCallback } from "react";
import "./styles.css";

const CIRCUMFERENCE = 2 * Math.PI * 66;

const STEPS = [
  { icon: "📄", label: "Reading" },
  { icon: "🔍", label: "Skills" },
  { icon: "✨", label: "Clarity" },
  { icon: "🎯", label: "Impact" },
];

export default function App() {
  const [file, setFile] = useState(null);
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState(0);
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("action");

  // Builder State
  const [mode, setMode] = useState("analyze"); // "analyze" | "build"
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [brainDump, setBrainDump] = useState("");

  /* --- loading step rotation --- */
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1200);
    return () => clearInterval(t);
  }, [loading]);

  /* --- score animation --- */
  useEffect(() => {
    if (!data?.score) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 2;
      if (i >= data.score) { i = data.score; clearInterval(interval); }
      setScore(i);
    }, 15);
    return () => clearInterval(interval);
  }, [data]);

  const getScoreColor = (s) => {
    if (s >= 80) return "var(--green)";
    if (s >= 60) return "var(--amber)";
    return "var(--red)";
  };

  const getScoreLabel = (s) => {
    if (s >= 80) return "Strong Resume ✅";
    if (s >= 60) return "Needs Improvement ⚠️";
    return "Weak Resume ❌";
  };

  /* --- drag & drop --- */
  const onDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") setFile(f);
  }, []);

  // Use environment variable for production, default to localhost for development
  const API_URL = import.meta.env.VITE_API_URL || "https://resumeai-yq3d.onrender.com";

  /* --- submit --- */
  const submit = async () => {
    if (!file) {
      setError("Please upload a resume first.");
      return;
    }
    const fd = new FormData();
    fd.append("resume", file);
    fd.append("role", role);
    fd.append("jobDescription", jobDescription);
    
    setLoading(true);
    setError("");
    setData(null);
    setStep(0);
    try {
      const res = await fetch(`${API_URL}/analyze`, { method: "POST", body: fd });
      const result = await res.json();
      if (!result || typeof result !== "object") { 
        setError("Invalid server response. Please try again.");
        return; 
      }
      setData(result);
    } catch (err) {
      console.error(err);
      setError("Server error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* --- generate --- */
  const generate = async () => {
    if (!brainDump) {
      setError("Please provide some experience notes (brain-dump) first.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    setStep(0);
    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, jobDescription, brainDump }),
      });
      const result = await res.json();
      if (!result || typeof result !== "object" || result.error) {
        setError(result?.error || "Invalid server response.");
        return;
      }
      setData(result);
    } catch (err) {
      console.error(err);
      setError("Server error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* --- copy rewrite --- */
  const copyRewrite = () => {
    if (!data?.rewrite) return;
    navigator.clipboard.writeText(data.rewrite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dashOffset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  return (
    <div className="app">
      <div className="orb-3" />
      <div className="glass">

        {/* ====== HERO ====== */}
        {!data && (
          <div className="hero-main fade-in">
            <h1 className="gradient-text">
              {mode === "analyze" ? "Analyze Your Resume" : "AI Resume Builder"}
            </h1>
            <p className="hero-sub">
              {mode === "analyze" 
                ? "AI-powered feedback to boost your ATS score and land more interviews."
                : "Turn your messy notes into a perfectly formatted professional resume."}
            </p>
            
            <div className="mode-toggle">
              <button className={`mode-btn ${mode === "analyze" ? "active" : ""}`} onClick={() => { setMode("analyze"); setError(""); }}>Analyzer</button>
              <button className={`mode-btn ${mode === "build" ? "active" : ""}`} onClick={() => { setMode("build"); setError(""); }}>Builder</button>
            </div>
          </div>
        )}

        {/* ====== INPUT AREA ====== */}
        {!data && !loading && (
          <div className="input-area fade-in">
            {error && (
              <div className="section danger fade-in" style={{ marginTop: 0, marginBottom: "10px" }}>
                <h3 style={{ margin: 0 }}>⚠️ {error}</h3>
              </div>
            )}

            {mode === "analyze" ? (
              <>
                <input className="role-input" placeholder="Target role (e.g. Frontend Developer)" value={role} onChange={(e) => setRole(e.target.value)} />
                <textarea className="jd-input" placeholder="Paste Job Description here (optional but highly recommended for ATS matching)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                <div className={`upload ${dragging ? "dragging" : ""}`} onClick={() => document.getElementById("file").click()} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
                  <input id="file" type="file" accept=".pdf" hidden onChange={(e) => { setFile(e.target.files[0]); setError(""); }} />
                  <span className="upload-icon">📄</span>
                  <p>{file ? file.name : "Drop your resume here or click to browse"}</p>
                  <p className="file-hint">PDF files only</p>
                </div>
                <button className="btn cta-btn" onClick={submit}>Analyze Resume →</button>
              </>
            ) : (
              <div className="builder-form fade-in" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group">
                  <input className="role-input" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
                  <input className="role-input" placeholder="Contact Info (Email, Phone, LinkedIn)" value={contact} onChange={(e) => setContact(e.target.value)} />
                </div>
                <textarea className="jd-input" style={{ minHeight: "80px" }} placeholder="Target Job Description (optional)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                <textarea className="jd-input" style={{ minHeight: "150px" }} placeholder="Experience Brain Dump (Tell me about your past jobs, responsibilities, projects, education. Don't worry about formatting, just type it out!)" value={brainDump} onChange={(e) => setBrainDump(e.target.value)} />
                <button className="btn cta-btn" onClick={generate}>✨ Generate Professional Resume →</button>
              </div>
            )}
          </div>
        )}

        {/* ====== LOADING ====== */}
        {loading && (
          <div className="loading-box fade-in">
            <div className="progress-steps">
              {STEPS.map((s, i) => (
                <div key={i} className={`p-step ${i < step ? "done" : ""} ${i === step ? "active" : ""}`}>
                  <div className="p-dot">{i < step ? "✓" : s.icon}</div>
                  <span className="p-step-label">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
            <p className="loading-text">Analyzing your resume…</p>
          </div>
        )}

        {/* ====== RESULTS ====== */}
        {data && mode === "analyze" && (
          <div className="results dashboard-grid">
            
            {/* Left Column (Overview) */}
            <div className="dashboard-left">
              <div className="hero fade-in stagger-1">
                <div className="score-gauge">
                  <svg viewBox="0 0 160 160">
                    <circle className="gauge-bg" cx="80" cy="80" r="66" />
                    <circle
                      className="gauge-fill"
                      cx="80" cy="80" r="66"
                      style={{
                        stroke: getScoreColor(score),
                        strokeDasharray: CIRCUMFERENCE,
                        strokeDashoffset: dashOffset,
                      }}
                    />
                  </svg>
                  <div className="score-value" style={{ color: getScoreColor(score) }}>{score}</div>
                </div>
                <p className="score-label" style={{ color: getScoreColor(score) }}>{getScoreLabel(score)}</p>

                {data.detected_role && <p className="detected-role">🎯 {data.detected_role}</p>}

                {data.ats_score !== undefined && (
                  <div className="ats-box">
                    <div className="ats-header">
                      <span className="ats-title">ATS Compatibility</span>
                      <span className="ats-score">{data.ats_score}%</span>
                    </div>
                    <div className="ats-bar">
                      <div className="ats-fill" style={{ width: `${data.ats_score || 0}%` }} />
                    </div>
                  </div>
                )}

                {data.summary && <p className="summary">{data.summary}</p>}
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button className="btn reset fade-in stagger-9" style={{ flex: 1, marginTop: 0 }} onClick={() => { setData(null); setScore(0); setCopied(false); }}>
                    ← Start Over
                  </button>
                  <button className="btn cta-btn fade-in stagger-9" style={{ flex: 1, marginTop: 0 }} onClick={() => window.print()}>
                    📄 Save PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column (Details) */}
            <div className="dashboard-right">
              
              <div className="tabs-nav fade-in stagger-2">
                <button 
                  className={`tab-btn ${activeTab === "action" ? "active" : ""}`}
                  onClick={() => setActiveTab("action")}
                >🚀 Action Plan</button>
                <button 
                  className={`tab-btn ${activeTab === "keywords" ? "active" : ""}`}
                  onClick={() => setActiveTab("keywords")}
                >🔍 Keyword Matcher</button>
                <button 
                  className={`tab-btn ${activeTab === "review" ? "active" : ""}`}
                  onClick={() => setActiveTab("review")}
                >📋 Deep Review</button>
              </div>

              {/* TAB 1: Action Plan */}
              <div className={`tab-content fade-in ${activeTab !== "action" ? "hidden-screen" : ""}`}>
                {/* Top Fixes */}
                {data?.top_fixes?.length > 0 && (
                  <div className="top-fixes">
                    <h3>Priority Action Items</h3>
                    <div className="fix-cards">
                      {data.top_fixes.map((f, i) => (
                        <div className="fix-card" key={i}>
                          <div className="fix-icon">!</div>
                          <div className="fix-content">{f}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Breakdown */}
                {data?.breakdown && (
                  <div className="breakdown" style={{ marginTop: "24px" }}>
                    <h3>📊 Score Breakdown</h3>
                    <Bar label="Clarity" value={data.breakdown.clarity || 0} />
                    <Bar label="Impact" value={data.breakdown.impact || 0} />
                    <Bar label="Skills" value={data.breakdown.skills || 0} />
                    <Bar label="Structure" value={data.breakdown.structure || 0} />
                  </div>
                )}
              </div>

              {/* TAB 2: Keyword Matcher */}
              <div className={`tab-content fade-in ${activeTab !== "keywords" ? "hidden-screen" : ""}`}>
                {(data?.skills?.length > 0 || data?.matched_keywords?.length > 0 || data?.missing_keywords?.length > 0) ? (
                  <div className="skills-section" style={{ marginTop: 0 }}>
                    <h3 className="section-title">Skills Analysis</h3>
                    <div className="legend">
                      <span><span className="dot neutral" />Detected</span>
                      <span><span className="dot good" />Matched</span>
                      <span><span className="dot missing" />Missing</span>
                    </div>
                    
                    <h4 style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "16px", marginBottom: "8px" }}>Missing from your resume:</h4>
                    <div className="skills missing">
                      {Array.isArray(data.missing_keywords) && data.missing_keywords.length > 0 
                        ? data.missing_keywords.map((k, i) => <span key={i}>{k}</span>)
                        : <span style={{ background: "transparent", border: "none", padding: 0 }}>None</span>}
                    </div>

                    <h4 style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "16px", marginBottom: "8px" }}>Successfully matched:</h4>
                    <div className="skills good">
                      {Array.isArray(data.matched_keywords) && data.matched_keywords.length > 0
                        ? data.matched_keywords.map((k, i) => <span key={i}>{k}</span>)
                        : <span style={{ background: "transparent", border: "none", padding: 0 }}>None</span>}
                    </div>

                    <h4 style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "16px", marginBottom: "8px" }}>Other detected skills:</h4>
                    <div className="skills neutral">
                      {Array.isArray(data.skills) && data.skills.length > 0
                        ? data.skills.map((s, i) => typeof s === "string" && s.length < 25 ? <span key={i}>{s}</span> : null)
                        : <span style={{ background: "transparent", border: "none", padding: 0 }}>None</span>}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No skills data available.</p>
                )}
              </div>

              {/* TAB 3: Deep Review */}
              <div className={`tab-content fade-in ${activeTab !== "review" ? "hidden-screen" : ""}`}>
                {/* Feedback Sections */}
                <Section title="🔧 Improve This" items={data.improve || []} type="danger" className="" />
                <Section title="✅ What's Good" items={data.good || []} type="success" className="" />
                <Section title="⚠️ Missing Sections" items={data.missing || []} type="warn" className="" />

                {/* Rewrite */}
                {data.rewrite && (
                  <div className="rewrite">
                    <div className="rewrite-header">
                      <h3>✍️ AI Generated Summary</h3>
                      <button className="copy-btn" onClick={copyRewrite}>
                        {copied ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                    <p>{data.rewrite}</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ====== GENERATED RESUME RESULT ====== */}
        {data && mode === "build" && (
          <div className="generated-result fade-in" style={{ textAlign: "center" }}>
            <h2 className="gradient-text" style={{ fontSize: "32px", marginBottom: "16px" }}>Resume Generated Successfully! ✨</h2>
            <p className="hero-sub" style={{ marginBottom: "32px" }}>Your professional resume is ready to download.</p>
            
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', maxWidth: "500px", margin: "0 auto" }}>
              <button className="btn reset" onClick={() => setData(null)}>← Edit Info</button>
              <button className="btn cta-btn" onClick={() => window.print()}>📄 Download PDF Resume</button>
            </div>
            
            {/* The actual printable template (hidden via CSS until printed) */}
            <div className="resume-template printing">
              <h1>{name || "Your Name"}</h1>
              <div className="contact-info">{contact || "contact@email.com"}</div>
              
              {data.summary && (
                <>
                  <h2>Professional Summary</h2>
                  <p>{data.summary}</p>
                </>
              )}

              {data.experience && data.experience.length > 0 && (
                <>
                  <h2>Experience</h2>
                  {data.experience.map((exp, i) => (
                    <div className="job" key={i}>
                      <div className="job-header">
                        <span className="job-title">{exp.title} | {exp.company}</span>
                        <span className="job-dates">{exp.dates}</span>
                      </div>
                      {exp.bullets && exp.bullets.length > 0 && (
                        <ul>
                          {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </>
              )}

              {data.education && data.education.length > 0 && (
                <>
                  <h2>Education</h2>
                  {data.education.map((edu, i) => (
                    <div className="job" key={i}>
                      <div className="job-header">
                        <span className="job-title">{edu.degree} - {edu.school}</span>
                        <span className="job-dates">{edu.year}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {data.skills && data.skills.length > 0 && (
                <>
                  <h2>Skills</h2>
                  <div className="skills-list">
                    {data.skills.join(" • ")}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ===== Sub-components ===== */

function Section({ title, items = [], type, className = "" }) {
  if (!items.length) return null;
  return (
    <div className={`section ${type} fade-in ${className}`}>
      <h3>{title}</h3>
      <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  );
}

function Bar({ label, value = 0 }) {
  return (
    <div className="bar">
      <div className="bar-top">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="bar-bg">
        <div className="bar-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
