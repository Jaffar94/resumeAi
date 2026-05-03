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
  
  // New Structured Builder State
  const [formStep, setFormStep] = useState(1);
  const [experiences, setExperiences] = useState([{ id: Date.now(), company: "", title: "", dates: "", description: "" }]);
  const [educations, setEducations] = useState([{ id: Date.now() + 1, school: "", degree: "", dates: "", description: "" }]);
  const [skills, setSkills] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  const [projects, setProjects] = useState([{ id: Date.now() + 2, name: "", tech: "", description: "" }]);
  const [parsing, setParsing] = useState(false);

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

  // Use environment variable for production
  const API_URL = import.meta.env.VITE_API_URL;

  /* --- builder helpers --- */
  const addExperience = () => setExperiences([{ id: Date.now(), company: "", title: "", dates: "", description: "" }, ...experiences]);
  const updateExperience = (id, field, val) => {
    setExperiences(experiences.map(exp => exp.id === id ? { ...exp, [field]: val } : exp));
  };
  const removeExperience = (id) => {
    setExperiences(experiences.map(exp => exp.id === id ? { ...exp, isRemoving: true } : exp));
    setTimeout(() => {
      setExperiences(prev => prev.filter(exp => exp.id !== id));
    }, 400);
  };

  const addEducation = () => setEducations([{ id: Date.now(), school: "", degree: "", dates: "", description: "" }, ...educations]);
  const updateEducation = (id, field, val) => {
    setEducations(educations.map(edu => edu.id === id ? { ...edu, [field]: val } : edu));
  };
  const removeEducation = (id) => {
    setEducations(educations.map(edu => edu.id === id ? { ...edu, isRemoving: true } : edu));
    setTimeout(() => {
      setEducations(prev => prev.filter(edu => edu.id !== id));
    }, 400);
  };

  const addProject = () => setProjects([{ id: Date.now(), name: "", tech: "", description: "" }, ...projects]);
  const updateProject = (id, field, val) => {
    setProjects(projects.map(p => p.id === id ? { ...p, [field]: val } : p));
  };
  const removeProject = (id) => {
    setProjects(projects.map(p => p.id === id ? { ...p, isRemoving: true } : p));
    setTimeout(() => {
      setProjects(prev => prev.filter(p => p.id !== id));
    }, 400);
  };

  /* --- pre-fill logic --- */
  const handlePreFill = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setParsing(true);
    setError("");
    const fd = new FormData();
    fd.append("resume", file);

    try {
      const res = await fetch(`${API_URL}/parse`, { method: "POST", body: fd });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      
      if (result.name) setName(result.name);
      if (result.email) setContact(result.email);
      if (result.phone) setPhone(result.phone);
      if (result.location) setLocation(result.location);
      if (result.linkedin) setLinkedin(result.linkedin);
      if (result.website) setWebsite(result.website);
      if (result.experiences) setExperiences(result.experiences.map(e => ({ ...e, id: Math.random() })));
      if (result.educations) setEducations(result.educations.map(e => ({ ...e, id: Math.random() })));
      if (result.projects) setProjects(result.projects.map(p => ({ ...p, id: Math.random() })));
      if (result.skills) setSkills(result.skills);
      
    } catch (err) {
      console.error("❌ Pre-fill failed:", err);
      setError("Failed to parse resume. You can still fill the form manually.");
    } finally {
      setParsing(false);
    }
  };

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
    setLoading(true);
    setError("");
    setData(null);
    setStep(0);
    try {
      const payload = {
        name,
        email: contact,
        phone,
        location,
        linkedin,
        website,
        jobDescription,
        experiences,
        educations,
        projects,
        skills
      };
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (err) {
      console.error("❌ ERROR:", err.message);
      setError(err.message || "Something went wrong. Please try again.");
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
              <div className="builder-wizard fade-in">
                {/* Step Indicator */}
                <div className="wizard-steps">
                  {[1, 2, 3, 4, 5].map(s => (
                    <div key={s} className={`w-step ${formStep >= s ? "active" : ""}`}>
                      {s === 1 ? "👤" : s === 2 ? "💼" : s === 3 ? "🎓" : s === 4 ? "🚀" : "🛠️"}
                    </div>
                  ))}
                </div>

                {/* STEP 1: Personal Info */}
                {formStep === 1 && (
                  <div className="form-section fade-in">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                      <h3 style={{ margin: 0 }}>Contact Information</h3>
                      <label className="prefill-btn">
                        {parsing ? (
                          <>
                            <div className="spinner"></div>
                            Parsing...
                          </>
                        ) : (
                          "⚡ Pre-fill from old Resume"
                        )}
                        <input type="file" accept=".pdf" hidden onChange={handlePreFill} disabled={parsing} />
                      </label>
                    </div>
                    <div className="form-grid">
                      <input className="role-input" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
                      <input className="role-input" placeholder="Email Address" value={contact} onChange={(e) => setContact(e.target.value)} />
                      <input className="role-input" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      <input className="role-input" placeholder="Location (City, Country)" value={location} onChange={(e) => setLocation(e.target.value)} />
                      <input className="role-input" placeholder="LinkedIn URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                      <input className="role-input" placeholder="Portfolio/Website URL" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>
                    <textarea className="jd-input" style={{ minHeight: "100px", marginTop: "12px" }} placeholder="Target Job Description (Optional - helps AI tailor your resume)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                  </div>
                )}

                {/* STEP 2: Experience */}
                {formStep === 2 && (
                  <div className="form-section fade-in">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3>Professional Experience</h3>
                      <button className="btn reset" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={addExperience}>+ Add Job</button>
                    </div>
                    {experiences.map((exp) => (
                      <div key={exp.id} className={`form-card ${exp.isRemoving ? "removing" : ""}`}>
                        <div className="form-grid">
                          <input className="role-input" placeholder="Company" value={exp.company} onChange={(e) => updateExperience(exp.id, "company", e.target.value)} />
                          <input className="role-input" placeholder="Job Title" value={exp.title} onChange={(e) => updateExperience(exp.id, "title", e.target.value)} />
                          <input className="role-input" placeholder="Dates (e.g. 2021 - Present)" value={exp.dates} onChange={(e) => updateExperience(exp.id, "dates", e.target.value)} />
                        </div>
                        <textarea className="jd-input" style={{ minHeight: "80px", marginTop: "10px" }} placeholder="What did you do there? (Bullet points or a quick summary)" value={exp.description} onChange={(e) => updateExperience(exp.id, "description", e.target.value)} />
                        {experiences.length > 1 && <button className="remove-btn" onClick={() => removeExperience(exp.id)}>Remove</button>}
                      </div>
                    ))}
                  </div>
                )}

                {/* STEP 3: Education */}
                {formStep === 3 && (
                  <div className="form-section fade-in">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3>Education</h3>
                      <button className="btn reset" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={addEducation}>+ Add Education</button>
                    </div>
                    {educations.map((edu) => (
                      <div key={edu.id} className={`form-card ${edu.isRemoving ? "removing" : ""}`}>
                        <div className="form-grid">
                          <input className="role-input" placeholder="School/University" value={edu.school} onChange={(e) => updateEducation(edu.id, "school", e.target.value)} />
                          <input className="role-input" placeholder="Degree (e.g. B.S. in CS)" value={edu.degree} onChange={(e) => updateEducation(edu.id, "degree", e.target.value)} />
                          <input className="role-input" placeholder="Dates (e.g. 2020 - 2024)" value={edu.dates} onChange={(e) => updateEducation(edu.id, "dates", e.target.value)} />
                        </div>
                        <textarea className="jd-input" style={{ minHeight: "80px", marginTop: "10px" }} placeholder="Relevant coursework, honors, activities (e.g. Dean's List, Secretary of Robotics Club)..." value={edu.description} onChange={(e) => updateEducation(edu.id, "description", e.target.value)} />
                        {educations.length > 1 && <button className="remove-btn" onClick={() => removeEducation(edu.id)}>Remove</button>}
                      </div>
                    ))}
                  </div>
                )}

                {/* STEP 4: Projects */}
                {formStep === 4 && (
                  <div className="form-section fade-in">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3>Key Projects</h3>
                      <button className="btn reset" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={addProject}>+ Add Project</button>
                    </div>
                    {projects.map((proj) => (
                      <div key={proj.id} className={`form-card ${proj.isRemoving ? "removing" : ""}`}>
                        <div className="form-grid">
                          <input className="role-input" placeholder="Project Name" value={proj.name} onChange={(e) => updateProject(proj.id, "name", e.target.value)} />
                          <input className="role-input" placeholder="Technologies (e.g. React, Node.js)" value={proj.tech} onChange={(e) => updateProject(proj.id, "tech", e.target.value)} />
                        </div>
                        <textarea className="jd-input" style={{ minHeight: "80px", marginTop: "10px" }} placeholder="Describe the project and your impact..." value={proj.description} onChange={(e) => updateProject(proj.id, "description", e.target.value)} />
                        {projects.length > 1 && <button className="remove-btn" onClick={() => removeProject(proj.id)}>Remove</button>}
                      </div>
                    ))}
                  </div>
                )}

                {/* STEP 5: Skills */}
                {formStep === 5 && (
                  <div className="form-section fade-in">
                    <h3>Skills & Extras</h3>
                    <p className="file-hint" style={{ marginBottom: "10px" }}>List your core skills, certifications, or any other notes you want the AI to include.</p>
                    <textarea className="jd-input" style={{ minHeight: "200px" }} placeholder="e.g. React, Node.js, Project Management, AWS Certified..." value={skills} onChange={(e) => setSkills(e.target.value)} />
                  </div>
                )}

                {/* Navigation */}
                <div className="wizard-nav" style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  {formStep > 1 && <button className="btn reset" style={{ flex: 1 }} onClick={() => setFormStep(formStep - 1)}>Back</button>}
                  {formStep < 5 ? (
                    <button className="btn cta-btn" style={{ flex: 2 }} onClick={() => setFormStep(formStep + 1)}>Next Step →</button>
                  ) : (
                    <button className="btn cta-btn" style={{ flex: 2 }} onClick={generate}>✨ Generate Professional Resume →</button>
                  )}
                </div>
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

        {/* ====== ANALYZER PRINT TEMPLATE ====== */}
        {data && mode === "analyze" && (
          <div className="analyzer-print-template printing">
            <div className="print-header">
              <h1>Resume Analysis Report</h1>
              <p><strong>Target Role:</strong> {data.detected_role || "Not specified"}</p>
              <p><strong>ATS Compatibility Score:</strong> {data.ats_score || score}%</p>
            </div>

            <h2>Overall Assessment</h2>
            <p>{data.summary}</p>

            {data.top_fixes?.length > 0 && (
              <>
                <h2>Priority Action Items</h2>
                <ul className="print-list">
                  {data.top_fixes.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </>
            )}

            <h2>Skills Analysis</h2>
            <div className="print-skills">
              <p><strong>✅ Matched Keywords:</strong> {data.matched_keywords?.join(", ") || "None"}</p>
              <p><strong>⚠️ Missing Keywords:</strong> {data.missing_keywords?.join(", ") || "None"}</p>
              <p><strong>ℹ️ Other Detected Skills:</strong> {data.skills?.join(", ") || "None"}</p>
            </div>

            {data.improve?.length > 0 && (
              <>
                <h2>Detailed Feedback: Areas for Improvement</h2>
                <ul className="print-list">
                  {data.improve.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </>
            )}

            {data.good?.length > 0 && (
              <>
                <h2>Detailed Feedback: Strengths</h2>
                <ul className="print-list">
                  {data.good.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </>
            )}

            {data.rewrite && (
              <>
                <h2>AI Suggested Summary Rewrite</h2>
                <p className="rewrite-text">{data.rewrite}</p>
              </>
            )}
          </div>
        )}

        {/* ====== GENERATED RESUME RESULT ====== */}
        {data && mode === "build" && (
          <>
            <div className="generated-result fade-in" style={{ textAlign: "center" }}>
              <h2 className="gradient-text" style={{ fontSize: "32px", marginBottom: "16px" }}>Resume Generated Successfully! ✨</h2>
              <p className="hero-sub" style={{ marginBottom: "32px" }}>Your professional resume is ready to download.</p>
              
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', maxWidth: "500px", margin: "0 auto" }}>
                <button className="btn reset" onClick={() => setData(null)}>← Edit Info</button>
                <button className="btn cta-btn" onClick={() => window.print()}>📄 Download PDF Resume</button>
              </div>
            </div>
            
            {/* The actual printable template (hidden via CSS until printed) */}
            <div className="resume-template printing">
              <table>
                <thead>
                  <tr><td><div className="print-margin-top"></div></td></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="resume-header">
                <h1>{name || "Your Name"}</h1>
                <div className="contact-line">
                  {contact && <span>{contact}</span>}
                  {phone && <span> | {phone}</span>}
                  {location && <span> | {location}</span>}
                </div>
                <div className="contact-line">
                  {linkedin && <span>LinkedIn: {linkedin}</span>}
                  {website && <span> | Portfolio: {website}</span>}
                </div>
              </div>
              
              {data.summary && (
                <div className="resume-section">
                  <h2>Professional Summary</h2>
                  <p>{data.summary}</p>
                </div>
              )}

              {data.experience && data.experience.length > 0 && (
                <div className="resume-section">
                  <h2>Professional Experience</h2>
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
                </div>
              )}

              {data.projects && data.projects.length > 0 && (
                <div className="resume-section">
                  <h2>Key Projects</h2>
                  {data.projects.map((proj, i) => (
                    <div className="job" key={i}>
                      <div className="job-header">
                        <span className="job-title">{proj.name}</span>
                        <span className="job-dates" style={{ fontStyle: 'italic', fontWeight: 400 }}>{proj.tech}</span>
                      </div>
                      {proj.bullets && proj.bullets.length > 0 && (
                        <ul>
                          {proj.bullets.map((b, j) => <li key={j}>{b}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {data.education && data.education.length > 0 && (
                <div className="resume-section">
                  <h2>Education</h2>
                  {data.education.map((edu, i) => (
                    <div className="job" key={i}>
                      <div className="job-header">
                        <span className="job-title">{edu.degree} - {edu.school}</span>
                        <span className="job-dates">{edu.dates}</span>
                      </div>
                      {edu.details && <p style={{ fontSize: '10pt', marginTop: '2px', fontStyle: 'italic' }}>{edu.details}</p>}
                    </div>
                  ))}
                </div>
              )}

              {data.skills && data.skills.length > 0 && (
                <div className="resume-section">
                  <h2>Skills & Expertise</h2>
                  <div className="skills-list">
                    {data.skills.join(" • ")}
                  </div>
                </div>
              )}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr><td><div className="print-margin-bottom"></div></td></tr>
                </tfoot>
              </table>
            </div>
          </>
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
