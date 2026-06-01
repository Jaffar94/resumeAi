import React, { useState, useEffect, useCallback } from "react";
import "./styles.css";

const CIRCUMFERENCE = 2 * Math.PI * 66;
const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createExperience = () => ({ id: createId(), company: "", title: "", dates: "", description: "" });
const createEducation = () => ({ id: createId(), school: "", degree: "", dates: "", description: "" });
const createProject = () => ({ id: createId(), name: "", tech: "", description: "" });

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
  const [experiences, setExperiences] = useState(() => [createExperience()]);
  const [educations, setEducations] = useState(() => [createEducation()]);
  const [skills, setSkills] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");
  const [projects, setProjects] = useState(() => [createProject()]);
  const [parsing, setParsing] = useState(false);
  const [templateStyle, setTemplateStyle] = useState("classic");

  /* --- template detection based on job type --- */
  const detectTemplate = (jd = "", skillsText = "") => {
    const text = `${jd} ${skillsText}`.toLowerCase();

    const techKeywords = ['software', 'engineer', 'developer', 'frontend', 'backend', 'fullstack', 'full-stack', 'devops', 'data scientist', 'data engineer', 'machine learning', 'ml ', 'ai ', 'python', 'javascript', 'react', 'node', 'aws', 'cloud', 'kubernetes', 'docker', 'api', 'database', 'sql', 'programming', 'code', 'github', 'agile', 'scrum', 'sre', 'infrastructure', 'cybersecurity', 'security engineer', 'ios', 'android', 'mobile developer', 'qa engineer', 'test automation'];
    const executiveKeywords = ['sales', 'business development', 'account executive', 'vp ', 'vice president', 'director', 'chief', 'ceo', 'cfo', 'coo', 'cto', 'revenue', 'p&l', 'profit', 'portfolio', 'client relations', 'enterprise', 'b2b', 'quota', 'pipeline', 'territory', 'finance', 'investment', 'banking', 'wealth', 'fund', 'equity', 'mergers', 'acquisition', 'management', 'operations', 'strategy', 'executive'];
    const creativeKeywords = ['marketing', 'brand', 'content', 'social media', 'seo', 'sem', 'copywriter', 'copywriting', 'creative', 'design', 'graphic', 'ux', 'ui ', 'user experience', 'user interface', 'art director', 'photographer', 'videographer', 'media', 'public relations', 'pr ', 'communications', 'advertising', 'campaign', 'influencer', 'digital marketing', 'growth', 'community manager'];
    const minimalKeywords = ['consultant', 'consulting', 'legal', 'attorney', 'lawyer', 'paralegal', 'academic', 'professor', 'researcher', 'phd', 'postdoc', 'lecturer', 'analyst', 'policy', 'compliance', 'audit', 'regulatory', 'governance', 'risk', 'actuary', 'accountant', 'cpa', 'tax'];

    const countMatches = (keywords) => keywords.filter(kw => text.includes(kw)).length;

    const scores = {
      tech: countMatches(techKeywords),
      executive: countMatches(executiveKeywords),
      creative: countMatches(creativeKeywords),
      minimal: countMatches(minimalKeywords),
    };

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (best[1] >= 2) return best[0];
    return "classic";
  };



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
  const addExperience = () => setExperiences(prev => [createExperience(), ...prev]);
  const updateExperience = (id, field, val) => {
    setExperiences(prev => prev.map(exp => exp.id === id ? { ...exp, [field]: val } : exp));
  };
  const removeExperience = (id) => {
    setExperiences(prev => prev.map(exp => exp.id === id ? { ...exp, isRemoving: true } : exp));
    setTimeout(() => {
      setExperiences(prev => prev.filter(exp => exp.id !== id));
    }, 400);
  };

  const resetApp = () => {
    setFile(null);
    setData(null);
    setScore(0);
    setStep(0);
    setRole("");
    setJobDescription("");
    setFormStep(1);
    setName("");
    setContact("");
    setPhone("");
    setLocation("");
    setLinkedin("");
    setWebsite("");
    setSkills("");
    setExperiences([createExperience()]);
    setEducations([createEducation()]);
    setProjects([createProject()]);
    setTemplateStyle("classic");
  };

  const addEducation = () => setEducations(prev => [createEducation(), ...prev]);
  const updateEducation = (id, field, val) => {
    setEducations(prev => prev.map(edu => edu.id === id ? { ...edu, [field]: val } : edu));
  };
  const removeEducation = (id) => {
    setEducations(prev => prev.map(edu => edu.id === id ? { ...edu, isRemoving: true } : edu));
    setTimeout(() => {
      setEducations(prev => prev.filter(edu => edu.id !== id));
    }, 400);
  };

  const addProject = () => setProjects(prev => [createProject(), ...prev]);
  const updateProject = (id, field, val) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };
  const removeProject = (id) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isRemoving: true } : p));
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
      if (Array.isArray(result.experiences)) setExperiences(result.experiences.map(e => ({ ...e, id: createId() })));
      if (Array.isArray(result.educations)) setEducations(result.educations.map(e => ({ ...e, id: createId() })));
      if (Array.isArray(result.projects)) setProjects(result.projects.map(p => ({ ...p, id: createId() })));
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
    // Validation
    const hasExp = experiences.some(e => e.company.trim() || e.title.trim());
    if (!name.trim() || !hasExp) {
      setError("Please provide at least your Name and one Work Experience entry to generate a resume.");
      return;
    }

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

      // Hard Cap: Force 6 bullets max per role/project (Fixes AI verbosity)
      if (result.experience) {
        result.experience = result.experience.map(exp => ({
          ...exp,
          bullets: (exp.bullets || []).slice(0, 6)
        }));
      }
      if (result.projects) {
        result.projects = result.projects.map(proj => ({
          ...proj,
          bullets: (proj.bullets || []).slice(0, 6)
        }));
      }

      // Hard Cap: Force 10 skills max for an elite, uncluttered look
      if (result.skills) {
        result.skills = result.skills.slice(0, 10);
      }

      // Auto-detect template style based on job description + skills
      const detectedStyle = detectTemplate(jobDescription, skills);
      setTemplateStyle(detectedStyle);
      console.log(`🎨 Template detected: ${detectedStyle}`);

      setData(result);
    } catch (err) {
      console.error("❌ ERROR:", err.message);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* --- clean print via iframe (kills browser headers/footers completely but maintains margins) --- */
  const handlePrint = () => {
    const printEl = document.querySelector('.resume-template.printing') || document.querySelector('.analyzer-print-template.printing');
    if (!printEl) { window.print(); return; }

    // Detect which template class is on the element
    const templateClass = ['tech-template', 'executive-template', 'creative-template', 'minimal-template'].find(cls => printEl.classList.contains(cls)) || '';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<title> </title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap');

@page {
  size: A4;
  margin: 0;
}

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 210mm;
  background: white;
  color: #1a1a1a;
  font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-table {
  width: 100%;
  border-collapse: collapse;
  border: none;
}

.print-table td, .print-table th {
  border: none;
  padding: 0;
}

.page-header-space {
  height: 0.35in;
}

.page-footer-space {
  height: 0.35in;
}

.resume-content {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  padding: 0 0.7in;
  box-sizing: border-box;
}

.fit-one-page .resume-content {
  zoom: var(--fit-zoom, 1);
}

/* ===== HEADER ===== */
.resume-header {
  text-align: center;
  margin-bottom: 14pt;
  padding-bottom: 10pt;
  border-bottom: 2px solid #1a1a1a;
}

.resume-header h1 {
  font-family: 'Outfit', 'Inter', sans-serif;
  font-size: 22pt;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #000;
  margin-bottom: 6pt;
  line-height: 1.1;
}

.contact-line {
  font-size: 9.5pt;
  color: #333;
  margin-bottom: 2pt;
  line-height: 1.4;
}

.contact-line span {
  white-space: nowrap;
}

.contact-sep {
  margin: 0 5pt;
  color: #999;
}

/* ===== SECTIONS ===== */
.resume-section {
  margin-top: 12pt;
  break-inside: auto;
}

/* PAGE-BREAK ORPHAN FIX */
.resume-section h2 {
  font-family: 'Outfit', 'Inter', sans-serif;
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #000;
  border-bottom: 1.5px solid #000;
  padding-bottom: 2pt;
  margin-bottom: 8pt;
  break-after: avoid !important;
  page-break-after: avoid !important;
}

.section-keep-together {
  break-inside: auto !important;
  page-break-inside: auto !important;
}

.resume-section h2 + .job,
.resume-section h2 + .summary-text,
.resume-section h2 + .skills-grid {
  break-before: avoid !important;
  page-break-before: avoid !important;
}

.resume-section > p.summary-text {
  font-size: 10pt;
  line-height: 1.45;
  color: #222;
  margin-bottom: 4pt;
}

/* ===== JOB / ENTRY BLOCK ===== */
.job {
  margin-bottom: 10pt;
  page-break-inside: auto;
  break-inside: auto;
}

.job-header {
  display: table;
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
  margin-bottom: 3pt;
  page-break-inside: avoid;
  break-inside: avoid;
  page-break-after: avoid;
  break-after: avoid;
}

.job-title {
  display: table-cell;
  font-size: 10.5pt;
  font-weight: 700;
  color: #000;
  line-height: 1.25;
  vertical-align: top;
  text-align: left;
  padding-right: 15pt;
  overflow: hidden;
  word-break: break-word;
}

.job-dates {
  display: table-cell;
  font-size: 9.5pt;
  font-weight: 600;
  color: #444;
  white-space: nowrap;
  text-align: right;
  vertical-align: top;
  width: 130px;
  min-width: 100px;
}

.job ul {
  margin: 2pt 0 0 0;
  padding-left: 16pt;
}

.job li {
  font-size: 10pt;
  line-height: 1.4;
  margin-bottom: 2.5pt;
  color: #222;
  page-break-inside: avoid;
  break-inside: avoid;
}

.job li::marker {
  color: #555;
}

.edu-details {
  font-size: 9.5pt;
  font-style: italic;
  color: #444;
  margin-top: 2pt;
}

/* ===== SKILLS ===== */
.skills-section-print {
  page-break-inside: auto;
  break-inside: auto;
}

.skills-grid {
  display: block;
  margin-top: 2pt;
  font-size: 10pt;
  color: #222;
  line-height: 1.32;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.skill-chip {
  display: inline;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.skill-chip::after {
  content: " · ";
  color: #999;
}

.skill-chip:last-child::after {
  content: "";
}

.skill-category {
  display: block;
  width: 100%;
  margin-bottom: 2pt;
  line-height: 1.32;
  break-inside: auto;
  page-break-inside: auto;
}

/* ===== TEMPLATE: TECH ===== */
.tech-template .resume-header {
  text-align: left;
  border-bottom: 3px solid #2563eb;
  padding-bottom: 14px;
  margin-bottom: 16px;
}
.tech-template .resume-header h1 {
  color: #1e3a5f;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0;
  font-size: 22pt;
  text-transform: none;
}
.tech-template .resume-section h2 {
  color: #2563eb;
  border-bottom: 2px solid #2563eb;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.5px;
  font-size: 10.5pt;
}
.tech-template .skill-chip {
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2pt 6pt;
  border-radius: 3pt;
  margin-right: 4pt;
  margin-bottom: 4pt;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 9pt;
  display: inline-block;
  border: 0.5pt solid #bfdbfe;
}
.tech-template .skill-chip::after { content: ""; }
.tech-template .skills-grid { gap: 4pt; }
.tech-template .job-title { color: #1e3a5f; }

/* ===== TEMPLATE: EXECUTIVE ===== */
.executive-template .resume-header {
  text-align: center;
  border-bottom: 3px double #1a365d;
  padding-bottom: 16px;
  margin-bottom: 18px;
}
.executive-template .resume-header h1 {
  color: #1a365d;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 24pt;
  letter-spacing: 3px;
  font-weight: 700;
  text-transform: uppercase;
}
.executive-template .contact-line {
  font-size: 9.5pt;
  letter-spacing: 1px;
  color: #4a5568;
}
.executive-template .resume-section h2 {
  color: #1a365d;
  border-bottom: 1.5px solid #c6963c;
  font-family: 'Georgia', 'Times New Roman', serif;
  letter-spacing: 2px;
  font-size: 10.5pt;
  padding-bottom: 4px;
}
.executive-template .job-title { color: #1a365d; font-size: 10.5pt; }
.executive-template .job-dates { color: #744210; font-weight: 600; }

/* ===== TEMPLATE: CREATIVE ===== */
.creative-template .resume-content {
  border-left: 6px solid #7c3aed;
  padding-left: 0.9in;
}
.creative-template .resume-header {
  text-align: left;
  border-bottom: none;
  margin-bottom: 14px;
  padding-bottom: 10px;
}
.creative-template .resume-header h1 {
  color: #7c3aed;
  font-family: 'Outfit', sans-serif;
  font-size: 22pt;
  text-transform: none;
  letter-spacing: -0.5px;
  font-weight: 800;
}
.creative-template .resume-section h2 {
  color: #7c3aed;
  border-bottom: 2px solid #c4b5fd;
  font-family: 'Outfit', sans-serif;
  font-size: 10.5pt;
  letter-spacing: 1.5px;
}
.creative-template .job-title { color: #5b21b6; }
.creative-template .skill-chip {
  background: #f5f3ff;
  color: #6d28d9;
  padding: 2pt 8pt;
  border-radius: 12pt;
  margin-right: 4pt;
  margin-bottom: 4pt;
  font-size: 9pt;
  display: inline-block;
  border: 0.5pt solid #ddd6fe;
}
.creative-template .skill-chip::after { content: ""; }
.creative-template .skills-grid { gap: 4pt; }
.creative-template .summary-text {
  border-left: 3px solid #c4b5fd;
  padding-left: 10pt;
  font-style: italic;
}

/* ===== TEMPLATE: MINIMAL ===== */
.minimal-template .resume-content {
  padding: 0 0.85in;
}
.minimal-template .resume-header {
  text-align: left;
  border-bottom: 0.5px solid #d1d5db;
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.minimal-template .resume-header h1 {
  font-family: 'Inter', sans-serif;
  font-size: 20pt;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  color: #111;
}
.minimal-template .contact-line { color: #6b7280; font-size: 9pt; }
.minimal-template .resume-section { margin-top: 14pt; }
.minimal-template .resume-section h2 {
  color: #374151;
  border-bottom: 0.5px solid #e5e7eb;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 9.5pt;
  text-transform: uppercase;
  letter-spacing: 2px;
  padding-bottom: 4px;
}
.minimal-template .job-header { border-bottom: none; }
.minimal-template .job-title { font-weight: 600; color: #111; font-size: 10pt; }
.minimal-template .job-dates { color: #9ca3af; font-size: 9pt; }
.minimal-template .summary-text { font-size: 9.5pt; color: #4b5563; line-height: 1.6; }

/* ===== ANALYZER PRINT ===== */
.analyzer-content {
  padding: 0 0.7in;
}

.analyzer-content h1 {
  font-family: 'Outfit', sans-serif;
  font-size: 20pt;
  font-weight: 700;
  border-bottom: 2px solid #000;
  padding-bottom: 8pt;
  margin-bottom: 16pt;
}

.analyzer-content h2 {
  font-size: 13pt;
  font-weight: 700;
  border-bottom: 1px solid #ddd;
  padding-bottom: 4pt;
  margin-top: 18pt;
  margin-bottom: 8pt;
}

.analyzer-content p {
  font-size: 10pt;
  line-height: 1.5;
  margin-bottom: 8pt;
  color: #222;
}

.analyzer-content ul {
  padding-left: 18pt;
  margin-bottom: 10pt;
}

.analyzer-content li {
  font-size: 10pt;
  line-height: 1.5;
  margin-bottom: 4pt;
  color: #222;
}

.analyzer-content .meta-line {
  font-size: 10.5pt;
  margin: 3pt 0;
}

.analyzer-content .skills-box {
  padding: 10pt;
  border: 1px solid #ddd;
  border-radius: 3pt;
  margin-bottom: 10pt;
}

.analyzer-content .rewrite-box {
  font-style: italic;
  padding: 10pt;
  border-left: 3pt solid #555;
  margin-top: 6pt;
}
</style>
</head>
<body>
  <table class="print-table ${templateClass}">
    <thead>
      <tr><td><div class="page-header-space"></div></td></tr>
    </thead>
    <tbody>
      <tr><td>
        ${printEl.innerHTML}
      </td></tr>
    </tbody>
    <tfoot>
      <tr><td><div class="page-footer-space"></div></td></tr>
    </tfoot>
  </table>
</body>
</html>`);
    doc.close();

    const waitForPrintLayout = async () => {
      if (doc.fonts?.ready) {
        try {
          await doc.fonts.ready;
        } catch {
          // Continue with fallback fonts if web fonts fail to load.
        }
      }

      await new Promise(resolve => iframe.contentWindow.requestAnimationFrame(resolve));
      await new Promise(resolve => iframe.contentWindow.requestAnimationFrame(resolve));

      const table = doc.querySelector('.print-table');
      const resumeContent = doc.querySelector('.resume-content');
      const pageHeight = iframe.getBoundingClientRect().height || 1122;
      const contentHeight = table?.scrollHeight || doc.documentElement.scrollHeight;
      const headerFooterHeight =
        (doc.querySelector('.page-header-space')?.offsetHeight || 0) +
        (doc.querySelector('.page-footer-space')?.offsetHeight || 0);

      if (resumeContent && contentHeight > pageHeight && contentHeight <= pageHeight * 1.06) {
        const availableContentHeight = pageHeight - headerFooterHeight;
        const currentContentHeight = Math.max(1, contentHeight - headerFooterHeight);
        const zoom = Math.max(0.965, Math.min(0.995, availableContentHeight / currentContentHeight - 0.004));
        doc.body.style.setProperty('--fit-zoom', String(zoom));
        doc.body.classList.add('fit-one-page');
      }

      await new Promise(resolve => iframe.contentWindow.requestAnimationFrame(resolve));
    };

    setTimeout(async () => {
      await waitForPrintLayout();
      const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };

      iframe.contentWindow.addEventListener("afterprint", cleanup, { once: true });
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(cleanup, 3000);
    }, 500);
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
      <div className="orb-1" />
      <div className="orb-2" />
      <div className="orb-3" />
      <div className="orb-4" />
      <div className="glass">

        {/* ====== HERO ====== */}
        {!data && (
          <div className="hero-main fade-in">
            <h1 className="gradient-text">
              {mode === "analyze" ? "The AI Resume Auditor" : "The AI Resume Architect"}
            </h1>
            <p className="hero-sub">
              {mode === "analyze"
                ? "Get deep-analysis feedback, precision keyword scoring, and elite ATS optimization."
                : "Engineered for high-impact results. Turn your career history into a world-class resume."}
            </p>

            {!loading && (
              <div className="mode-toggle">
                <div className={`slider-pill ${mode === "build" ? "right" : ""}`} />
                <button className={`mode-btn ${mode === "analyze" ? "active" : ""}`} onClick={() => { setMode("analyze"); setError(""); }}>Analyzer</button>
                <button className={`mode-btn ${mode === "build" ? "active" : ""}`} onClick={() => { setMode("build"); setError(""); }}>Builder</button>
              </div>
            )}
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
                <button className="btn cta-btn" onClick={submit}>Analyze Resume</button>
              </>
            ) : (
              <div className="builder-wizard fade-in">
                {/* Step Indicator */}
                <div className="wizard-steps" style={{ "--wizard-progress": `${((formStep - 1) / 4) * 100}%` }}>
                  {[
                    { s: 1, label: "Profile" },
                    { s: 2, label: "Experience" },
                    { s: 3, label: "Education" },
                    { s: 4, label: "Projects" },
                    { s: 5, label: "Skills" }
                  ].map(step => (
                    <div 
                      key={step.s} 
                      className={`w-step ${formStep === step.s ? "active" : ""} ${formStep > step.s ? "completed" : ""}`}
                      onClick={() => setFormStep(step.s)}
                    >
                      <span className="step-num">{step.s}</span>
                      <span className="step-label">{step.label}</span>
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
                          "Autofill from existing Resume PDF"
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
                    <div className="section-header">
                      <h3>Professional Experience</h3>
                      <button className="add-btn" onClick={addExperience}>+ Add Professional Experience</button>
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
                    <div className="section-header">
                      <h3>Education</h3>
                      <button className="add-btn" onClick={addEducation}>+ Add Education Entry</button>
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
                    <div className="section-header">
                      <h3>Key Projects</h3>
                      <button className="add-btn" onClick={addProject}>+ Add New Project</button>
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
                    <button className="btn cta-btn" style={{ flex: 2 }} onClick={() => setFormStep(formStep + 1)}>Next Step</button>
                  ) : (
                    <button className="btn cta-btn" style={{ flex: 2 }} onClick={generate}>Generate Professional Resume</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== LOADING ====== */}
        {loading && (
          <div className="loading-box fade-in" style={{ textAlign: "center" }}>
            <style>{`
              .circular-loader {
                position: relative;
                width: 120px;
                height: 120px;
                margin: 0 auto 30px;
              }
              .loader-ring {
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 4px solid rgba(255,255,255,0.05);
                border-top-color: var(--accent);
                border-left-color: var(--accent-bright);
                will-change: transform;
                transform: translate3d(0, 0, 0);
                backface-visibility: hidden;
                perspective: 1000px;
                animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
              }
              .loader-core {
                position: absolute;
                inset: 12px;
                background: rgba(255,255,255,0.03);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                backdrop-filter: blur(8px);
                border: 1px solid var(--border-subtle);
                box-shadow: inset 0 0 20px rgba(255,255,255,0.02);
              }
              @keyframes spin {
                0% { transform: translate3d(0, 0, 0) rotate(0deg); }
                100% { transform: translate3d(0, 0, 0) rotate(360deg); }
              }
              .loading-text {
                font-family: "Outfit", sans-serif;
                font-size: 18px;
                font-weight: 500;
                background: linear-gradient(to right, #fff, var(--text-secondary));
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: pulse 2s infinite;
              }
              @keyframes pulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
              }
            `}</style>
            <div className="circular-loader">
              <div className="loader-ring"></div>
              <div className="loader-core">
                {mode === "analyze" ? "🔍" : "🏗️"}
              </div>
            </div>
            <p className="loading-text">
              {mode === "analyze"
                ? "AI Auditor is reviewing your career history..."
                : "AI Architect is engineering your final resume..."}
            </p>
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

                {data.detected_role && <p className="detected-role">{data.detected_role}</p>}

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
                  <button className="btn reset fade-in stagger-9" style={{ flex: 1, marginTop: 0 }} onClick={resetApp}>
                    🏠 Home
                  </button>
                  <button className="btn cta-btn fade-in stagger-9" style={{ flex: 1, marginTop: 0 }} onClick={handlePrint}>
                    📄 Save Report
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
                        ? data.skills.map((s, i) => {
                            const text = typeof s === "object" ? s.category : s;
                            return typeof text === "string" && text.length < 25 ? <span key={i}>{text}</span> : null;
                          })
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
              <p><strong>ℹ️ Other Detected Skills:</strong> {data.skills ? data.skills.map(s => typeof s === "object" ? s.category : s).join(", ") : "None"}</p>
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
              <p className="hero-sub" style={{ marginBottom: "20px", fontSize: "14px", opacity: 0.8 }}>
                <span style={{ color: "var(--accent)" }}>⚠️ Note:</span> AI has provided realistic estimates for metrics to optimize your impact. 
                Please review these points before finalizing.
              </p>

              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', maxWidth: "600px", margin: "32px auto 0" }}>
                <button className="btn reset" style={{ flex: 1 }} onClick={() => setData(null)}>← Edit Info</button>
                <button className="btn cta-btn" style={{ flex: 1 }} onClick={handlePrint}>📄 Download PDF</button>
                <button className="btn reset" style={{ flex: 1, background: "rgba(255,255,255,0.05)" }} onClick={resetApp}>🏠 Main Menu</button>
              </div>
            </div>

            {/* The actual printable template (hidden via CSS until printed) */}
            <div className={`resume-template printing ${templateStyle}-template`}>
              <div className="resume-content">
                <div className="resume-header">
                  <h1>{name || "Your Name"}</h1>
                  
                  <div className="contact-line">
                    {contact && <span>{contact}</span>}
                    {contact && phone && <span className="contact-sep">•</span>}
                    {phone && <span>{phone}</span>}
                    {(contact || phone) && location && <span className="contact-sep">•</span>}
                    {location && <span>{location}</span>}
                  </div>
                  
                  {(linkedin || website) && (
                    <div className="contact-line">
                      {linkedin && <span>{linkedin}</span>}
                      {linkedin && website && <span className="contact-sep">•</span>}
                      {website && <span>{website}</span>}
                    </div>
                  )}
                </div>

                {data.summary && (
                  <div className="resume-section">
                    <h2>Professional Summary</h2>
                    <p className="summary-text">{data.summary}</p>
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

                {data.projects && data.projects.length > 0 && data.projects.some(p => p.name && p.name.trim()) && (
                  <div className="resume-section">
                    <h2>Key Projects</h2>
                    {data.projects.filter(p => p.name && p.name.trim()).map((proj, i) => (
                      <div className="job" key={i}>
                        <div className="job-header">
                          <span className="job-title">{proj.name}</span>
                          <span className="job-dates">{proj.tech}</span>
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
                        {edu.details && <div className="edu-details">{edu.details}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {data.skills && data.skills.length > 0 && (
                  <div className="resume-section skills-section-print">
                    <h2>Skills & Expertise</h2>
                    <div className="skills-grid">
                      {data.skills.map((s, i) => {
                        if (typeof s === "object" && s.category) {
                          return (
                            <div key={i} className="skill-category">
                              <span style={{ fontWeight: 600, marginRight: "6px" }}>{s.category}:</span>
                              {s.items && s.items.map((item, j) => (
                                <div key={j} className="skill-chip">{item}</div>
                              ))}
                            </div>
                          );
                        }
                        return <div key={i} className="skill-chip">{s}</div>;
                      })}
                    </div>
                  </div>
                )}
              </div>
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
