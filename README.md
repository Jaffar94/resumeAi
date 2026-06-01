# ResumeAI — AI-Powered Resume Analyzer & Builder

Live Demo: https://resumeai-1-4x2h.onrender.com/

## What It Does
- Analyzes your resume and generates an ATS score
- Identifies skill gaps and provides actionable feedback
- Builds professional resumes in 5 different designs
- Parses and auto-fills existing resumes
- Fully editable by the user

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Python
- APIs: Groq, Gemini

## Architecture Decision — Graceful Degradation
The app uses an automatic API fallback system. If the primary API hits its rate limit, the system seamlessly switches to the next available API in order. This ensures consistent availability despite free-tier API constraints — my first real implementation of fault-tolerant design in a production environment.

## What I Learned
- Integrating multiple production APIs
- Handling real, unpredictable user input
- Building fallback systems for reliability
- Deploying and maintaining a live web application

## Built By
CSE Student @ BMS College of Engineering, Bangalore — Batch 2029
