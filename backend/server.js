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
${resumeText}t}`;
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
    matched_keywords: (parsed.matched_keywords ?? []).slice(0, 10),
    score: parsed.score ?? 0,
    summary: cleanText(parsed.summary ?? ""),
    detected_role: parsed.detected_role ?? "Unknown",
    level: parsed.level ?? "Intermediate",
    top_fixes: (parsed.top_fixes || []).map(cleanText),
    skills: (parsed.skills ?? []).slice(0, 10),
    missing_keywords: (parsed.missing_keywords ?? []).slice(0, 10),
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

/* ---------- AI PROVIDER HELPERS ---------- */
async function fetchGemini(model, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
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
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
  });
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
    { provider: "groq",   id: "llama-3.3-70b-versatile" },
    { provider: "gemini", id: "gemini-1.5-flash" },
    { provider: "gemini", id: "gemini-1.5-pro" },
    { provider: "groq",   id: "mixtral-8x7b-32768" },
    { provider: "gemini", id: "gemini-2.5-flash-lite" },
    { provider: "gemini", id: "gemini-2.0-flash-lite" },
    { provider: "groq",   id: "llama-3.1-8b-instant" },
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
- Name: ${name} | Contact: ${email}, ${phone}, ${location} | Social: ${linkedin}, ${website}
- Target JD: ${jobDescription || "General Professional"}
- EXP: ${experiences.map(e => `${e.title} @ ${e.company} (${e.dates}): ${e.description}`).join('\n')}
- PROJ: ${projects.map(p => `${p.name} (${p.tech}): ${p.description}`).join('\n')}
- EDU: ${educations.map(e => `${e.degree} @ ${e.school} (${e.dates}): ${e.description}`).join('\n')}
- SKILLS: ${skills}

DIRECTIVES:
1. SECTOR PROTOCOL: FINANCE (Risk/Scale), TECH (Stack/Innovation), HEALTH (Outcomes).
2. SUMMARY: 3 sentences [Identity] -> [Value Prop] -> [Top 3 Skills].
3. EXP BULLETS: Exactly 5-6 bullets/role. Use 'High-Command' verbs (Orchestrated, Mitigated, Spearheaded, Optimized).
4. METRIC DISCIPLINE: Exactly 2-3 bullets per role MUST have metrics (%, $, #). The remaining 3 bullets MUST be purely qualitative/descriptive to ensure authenticity.
5. PROMOTIONS: Separate titles at 1 company to show upward mobility.
6. ATOMIC SKILLS: Array of individual tools (8-10 items). No grouping.
7. GROUNDING: Stay 100% true to data. Elevate tone, don't invent facts.

FORMAT: Return ONLY valid JSON.
{"summary":"","experience":[{"title":"","company":"","dates":"","bullets":[]}],"education":[{"degree":"","school":"","dates":"","details":""}],"projects":[{"name":"","tech":"","bullets":[]}],"skills":[]}
`;
}

async function generateResume(formData) {
  const prompt = buildGeneratorPrompt(formData);
  const parsed = await callAIQueue(prompt);
  console.log("✅ FINAL GENERATE SUCCESS");
  return parsed;
}

/* ---------- PARSER PROMPT (Pre-fill) ---------- */
function buildParsePrompt(resumeText) {
  return `You are a high-speed data extraction engine. Extract into EXACT JSON format.

RESUME:
${resumeText}

SCHEMA:
{
  "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": "",
  "experiences": [{"company": "", "title": "", "dates": "", "description": ""}],
  "educations": [{"school": "", "degree": "", "dates": "", "description": ""}],
  "projects": [{"name": "", "tech": "", "description": ""}],
  "skills": "atomic list"
}

DIRECTIVES:
1. NESTED ROLES: Split multiple titles/promotions at 1 company into distinct 'experiences' entries.
2. DATA EXHAUSTION: Extract all metrics, tools, and project details.
3. ATOMIC SKILLS: Extract as individual strings.
4. LINGUISTIC: Normalize dates ('Month Year - Month Year'), fix case, strip bullets.
5. Return ONLY JSON.`;
}

async function parseResumeToForm(resumeText) {
  const prompt = buildParsePrompt(resumeText);
  return await callAIQueue(prompt);
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
