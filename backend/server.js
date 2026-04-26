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

/* ---------- GEMINI ---------- */
async function callGemini(resumeText, role) {
  const prompt = `
You are a STRICT resume reviewer and ATS expert.

Role: "${role || "Not provided"}"

Return ONLY JSON:

{
  "ats_score": number,
  "matched_keywords": [],
  "score": number,
  "summary": "",
  "detected_role": "",
  "level": "",
  "top_fixes": [],
  "skills": [],
  "missing_keywords": [],
  "breakdown": {
    "clarity": number,
    "impact": number,
    "skills": number,
    "structure": number
  },
  "good": [],
  "improve": [],
  "missing": [],
  "rewrite": ""
}

Resume:
${resumeText}
`;

  console.log("📡 Calling Gemini...");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
  console.log("🔍 RAW:", JSON.stringify(raw, null, 2));

  if (raw.error) {
    throw new Error(raw.error.message);
  }

  let text =
    raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  text = text.trim().replace(/```json|```/g, "");

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");
    parsed = JSON.parse(match[0]);
  }

  /* ---------- CLEAN + SAFE ---------- */
  parsed = {
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

  console.log("✅ FINAL:", parsed);

  return parsed;
}

/* ---------- FALLBACK ---------- */
function fallback() {
  return {
    ats_score: 50,
    matched_keywords: [],
    score: 60,
    summary: "Basic resume detected",
    detected_role: "Unknown",
    level: "Intermediate",
    top_fixes: ["Add achievements", "Improve summary"],
    skills: [],
    missing_keywords: ["Projects"],
    breakdown: {
      clarity: 60,
      impact: 50,
      skills: 60,
      structure: 70,
    },
    good: ["Basic structure"],
    improve: ["Add measurable results"],
    missing: ["Projects"],
    rewrite: "Basic candidate profile.",
  };
}

/* ---------- API ---------- */
app.post("/analyze", upload.single("resume"), async (req, res) => {
  console.log("📥 /analyze hit");

  const filePath = req.file?.path;
  const role = req.body.role || "";

  if (!filePath) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const data = await pdf(fs.readFileSync(filePath));
    const text = data.text;

    console.log("📄 Resume length:", text.length);

    const result = await callGemini(text, role);
    return res.json(result);

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    return res.json(fallback());
  } finally {
    fs.unlink(filePath, () => {});
  }
});

app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});