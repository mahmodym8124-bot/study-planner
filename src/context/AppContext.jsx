import { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

const STORAGE_KEYS = {
  subjects: 'esp_subjects',
  notes: 'esp_notes',
  pomodoroStats: 'esp_pomo_stats',
  studyPlan: 'esp_study_plan',
  focusLog: 'esp_focus_log',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function AppProvider({ children }) {
  const [subjects, setSubjectsState] = useState(() =>
    load(STORAGE_KEYS.subjects, [])
  );
  const [notes, setNotesState] = useState(() =>
    load(STORAGE_KEYS.notes, {})
  );
  const [studyPlan, setStudyPlanState] = useState(() =>
    load(STORAGE_KEYS.studyPlan, [])
  );
  const [pomodoroStats, setPomodoroStatsState] = useState(() =>
    load(STORAGE_KEYS.pomodoroStats, { totalSessions: 0, totalMinutes: 0, today: {} })
  );
  const [focusLog, setFocusLogState] = useState(() =>
    load(STORAGE_KEYS.focusLog, [])
  );
  const [activeView, setActiveView] = useState('dashboard');

  // Persist on change
  const setSubjects = useCallback((val) => {
    const next = typeof val === 'function' ? val(subjects) : val;
    setSubjectsState(next);
    save(STORAGE_KEYS.subjects, next);
  }, [subjects]);

  const setNotes = useCallback((val) => {
    const next = typeof val === 'function' ? val(notes) : val;
    setNotesState(next);
    save(STORAGE_KEYS.notes, next);
  }, [notes]);

  const setStudyPlan = useCallback((val) => {
    const next = typeof val === 'function' ? val(studyPlan) : val;
    setStudyPlanState(next);
    save(STORAGE_KEYS.studyPlan, next);
  }, [studyPlan]);

  const setPomodoroStats = useCallback((val) => {
    const next = typeof val === 'function' ? val(pomodoroStats) : val;
    setPomodoroStatsState(next);
    save(STORAGE_KEYS.pomodoroStats, next);
  }, [pomodoroStats]);

  const setFocusLog = useCallback((val) => {
    const next = typeof val === 'function' ? val(focusLog) : val;
    setFocusLogState(next);
    save(STORAGE_KEYS.focusLog, next);
  }, [focusLog]);

  // Record a completed pomodoro session
  const recordSession = useCallback((minutes, subjectName = null) => {
    const today = new Date().toISOString().slice(0, 10);
    setPomodoroStats((prev) => {
      const todayData = prev.today || {};
      return {
        totalSessions: prev.totalSessions + 1,
        totalMinutes: prev.totalMinutes + minutes,
        today: {
          ...todayData,
          [today]: {
            sessions: (todayData[today]?.sessions || 0) + 1,
            minutes: (todayData[today]?.minutes || 0) + minutes,
          },
        },
      };
    });
    setFocusLog((prev) => [
      { id: Date.now(), date: today, minutes, subject: subjectName },
      ...prev.slice(0, 99),
    ]);
  }, [setPomodoroStats, setFocusLog]);

  // Compute today's focus minutes
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMinutes = pomodoroStats.today?.[todayKey]?.minutes || 0;
  const todaySessions = pomodoroStats.today?.[todayKey]?.sessions || 0;

  // Get last 7 days focus data for charts
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      minutes: pomodoroStats.today?.[key]?.minutes || 0,
      sessions: pomodoroStats.today?.[key]?.sessions || 0,
    };
  });

  return (
    <AppContext.Provider
      value={{
        subjects, setSubjects,
        notes, setNotes,
        studyPlan, setStudyPlan,
        pomodoroStats, setPomodoroStats,
        focusLog, setFocusLog,
        activeView, setActiveView,
        recordSession,
        todayMinutes, todaySessions,
        weeklyData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
