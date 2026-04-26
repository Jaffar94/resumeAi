import React, { useState, useEffect } from "react";
import "./styles.css";

export default function App() {
  const [file, setFile] = useState(null);
  const [role, setRole] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [step, setStep] = useState(0);

  const steps = [
    "Reading your resume...",
    "Detecting skills...",
    "Checking clarity...",
    "Evaluating impact..."
  ];

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 900);
    return () => clearInterval(t);
  }, [loading]);

  const getScoreColor = (s) => {
    if (s >= 80) return "#22c55e";
    if (s >= 60) return "#f59e0b";
    return "#ef4444";
  };

  const getScoreLabel = (s) => {
    if (s >= 80) return "Strong Resume ✅";
    if (s >= 60) return "Needs Improvement ⚠️";
    return "Weak Resume ❌";
  };

  const submit = async () => {
    if (!file) return alert("Upload resume");

    const fd = new FormData();
    fd.append("resume", file);
    fd.append("role", role);

    setLoading(true);
    setData(null);

    try {
      const res = await fetch("https://resumeai-yq3d.onrender.com/analyze", {
        method: "POST",
        body: fd,
      });

      const result = await res.json();
      console.log("API RESULT:", result);

      if (!result || typeof result !== "object") {
        alert("Invalid server response");
        return;
      }

      setData(result);
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data?.score) return;

    let i = 0;
    const interval = setInterval(() => {
      i += 2;
      if (i >= data.score) {
        i = data.score;
        clearInterval(interval);
      }
      setScore(i);
    }, 15);

    return () => clearInterval(interval);
  }, [data]);

  return (
    <div className="app">
      <div className="glass">

        {!data && (
          <div className="hero-main fade-in">
            <h1 className="gradient-text">
              Fix Your Resume <br /> in Seconds
            </h1>
            <p className="hero-sub">
              Get simple, clear feedback to improve your resume.
            </p>
            <div className="benefits">
              <div>✔ Instant AI feedback</div>
              <div>✔ Easy to understand</div>
              <div>✔ Improve faster</div>
            </div>
          </div>
        )}

        {!data && !loading && (
          <div className="input-area">
            <input
              className="role-input"
              placeholder="Target role (e.g. Frontend Developer)"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />

            <div
              className="upload"
              onClick={() => document.getElementById("file").click()}
            >
              <input
                id="file"
                type="file"
                accept=".pdf"
                hidden
                onChange={(e) => setFile(e.target.files[0])}
              />
              <p>{file ? file.name : "Click to upload resume (PDF)"}</p>
            </div>

            <button className="btn cta-btn" onClick={submit}>
              Analyze Resume
            </button>
          </div>
        )}

        {loading && (
          <div className="loading-box">
            <div className="spinner"></div>
            <p className="loading-text">{steps[step]}</p>
          </div>
        )}

        {data && (
          <div className="results fade-in">

            <div className="hero">
              <div className="score" style={{ color: getScoreColor(score) }}>
                {score}
              </div>

              {data.ats_score !== undefined && (
                <div className="ats-box">
                  <p className="ats-title">ATS Match</p>
                  <div className="ats-bar">
                    <div
                      className="ats-fill"
                      style={{ width: `${data.ats_score || 0}%` }}
                    ></div>
                  </div>
                  <p className="ats-score">{data.ats_score || 0}% match</p>
                </div>
              )}

              <p className="score-label">{getScoreLabel(score)}</p>

              {data.detected_role && (
                <p className="detected-role">
                  Role: {data.detected_role}
                </p>
              )}

              <p className="summary">{data.summary || ""}</p>
            </div>

            {data?.top_fixes?.length > 0 && (
              <div className="top-fixes">
                <h3>Top Fixes</h3>
                <ul>
                  {data.top_fixes.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* SKILLS */}
            {(data?.skills?.length > 0 ||
              data?.matched_keywords?.length > 0 ||
              data?.missing_keywords?.length > 0) && (

              <div className="skills-section">

                <h3 className="section-title">Skills</h3>

                <div className="legend">
                  <span><span className="dot neutral"></span>Detected</span>
                  <span><span className="dot good"></span>Matched</span>
                  <span><span className="dot missing"></span>Missing</span>
                </div>

                {Array.isArray(data.skills) && (
                  <div className="skills neutral">
                    {data.skills.map((s, i) =>
                      typeof s === "string" && s.length < 25 ? (
                        <span key={i}>{s}</span>
                      ) : null
                    )}
                  </div>
                )}

                {Array.isArray(data.matched_keywords) && (
                  <div className="skills good">
                    {data.matched_keywords.map((k, i) => (
                      <span key={i}>{k}</span>
                    ))}
                  </div>
                )}

                {Array.isArray(data.missing_keywords) && (
                  <div className="skills missing">
                    {data.missing_keywords.map((k, i) => (
                      <span key={i}>{k}</span>
                    ))}
                  </div>
                )}

              </div>
            )}

            {data?.breakdown && (
              <div className="breakdown">
                <Bar label="Clarity" value={data.breakdown?.clarity || 0} />
                <Bar label="Impact" value={data.breakdown?.impact || 0} />
                <Bar label="Skills" value={data.breakdown?.skills || 0} />
                <Bar label="Structure" value={data.breakdown?.structure || 0} />
              </div>
            )}

            <Section title="Improve This" items={data.improve || []} type="danger" />
            <Section title="What’s Good" items={data.good || []} type="success" />
            <Section title="Missing" items={data.missing || []} type="warn" />

            <div className="rewrite">
              <h3>Better Summary</h3>
              <p>{data.rewrite || ""}</p>
            </div>

            <button className="btn reset" onClick={() => setData(null)}>
              Analyze Another
            </button>

          </div>
        )}

      </div>
    </div>
  );
}

function Section({ title, items = [], type }) {
  return (
    <div className={`section ${type}`}>
      <h3>{title}</h3>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Bar({ label, value = 0 }) {
  return (
    <div className="bar">
      <div className="bar-top">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="bar-bg">
        <div className="bar-fill" style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}
