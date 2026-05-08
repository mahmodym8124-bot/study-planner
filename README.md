# Engineer Study Planner

**Smart Productivity System for Engineering Students**

A modern, production-ready web application designed to help engineering students plan, focus, and prepare for exams. Portfolio-grade project demonstrating clean React architecture, real usability, and professional UI/UX.

---

## Features

- **Smart Study Scheduler** — Add subjects with exam dates + difficulty. Generates a prioritized study plan with urgency scoring. Mark sessions complete with progress tracking.
- **Pomodoro Focus Timer** — 25/50-min modes, animated ring timer, streak tracking, weekly stats chart, browser notifications.
- **Notes System** — Subject → Topic → Note hierarchy. Full CRUD. Monospace editor for technical content. All data in localStorage.
- **Exam Mode** — Built-in content for Electromagnetic Fields, Electrical Machines, Circuit Analysis. Topics checklist, formula reference (copy-to-clipboard), practice questions.
- **Dashboard** — Weekly focus chart, upcoming exams, today's sessions, subject progress bars.

---

## Tech Stack

- React 18 + Vite
- Tailwind CSS v3
- Recharts (charts)
- date-fns (date math)
- localStorage (persistence)

---

## Run Locally

```bash
git clone https://github.com/YOUR_USERNAME/study-planner.git
cd study-planner
npm install
npm run dev
# → http://localhost:5173
```

## Build

```bash
npm run build
# Output in /dist — deploy anywhere
```

---

## Deploy

### Vercel (recommended)

```bash
# Option 1 — CLI
npm i -g vercel && vercel --prod

# Option 2 — GitHub import
# Push to GitHub → vercel.com → New Project → Import repo → Deploy
```

### Netlify

```bash
npm run build
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

### Upload to GitHub first

```bash
git init
git add .
git commit -m "Engineer Study Planner v1.0"
git remote add origin https://github.com/YOUR_USERNAME/study-planner.git
git push -u origin main
```

---

## Project Structure

```
src/
├── context/AppContext.jsx      # Global state + auto-persist to localStorage
├── utils/
│   ├── planner.js              # Priority scoring algorithm
│   └── examData.js             # Built-in engineering content
└── components/
    ├── Layout/                 # Sidebar + Header
    ├── Dashboard/              # Overview + charts
    ├── Scheduler/              # Subject manager + plan generator
    ├── Pomodoro/               # Focus timer
    ├── Notes/                  # 3-column notes system
    └── ExamMode/               # Quick revision mode
```

---

## Future Improvements

- Cloud sync (Supabase/Firebase)
- Export plan to PDF or ICS calendar
- Spaced repetition scheduling
- AI-generated questions from user notes
- PWA / offline support
- Light mode toggle

---

## Author

Mahmod Yassin — University of Duhok  
MIT License
