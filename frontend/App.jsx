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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);

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

  /* --- submit --- */
  const submit = async () => {
    if (!file) return alert("Upload a resume first");
    const fd = new FormData();
    fd.append("resume", file);
    fd.append("role", role);
    setLoading(true);
    setData(null);
    setStep(0);
    try {
      const res = await fetch("https://resumeai-yq3d.onrender.com/analyze", { method: "POST", body: fd });
      const result = await res.json();
      if (!result || typeof result !== "object") { alert("Invalid server response"); return; }
      setData(result);
    } catch (err) {
      console.error(err);
      alert("Server error");
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

        {/* ====== HERO (upload view) ====== */}
        {!data && (
          <div className="hero-main fade-in">
            <h1 className="gradient-text">Analyze Your Resume<br />in Seconds</h1>
            <p className="hero-sub">AI-powered feedback to boost your ATS score and land more interviews.</p>
            <div className="benefits">
              <div>Instant AI feedback</div>
              <div>ATS score analysis</div>
              <div>Actionable fixes</div>
            </div>
          </div>
        )}

        {/* ====== INPUT AREA ====== */}
        {!data && !loading && (
          <div className="input-area fade-in">
            <input
              className="role-input"
              placeholder="Target role (e.g. Frontend Developer)"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
            <div
              className={`upload ${dragging ? "dragging" : ""}`}
              onClick={() => document.getElementById("file").click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input id="file" type="file" accept=".pdf" hidden onChange={(e) => setFile(e.target.files[0])} />
              <span className="upload-icon">📄</span>
              <p>{file ? file.name : "Drop your resume here or click to browse"}</p>
              <p className="file-hint">PDF files only</p>
            </div>
            <button className="btn cta-btn" onClick={submit}>Analyze Resume →</button>
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
        {data && (
          <div className="results">

            {/* Score Gauge */}
            <div className="hero fade-in stagger-1">
              <div className="score-gauge">
                <svg viewBox="0 0 140 140">
                  <circle className="gauge-bg" cx="70" cy="70" r="66" />
                  <circle
                    className="gauge-fill"
                    cx="70" cy="70" r="66"
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
            </div>

            {/* Top Fixes */}
            {data?.top_fixes?.length > 0 && (
              <div className="top-fixes fade-in stagger-2">
                <h3>🔥 Top Fixes</h3>
                <ul>{data.top_fixes.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            )}

            {/* Skills */}
            {(data?.skills?.length > 0 || data?.matched_keywords?.length > 0 || data?.missing_keywords?.length > 0) && (
              <div className="skills-section fade-in stagger-3">
                <h3 className="section-title">Skills Analysis</h3>
                <div className="legend">
                  <span><span className="dot neutral" />Detected</span>
                  <span><span className="dot good" />Matched</span>
                  <span><span className="dot missing" />Missing</span>
                </div>
                {Array.isArray(data.skills) && (
                  <div className="skills neutral">
                    {data.skills.map((s, i) => typeof s === "string" && s.length < 25 ? <span key={i}>{s}</span> : null)}
                  </div>
                )}
                {Array.isArray(data.matched_keywords) && (
                  <div className="skills good">
                    {data.matched_keywords.map((k, i) => <span key={i}>{k}</span>)}
                  </div>
                )}
                {Array.isArray(data.missing_keywords) && (
                  <div className="skills missing">
                    {data.missing_keywords.map((k, i) => <span key={i}>{k}</span>)}
                  </div>
                )}
              </div>
            )}

            {/* Breakdown */}
            {data?.breakdown && (
              <div className="breakdown fade-in stagger-4">
                <h3>📊 Score Breakdown</h3>
                <Bar label="Clarity" value={data.breakdown.clarity || 0} />
                <Bar label="Impact" value={data.breakdown.impact || 0} />
                <Bar label="Skills" value={data.breakdown.skills || 0} />
                <Bar label="Structure" value={data.breakdown.structure || 0} />
              </div>
            )}

            {/* Feedback Sections */}
            <Section title="🔧 Improve This" items={data.improve || []} type="danger" className="stagger-5" />
            <Section title="✅ What's Good" items={data.good || []} type="success" className="stagger-6" />
            <Section title="⚠️ Missing" items={data.missing || []} type="warn" className="stagger-7" />

            {/* Rewrite */}
            {data.rewrite && (
              <div className="rewrite fade-in stagger-8">
                <div className="rewrite-header">
                  <h3>✍️ Better Summary</h3>
                  <button className="copy-btn" onClick={copyRewrite}>
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <p>{data.rewrite}</p>
              </div>
            )}

            <button className="btn reset fade-in stagger-9" onClick={() => { setData(null); setScore(0); setCopied(false); }}>
              ← Analyze Another Resume
            </button>
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
