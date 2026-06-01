# ResumeAI

AI-powered resume analyzer and resume builder built with React, Vite, Express, PDF parsing, and multi-provider LLM fallback.

ResumeAI helps users upload an existing resume, analyze it against a target role or job description, and generate a polished ATS-friendly resume with printable PDF templates.

## Features

- **Resume analyzer**: Upload a PDF resume and get an ATS-style score, role detection, skill gaps, matched keywords, missing keywords, and prioritized fixes.
- **Job-description matching**: Paste a target JD to compare the resume against real hiring requirements.
- **AI resume builder**: Enter structured career details and generate a professional resume.
- **PDF pre-fill**: Upload an existing resume to populate the builder form automatically.
- **Multiple resume templates**: Classic, Tech, Executive, Creative, and Minimal styles.
- **Clean PDF export**: Browser-header-free print flow with mobile and print layout fixes.
- **Provider fallback queue**: Uses Groq and Gemini models in priority order so one provider outage does not stop the app.
- **Mobile-aware UI**: Optimized responsive builder flow with reduced heavy effects on smaller devices.

## Tech Stack

**Frontend**
- React 18
- Vite
- CSS custom styling
- Browser print/PDF export

**Backend**
- Node.js
- Express
- Multer
- pdf-parse
- Groq API
- Gemini API

## Project Structure

```text
resume_ai/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── App.jsx
│   ├── main.jsx
│   ├── styles.css
│   ├── index.html
│   └── package.json
└── README.md
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Jaffar94/resumeAi.git
cd resume_ai
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure backend environment variables

Create `backend/.env`:

```bash
cp .env.example .env
```

Then add your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
```

### 4. Start the backend

```bash
npm start
```

The backend runs at:

```text
http://localhost:5000
```

### 5. Install frontend dependencies

Open a second terminal:

```bash
cd frontend
npm install
```

### 6. Configure frontend environment variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

### 7. Start the frontend

```bash
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

## API Endpoints

### `POST /analyze`

Uploads a resume PDF and returns an ATS-style analysis.

Form data:

- `resume`: PDF file
- `role`: target role, optional
- `jobDescription`: target job description, optional

### `POST /parse`

Uploads a resume PDF and extracts structured builder data.

Form data:

- `resume`: PDF file

### `POST /generate`

Generates a structured resume from builder form data.

Body:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1 555 123 4567",
  "location": "New York, NY",
  "linkedin": "linkedin.com/in/janedoe",
  "website": "janedoe.com",
  "jobDescription": "Target job description",
  "experiences": [],
  "educations": [],
  "projects": [],
  "skills": "React, Node.js, AWS"
}
```

## Environment Variables

Backend:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GROQ_API_KEY` | Groq API key |
| `PORT` | Backend port, defaults to `5000` |

Frontend:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend API URL |

## Important Notes

- Do not commit `.env` files.
- PDF upload files are stored temporarily and removed after processing.
- AI-generated resume metrics should be reviewed by the user before final use.
- The app is intended as a resume improvement assistant, not a guarantee of hiring outcomes.

## Build

Frontend production build:

```bash
cd frontend
npm run build
```

Backend start:

```bash
cd backend
npm start
```

## Roadmap Ideas

- Server-side PDF generation with Puppeteer for more deterministic exports.
- User accounts and saved resume versions.
- Template preview gallery.
- Cover letter generator.
- Resume version comparison.
- Automated layout regression tests for every template.

## License

Copyright (c) 2026 Mirza Jaffar Abbas

This project is licensed under the [MIT License](LICENSE).
