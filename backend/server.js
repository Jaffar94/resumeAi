import express from "express";
import multer from "multer";
import pdf from "pdf-parse";
import fs from "fs";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

/* ---------- CLEAN TEXT ---------- */
function cleanText(text = "") {
  return text
    .replace(/[#*`]/g, "") // Remove markdown-like symbols
    .replace(/[^\x20-\x7E\n]/g, "") // Keep only printable ASCII and newlines (strips weird symbols)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- SHARED PROMPT ---------- */
function buildPrompt(resumeText, role, jobDescription) {
  let jdSection = "";
  if (jobDescription) {
    jdSection = `\n\nJOB DESCRIPTION TO MATCH AGAINST:\n"${jobDescription}"\n\nCRITICAL: You must heavily weigh the resume against this job description. If the resume misses core skills or requirements from this JD, penalize the score and list them in 'missing_keywords'. Use the JD to drive your 'top_fixes'.`;
  }

  return `You are an elite Executive Recruiter and Career Coach with 20+ years of experience placing candidates at top-tier companies like Google, Meta, and high-growth startups. Your goal is to provide a comprehensive, supportive, yet highly objective analysis of this resume.

TARGET: "${role || "Infer from content"}"${jdSection}

DIRECTIVES:
1. SCORE AS GATEKEEPER: Be brutally objective. achieve 90+ only for elite, metric-heavy resumes.
2. 6-SECOND RULE: Weigh Professional Summary + first 2 roles (60% weight).
3. QUANTIFIED IMPACT: Strictly penalize bullets without metrics (%, $, #).
4. JD ALIGNMENT: Penalize missing core keywords if JD is provided.
5. FORMAT: Return ONLY valid JSON.

JSON SCHEMA:
{
  "ats_score": 0-100,
  "score": 0-100,
  "detected_role": "Title",
  "level": "Entry-Executive",
  "summary": "2-3 sentence overview + #1 critical fix",
  "top_fixes": ["Action+Context+Reason", "...", "..."],
  "breakdown": {"clarity": 0-100, "impact": 0-100, "skills": 0-100, "structure": 0-100},
  "skills": ["Tool1", "..."],
  "matched_keywords": ["KW1", "..."],
  "missing_keywords": ["KW1", "..."],
  "good": ["Highlight1", "..."],
  "improve": ["Fix1", "..."],
  "missing": ["Section1", "..."],
  "rewrite": "30-60 word copy-paste Summary"
}

RESUME:
${resumeText}`;
}

/* ---------- PARSE AI RESPONSE ---------- */
function parseResponse(text) {
  text = text.trim().replace(/```json|```/g, "");
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in response");
    return JSON.parse(match[0]);
  }
}

/* ---------- SANITIZE RESULT ---------- */
function sanitize(parsed) {
  return {
    ats_score: parsed.ats_score ?? 0,
    matched_keywords: Array.isArray(parsed.matched_keywords) ? parsed.matched_keywords.slice(0, 10) : [],
    score: parsed.score ?? 0,
    summary: cleanText(parsed.summary ?? ""),
    detected_role: parsed.detected_role ?? "Unknown",
    level: parsed.level ?? "Intermediate",
    top_fixes: Array.isArray(parsed.top_fixes) ? parsed.top_fixes.map(cleanText) : [],
    skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 10) : [],
    missing_keywords: Array.isArray(parsed.missing_keywords) ? parsed.missing_keywords.slice(0, 10) : [],
    breakdown: {
      clarity: parsed.breakdown?.clarity ?? 0,
      impact: parsed.breakdown?.impact ?? 0,
      skills: parsed.breakdown?.skills ?? 0,
      structure: parsed.breakdown?.structure ?? 0,
    },
    good: (parsed.good || []).map(cleanText),
    improve: (parsed.improve || []).map(cleanText),
    missing: (parsed.missing || []).map(cleanText),
    rewrite: cleanText(parsed.rewrite ?? ""),
  };
}

/* ---------- FETCH WITH TIMEOUT ---------- */
async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError" || err.message?.includes("aborted")) {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  }
}

/* ---------- AI PROVIDER HELPERS ---------- */
async function fetchGemini(model, prompt) {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
    8000
  );
  const raw = await res.json();
  if (res.status !== 200 || raw?.error) {
    throw new Error(raw?.error?.message || `HTTP ${res.status}`);
  }
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Empty response");
  return parseResponse(text);
}

