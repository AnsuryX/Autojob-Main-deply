# 🚀 AutoJob Cloud: The Autonomous Career OS

**AutoJob Cloud** is a professional-grade, autonomous agent designed for the modern high-growth engineer. It goes beyond standard job boards by functioning as a proactive "Career Navigator"—automating lead discovery, artifact synthesis, and interview readiness.

---

## 📱 Progressive Web App (PWA)
AutoJob Cloud is designed to be installed on your workstation or mobile device for a native experience:
- **Desktop**: Click the "Install" icon in your Chrome/Edge address bar.
- **Mobile**: Use "Add to Home Screen" from your browser's share menu.
- **Features**: Works offline, full-screen mode, and standalone launch.

---

## 🧠 Core Features

### 1. Lead Discovery Hub (Real-time Grounding)
Unlike static aggregators, the Discovery Hub uses **Google Search Grounding** via `gemini-3-pro-preview`. 
- **Authenticity Check**: Every job found is verified against live web results.
- **Market Insights**: Provides real-time salary benchmarks and tech-stack demand trends for every query.
- **Deep Extraction**: Pasting a URL triggers a neural crawl to extract hidden requirements and culture cues.

### 2. Neural Resume Lab & Mutation Engine
Manage multiple "Career Tracks" (e.g., Staff Engineer, Frontend Lead, Technical Architect).
- **ATS Optimization**: Analyzes job descriptions to suggest and inject missing high-impact keywords.
- **Profile Sync**: Automatically aligns your resume achievements with your global identity goals.
- **PDF Generation**: High-fidelity, template-driven export for immediate dispatch.

### 3. Strategic Career Navigator
Generate a 6-month market-driven evolution roadmap.
- **Gap Analysis**: Compares your current profile against target market benchmarks.
- **Milestone Grid**: A compact dashboard of goals, action items, and skill gains required to reach your next valuation tier.

### 4. Neural Interview Chamber
A voice-native simulation environment using the **Gemini Live API**.
- **Real-time Interaction**: Low-latency PCM audio streaming for human-like conversation.
- **Persona Simulation**: Challenge yourself against challenging "Technical Hiring Manager" personas.
- **Live Transcription**: Instant feedback and analysis of your responses.

---

## ⌨️ Mission Control (Command Terminal)

Access the agent's brain directly using `CMD + K` (or `CTRL + K`). 

| Command Type | Example |
| :--- | :--- |
| **Search** | `Find Staff React roles in San Francisco with 200k+ salary` |
| **Mutation** | `Improve my resume summary for leadership roles` |
| **Strategy** | `Generate a roadmap for moving from Senior to Staff Engineer` |
| **Navigation** | `Switch to the Chamber` or `Go to my History` |
| **Update** | `Update my portfolio URL to https://johndoe.dev` |

---

## 🛠 Technical Architecture

- **AI Engine**: Powered by `@google/genai` utilizing:
  - `gemini-3-pro-preview`: For complex reasoning and search-grounded discovery.
  - `gemini-3-flash-preview`: For high-speed resume mutation and command interpretation.
  - `gemini-2.5-flash-native-audio-preview-12-2025`: For real-time voice interviews.
- **Database & Auth**: **Supabase** for secure profile persistence and application audit trails.
- **Frontend**: React 19, Tailwind CSS (for the "Cloud Agent" aesthetic), and `jsPDF` for artifact generation.
- **Audio Processing**: Custom PCM encoding/decoding for gapless voice-native interactions.

---

## 🚦 Getting Started

1.  **Identity Setup**: Head to the **Identity** tab and upload your base resume. The neural parser will deconstruct it into structured JSON.
2.  **Define Preferences**: Set your target roles, locations, and salary floor in your profile to guide the agent's autonomous searches.
3.  **Mission Command**: Use the terminal to start your first search. The agent will persist your results and track your progress across the cloud.

---

*Built for the 1% who automate the mundane to focus on the impactful.*
