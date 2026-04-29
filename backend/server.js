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

  return `You are a world-class resume analyst who combines the expertise of a senior technical recruiter, an ATS (Applicant Tracking System) engineer, and a career coach with 15+ years of experience at top companies (Google, Meta, Amazon).

TARGET ROLE: "${role || "Not specified — infer the best-fit role from the resume content"}"${jdSection}

ANALYSIS INSTRUCTIONS:
Perform a thorough, brutally honest analysis of the resume below. Score conservatively — most resumes should land between 45-75. Only truly exceptional resumes deserve 80+.

SCORING RUBRICS:

1. "ats_score" (0-100): How well this resume would perform in real ATS software.
   - 90-100: Perfect keyword density, clean formatting, standard section headers
   - 70-89: Good keywords but minor formatting issues or missing sections
   - 50-69: Several missing keywords, non-standard formatting, or parsed poorly
   - Below 50: Major ATS compatibility problems

2. "score" (0-100): Overall resume quality as judged by a senior recruiter.
   - 90-100: Publication-worthy, perfect structure, quantified achievements, compelling narrative
   - 70-89: Strong resume with clear achievements but room for improvement
   - 50-69: Average resume, lacks impact or has structural issues
   - Below 50: Needs significant work

3. "breakdown" — Score each dimension 0-100:
   - "clarity": Is the writing concise, jargon-free, and easy to scan in 6 seconds?
   - "impact": Are achievements quantified with metrics (%, $, numbers)? Do bullet points start with strong action verbs?
   - "skills": Are relevant technical/soft skills present and well-organized? Do they match the target role?
   - "structure": Does it follow standard resume conventions? Proper sections, consistent formatting, appropriate length?

4. "summary" (2-3 sentences): A candid professional assessment. Be specific about what stands out and what's holding the resume back. Don't be generic.

5. "detected_role": The most specific job title this resume targets (e.g. "Senior Frontend Engineer" not just "Developer").

6. "level": One of "Entry-Level", "Junior", "Mid-Level", "Senior", "Lead", "Principal", "Executive".

7. "top_fixes" (exactly 3 items): The 3 highest-impact changes that would improve this resume the most. Be specific and actionable — not vague advice like "add more details". Example: "Quantify your API optimization achievement — state the latency reduction percentage and requests per second improvement".

8. "skills" (array of strings): All technical and professional skills detected in the resume. Extract real skill names only (e.g. "React", "Python", "Project Management"), not sentences.

9. "matched_keywords": Keywords in the resume that align well with the target role. If no role specified, match against the detected role.

10. "missing_keywords": Critical keywords, skills, or technologies that are expected for the target role but completely absent from the resume. Be specific to the role.

11. "good" (3-5 items): Specific things this resume does well. Reference actual content from the resume. Example: "Strong use of metrics in the 'Led migration' bullet point showing 40% cost reduction".

12. "improve" (3-5 items): Specific weaknesses with actionable fix suggestions. Reference actual content. Example: "The 'Worked on backend systems' bullet is vague — rewrite as 'Designed and implemented RESTful APIs serving 10K+ daily requests'".

13. "missing" (2-4 items): Important resume sections or content that are entirely absent. Examples: "No dedicated Projects section", "Missing LinkedIn URL", "No professional summary".

14. "rewrite" (30-60 words): Write a compelling professional summary/objective for this candidate that they could use at the top of their resume. Make it powerful, specific to their experience, and tailored to the target role.

RESPONSE FORMAT: Return ONLY valid JSON with no markdown, no explanation, no code fences. Just the raw JSON object with exactly these fields:
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
    matched_keywords: parsed.matched_keywords ?? [],
    score: parsed.score ?? 0,
    summary: cleanText(parsed.summary ?? ""),
    detected_role: parsed.detected_role ?? "Unknown",
    level: parsed.level ?? "Intermediate",
    top_fixes: (parsed.top_fixes || []).map(cleanText),
    skills: parsed.skills ?? [],
    missing_keywords: parsed.missing_keywords ?? [],
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
function buildGeneratorPrompt(name, contact, jobDescription, brainDump) {
  return `You are an expert Executive Resume Writer. Your task is to take the user's messy notes and generate a perfectly structured, professional resume.

USER INFO:
Name: ${name}
Contact: ${contact}

TARGET JOB DESCRIPTION:
${jobDescription || "None provided"}

USER'S MESSY NOTES / BRAIN DUMP:
${brainDump}

INSTRUCTIONS:
1. "summary" (40-60 words): Write a powerful, professional summary tailored to the target JD.
2. "experience" (array of objects): Extract all past jobs from the notes. For each job, return:
   - "title": Cleaned up job title.
   - "company": Company name.
   - "dates": Best guess at dates.
   - "bullets" (array of strings): 3-5 highly professional, action-oriented bullet points. Infer reasonable metrics if appropriate, but keep it realistic. Use strong action verbs. DO NOT include any bullet characters (•, *, -) or emojis in the text itself.
3. "education" (array of objects): Extract education info (degree, school, year) if any, else empty array.
4. "skills" (array of strings): Extract ALL skills, languages, tools, and software explicitly mentioned in the notes (e.g. Python, AutoCAD, Customer Service). If the notes are sparse, infer additional highly relevant professional skills based on their experience and the target JD. You MUST provide at least 5-10 skills.

RESPONSE FORMAT: Return ONLY valid JSON with no markdown formatting.
{"summary":"...","experience":[{"title":"...","company":"...","dates":"...","bullets":["..."]}],"education":[{"degree":"...","school":"...","year":"..."}],"skills":["..."]}
`;
}

async function generateResume(name, contact, jobDescription, brainDump) {
  const prompt = buildGeneratorPrompt(name, contact, jobDescription, brainDump);
  const parsed = await callAIQueue(prompt);
  console.log("✅ FINAL GENERATE SUCCESS");
  return parsed;
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
    rewrite: "Experienced professional seeking to leverage skills and expertise in a challenging role.",
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

/* ---------- GENERATE API ---------- */
app.post("/generate", async (req, res) => {
  console.log("📥 /generate hit");
  const { name, contact, jobDescription, brainDump } = req.body;

  if (!brainDump) {
    return res.status(400).json({ error: "Brain dump is required to generate a resume." });
  }

  try {
    const result = await generateResume(name, contact, jobDescription, brainDump);
    return res.json(result);
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    return res.status(500).json({ error: "Failed to generate resume. AI services are busy." });
  }
});

app.listen(5000, () => {
  console.log("🚀 Server running");
});