async function fetchGroq(model, prompt) {
  const res = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    },
    8000
  );
  const raw = await res.json();
  if (res.status !== 200 || raw?.error) {
    throw new Error(raw?.error?.message || `HTTP ${res.status}`);
  }
  const text = raw?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Empty response");
  return parseResponse(text);
}

/* ---------- UNIFIED AI QUEUE ---------- */
async function callAIQueue(prompt) {
  const priorityQueue = [
    { provider: "groq",   id: "openai/gpt-oss-120b" },
    { provider: "groq",   id: "qwen/qwen3.6-27b" },
    { provider: "gemini", id: "gemini-2.5-flash" },
    { provider: "gemini", id: "gemini-2.5-pro" },
    { provider: "groq",   id: "openai/gpt-oss-20b" },
    { provider: "gemini", id: "gemini-2.5-flash-lite" },
    { provider: "groq",   id: "qwen/qwen3.8-27b" },
  ];

  for (const { provider, id } of priorityQueue) {
    console.log(`📡 Trying ${provider.toUpperCase()}: ${id}...`);
    try {
      let parsed = null;
      if (provider === "gemini") {
        parsed = await fetchGemini(id, prompt);
      } else if (provider === "groq") {
        parsed = await fetchGroq(id, prompt);
      }
      if (parsed) {
        console.log(`✅ Success with ${id}`);
        return parsed;
      }
    } catch (err) {
      console.log(`⚠️ Failed ${id}: ${err.message}`);
    }
  }
  throw new Error("All AI providers in the priority queue failed");
}

/* ---------- MAIN ANALYZE FUNCTION ---------- */
async function analyzeResume(resumeText, role, jobDescription) {
  const prompt = buildPrompt(resumeText, role, jobDescription);
  const parsed = await callAIQueue(prompt);
  const result = sanitize(parsed);
  console.log("✅ FINAL ANALYZE:", result);
  return result;
}

