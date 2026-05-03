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
    .replace(/[#*`]/g, "")
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

TARGET ROLE: "${role || "Not specified — infer the best-fit role from the resume content"}"${jdSection}

ANALYSIS INSTRUCTIONS:
Analyze the resume below with the eye of a senior recruiter. Your feedback should be direct, professional, and coaching-oriented. Score conservatively but fairly — a score of 70-80 represents a very strong candidate.

SCORING RUBRICS:

1. "ats_score" (0-100): ATS readability and keyword alignment.
   - 90-100: Perfect structure, zero parsing errors, high keyword density.
   - 70-89: Strong keywords but layout could be cleaner.
   - Below 70: Formatting roadblocks or critical keyword gaps.

2. "score" (0-100): Human recruiter appeal.
   - 90-100: Exceptional; clear "buy" signal. Results-driven, powerful narrative.
   - 70-89: Solid professional profile; needs minor polishing of impact statements.
   - Below 70: Lacks quantifiable achievements or clear career progression.

3. "breakdown" (0-100):
   - "clarity": Scanability and conciseness.
   - "impact": The use of "Action-Verb + Result + Metric" formula.
   - "skills": Breadth and relevance of the technical/professional toolkit.
   - "structure": Logical flow and professional layout.

4. "summary" (2-3 sentences): A supportive overview of the candidate's standing. Start with their biggest strength, then state the single most important thing they need to change to land an interview.

5. "detected_role": The most accurate professional title for this profile.

6. "level": Career stage (Entry-Level to Executive).

7. "top_fixes" (exactly 3 items): The "Game Changers". These should be the 3 highest-priority improvements. Use the format: "[Action] + [Context] + [Reason]". Example: "Add a 'Core Competencies' section near the top to ensure the ATS immediately flags your Cloud Architecture skills."

8. "skills" (array): Clean names of detected tools and technologies (max 10 items).

9. "matched_keywords": Role-relevant skills found in the resume (max 10 items).

10. "missing_keywords": High-value keywords for the target role that are currently missing (max 10 items).

11. "good" (3-5 items): Specific highlights from the resume that prove value. Example: "Excellent use of the X-Y-Z formula in your 'Senior Developer' role."

12. "improve" (3-5 items): Specific, actionable suggestions to elevate existing content.

13. "missing" (2-4 items): Entirely missing sections or critical data points.

14. "rewrite" (30-60 words): A high-impact, modern "Professional Profile" summary that the candidate can copy-paste to the top of their resume. Focus on achievements and unique value.

RESPONSE FORMAT: Return ONLY valid JSON. No markdown, no fences.
{"ats_score","matched_keywords","score","summary","detected_role","level","top_fixes","skills","missing_keywords","breakdown":{"clarity","impact","skills","structure"},"good","improve","missing","rewrite"}

RESUME TEXT:
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
    { provider: "gemini", id: "gemini-2.5-flash" },
    { provider: "groq",   id: "llama-3.3-70b-versatile" },
    { provider: "gemini", id: "gemini-2.0-flash" },
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

  return `You are an elite, FAANG-level Executive Resume Writer and ATS Optimization Expert. Your goal is to transform the user's data into a top 1% professional resume that beats every ATS filter and wows human recruiters.

${!hasExperience ? "CRITICAL: The candidate is a student/entry-level. Focus heavily on academic excellence, technical projects, and internships to demonstrate high potential." : ""}

USER DATA:
- Name: ${name}
- Contact: ${email} | ${phone} | ${location} | ${linkedin} | ${website || ""}
- Target JD: ${jobDescription || "Not provided"}

EXPERIENCE:
${experiences.map(e => `- ${e.title} at ${e.company} (${e.dates}): ${e.description}`).join('\n')}

PROJECTS:
${projects.map(p => `- ${p.name} (${p.tech}): ${p.description}`).join('\n')}

EDUCATION:
${educations.map(e => `- ${e.degree} from ${e.school} (${e.dates}): ${e.description || ""}`).join('\n')}

ADDITIONAL INFO/SKILLS:
${skills}

CORE INSTRUCTIONS FOR ELITE OUTPUT:
1. STRICT GROUNDING: You are FORBIDDEN from inventing fake job titles, companies, dates, or degrees. Use only the provided user data as the absolute ground truth.
2. CONTEXTUAL KEYWORDS: Identify the top keywords from the Target JD. Weave them into the resume ONLY if they are logically related to the user's actual experience. (e.g., If the user built a website, you can use "Frontend Architecture," but do not say they used "Cloud" unless they mentioned it).
3. X-Y-Z FORMULA: Rewrite experience bullets using: "Accomplished [X] as measured by [Y], by doing [Z]". Sharpen the language, but do not invent fake metrics.
4. PROFESSIONAL SUMMARY: Write a 3-sentence profile based strictly on the provided facts. Align their existing strengths with the Target JD.
5. PROJECTS & EDUCATION: Transform descriptions into professional entries. Extract honors/coursework from the education notes.
6. SORTING: Sort experience and education in reverse chronological order. Entries with "Present", "Current", or the most recent year MUST come first. Apply this to the final JSON arrays.

RESPONSE FORMAT: Return ONLY valid JSON.
{"summary":"...","experience":[{"title":"...","company":"...","dates":"...","bullets":["..."]}],"education":[{"degree":"...","school":"...","dates":"...","details":"..."}],"projects":[{"name":"...","tech":"...","bullets":["..."]}],"skills":["..."]}
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
  return `You are a high-speed data extraction engine. Extract the following information from the resume text into the EXACT JSON format specified.

RESUME TEXT:
${resumeText}

STRICT JSON FORMAT:
{
  "name": "...",
  "email": "...",
  "phone": "...",
  "location": "...",
  "linkedin": "...",
  "website": "...",
  "experiences": [{"company": "...", "title": "...", "dates": "...", "description": "..."}],
  "educations": [{"school": "...", "degree": "...", "dates": "...", "description": "..."}],
  "projects": [{"name": "...", "tech": "...", "description": "..."}],
  "skills": "list of skills as a single string"
}

INSTRUCTIONS:
- If a field is missing, use "".
- For 'experiences', summarize the responsibilities into the 'description' field.
- Return ONLY the JSON. No markdown.`;
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