/* ---------- GENERATOR PROMPT ---------- */
function buildGeneratorPrompt(formData) {
  const { name, email, phone, location, linkedin, website, jobDescription, experiences, educations, projects, skills } = formData;
  
  const hasExperience = experiences && experiences.length > 0 && experiences[0].company;

  return `You are a FAANG-level Executive Resume Architect. Engineer a 90+ ATS resume from the data below.

${!hasExperience ? "STRICT: Transform academic work into professional 'Experience'." : ""}

DATA:
Name: ${name || ""}
Email: ${email || ""}
Phone: ${phone || ""}
Location: ${location || ""}
LinkedIn: ${linkedin || ""}
Website: ${website || ""}
Target Job Description: ${jobDescription || ""}

    Experiences:
${JSON.stringify(experiences || [], null, 2)}

Educations:
${JSON.stringify(educations || [], null, 2)}

Projects:
${JSON.stringify(projects || [], null, 2)}

Skills:
${Array.isArray(skills) ? skills.join(", ") : (skills || "")}

DIRECTIVES:
1. ACCURATE EXPERIENCE & PLAUSIBLE METRICS: Base all experience and project bullets on the user's input. You MUST add at least one highly generic, plausible metric (%, $, #) to EVERY bullet point to maximize the ATS score. However, ensure it is a common baseline metric for the role (e.g., "improved efficiency by 15%", "collaborated with 5+ cross-functional team members") and do NOT fabricate highly specific or improbable data. Do NOT invent new job titles, companies, or entirely fake duties.
2. STRICT EDUCATION RULE: DO NOT invent, hallucinate, or estimate any details, GPA, honors, or awards for the Education section. ONLY use the exact information provided in the input.
3. STAR METHOD: Focus bullets on Situation/Task, Action, and measurable Result.
4. KEYWORDS: Integrate crucial keywords from the target job description if provided.
5. SKILLS CATEGORIZATION: Group skills into logical categories (e.g., "Programming Languages", "Frameworks & Libraries", "Tools & Platforms", "Core Competencies").
6. NO PLACEHOLDERS: Generate complete, professional bullet points.
7. Return ONLY valid JSON matching the schema below.

JSON SCHEMA:
{
  "summary": "30-60 word professional summary",
  "experience": [
    {
      "title": "Role Title",
      "company": "Company Name",
      "dates": "Dates",
      "bullets": ["Action verb + Context + Measurable Result (%, $, or #)", "..."]
    }
  ],
  "education": [
    {
      "degree": "Degree",
      "school": "School Name",
      "dates": "Dates",
      "details": "Only include details if provided in the input"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "tech": "Tech Stack used",
      "bullets": ["What you built + metrics/results", "..."]
    }
  ],
  "skills": [
    {
      "category": "Category Name (e.g., Programming Languages)",
      "items": ["Skill1", "Skill2"]
    }
  ]
}
`;
}
/* ---------- CLEAN DESCRIPTION (Preserve Newlines) ---------- */
function cleanDescription(text = "") {
  return text
    .replace(/[#*`]/g, "") // Remove markdown tags
    .replace(/[^\x20-\x7E\n]/g, "") // Keep only printable ASCII and newlines
    .replace(/[^\S\r\n]+/g, " ") // Clean multiple spaces but keep newlines
    .trim();
}

/* ---------- DEFENSIVE SANITIZERS ---------- */
function sanitizeParsedForm(parsed = {}) {
  const experiences = Array.isArray(parsed.experiences || parsed.experience) 
    ? (parsed.experiences || parsed.experience) 
    : [];
  const educations = Array.isArray(parsed.educations || parsed.education) 
    ? (parsed.educations || parsed.education) 
    : [];
  const projects = Array.isArray(parsed.projects || parsed.project) 
    ? (parsed.projects || parsed.project) 
    : [];

  return {
    name: cleanText(parsed.name || ""),
    email: cleanText(parsed.email || parsed.contact || ""),
    phone: cleanText(parsed.phone || ""),
    location: cleanText(parsed.location || ""),
    linkedin: cleanText(parsed.linkedin || ""),
    website: cleanText(parsed.website || ""),
    experiences: experiences.map(exp => ({
      company: cleanText(exp.company || ""),
      title: cleanText(exp.title || ""),
      dates: cleanText(exp.dates || ""),
      description: cleanDescription(exp.description || "")
    })),
    educations: educations.map(edu => ({
      school: cleanText(edu.school || ""),
      degree: cleanText(edu.degree || ""),
      dates: cleanText(edu.dates || ""),
      description: cleanDescription(edu.description || "")
    })),
    projects: projects.map(proj => ({
      name: cleanText(proj.name || ""),
      tech: cleanText(proj.tech || ""),
      description: cleanDescription(proj.description || "")
    })),
    skills: typeof parsed.skills === "string" 
      ? cleanText(parsed.skills) 
      : (Array.isArray(parsed.skills) ? parsed.skills.join(", ") : "")
  };
}

function sanitizeGenerated(parsed = {}) {
  const expList = parsed.experience || parsed.experiences || [];
  const normalizedExp = (Array.isArray(expList) ? expList : []).map(exp => ({
    title: exp.title || "",
    company: exp.company || "",
    dates: exp.dates || "",
    bullets: Array.isArray(exp.bullets) ? exp.bullets.map(cleanText) : []
  }));

  const eduList = parsed.education || parsed.educations || [];
  const normalizedEdu = (Array.isArray(eduList) ? eduList : []).map(edu => ({
    degree: edu.degree || "",
    school: edu.school || "",
    dates: edu.dates || "",
    details: cleanText(edu.details || edu.description || "")
  }));

  const projList = parsed.projects || parsed.project || [];
  const normalizedProj = (Array.isArray(projList) ? projList : []).map(proj => ({
    name: proj.name || "",
    tech: proj.tech || "",
    bullets: Array.isArray(proj.bullets) ? proj.bullets.map(cleanText) : []
  }));

  let normalizedSkills = [];
  if (Array.isArray(parsed.skills)) {
    // Check if it's categorized skills array or just strings
    if (parsed.skills.length > 0 && typeof parsed.skills[0] === 'object' && parsed.skills[0].category) {
      normalizedSkills = parsed.skills.map(s => ({
        category: cleanText(s.category || ""),
        items: Array.isArray(s.items) ? s.items.map(i => cleanText(String(i))) : []
      }));
    } else {
      normalizedSkills = parsed.skills.map(s => cleanText(String(s)));
    }
  } else if (typeof parsed.skills === "string") {
    normalizedSkills = parsed.skills.split(",").map(s => cleanText(s));
  }

  return {
    summary: cleanText(parsed.summary || ""),
    experience: normalizedExp,
    education: normalizedEdu,
    projects: normalizedProj,
    skills: normalizedSkills
  };
}

async function generateResume(formData) {
  const prompt = buildGeneratorPrompt(formData);
  const parsed = await callAIQueue(prompt);
  console.log("✅ FINAL GENERATE SUCCESS");
  return sanitizeGenerated(parsed);
}

/* ---------- PARSER PROMPT (Pre-fill) ---------- */
function buildParsePrompt(resumeText) {
  return `Extract resume data into JSON. Preserve ALL bullet points and details.

RESUME:
${resumeText}

SCHEMA:
{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "website": "",
  "experiences": [{"company": "", "title": "", "dates": "", "description": "full bullet points joined with newlines"}],
  "educations": [{"school": "", "degree": "", "dates": "", "description": ""}],
  "projects": [{"name": "", "tech": "", "description": ""}],
  "skills": "comma-separated list"
}

RULES:
1. NESTED ROLES: If someone held multiple titles at ONE company, create SEPARATE experience entries for each title.
2. DESCRIPTIONS: Preserve EVERY bullet point from the original resume in the description field. Join multiple bullets with newline characters. Do NOT summarize or shorten.
3. DATES: Normalize to 'Mon YYYY - Mon YYYY' or 'Mon YYYY - Present'.
4. SKILLS: Extract ALL skills mentioned anywhere (job descriptions, skills sections, projects). Return as comma-separated string.
5. MISSING FIELDS: Use empty string "" for any field not found. Never use null.
6. Return ONLY valid JSON.`;
}

async function parseResumeToForm(resumeText) {
  const prompt = buildParsePrompt(resumeText);
  const parsed = await callAIQueue(prompt);
  return sanitizeParsedForm(parsed);
}

/* ---------- FALLBACK ---------- */
function fallback() {
  return {
    ats_score: 50,
    matched_keywords: [],
    score: 60,
    summary: "Could not fully analyze — AI services are temporarily busy. Please try again in a moment.",
    detected_role: "Unknown",
    level: "Intermediate",
    top_fixes: ["Add quantified achievements", "Include a professional summary", "Add relevant keywords for your target role"],
    skills: [],
    missing_keywords: ["Projects"],
    breakdown: {
      clarity: 60,
      impact: 50,
      skills: 60,
      structure: 70,
    },
    good: ["Basic structure present"],
    improve: ["Add measurable results to each bullet point"],
    missing: ["Projects section", "Professional summary"],
    rewrite: "Dedicated professional looking for a challenging role in their field.",
  };
}

/* ---------- API ---------- */
app.post("/analyze", upload.single("resume"), async (req, res) => {
  console.log("📥 /analyze hit");

  const filePath = req.file?.path;
  const role = req.body.role || "";
  const jobDescription = req.body.jobDescription || "";

  if (!filePath) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const data = await pdf(fs.readFileSync(filePath));
    const text = data.text;

    console.log("📄 Resume length:", text.length);

    const result = await analyzeResume(text, role, jobDescription);
    return res.json(result);

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    return res.json(fallback());
  } finally {
    fs.unlink(filePath, () => { });
  }
});

/* ---------- PARSE/PRE-FILL API ---------- */
app.post("/parse", upload.single("resume"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const filePath = req.file.path;
  try {
    const data = await fs.promises.readFile(filePath);
    const pdfData = await pdf(data);
    const text = pdfData.text;
    const result = await parseResumeToForm(text);
    return res.json(result);
  } catch (err) {
    console.error("❌ PARSE ERROR:", err.message);
    return res.status(500).json({ error: "Failed to parse resume" });
  } finally {
    fs.unlink(filePath, () => { });
  }
});

/* ---------- ANALYZE API ---------- */
app.post("/generate", async (req, res) => {
  console.log("📥 /generate hit");
  
  try {
    const result = await generateResume(req.body);
    return res.json(result);
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    return res.status(500).json({ error: "Failed to generate resume. AI services are busy." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
