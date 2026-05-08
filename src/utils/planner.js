import { differenceInDays, addDays, format } from 'date-fns';

const DIFFICULTY_WEIGHTS = { easy: 1, medium: 2, hard: 3 };
const URGENCY_THRESHOLDS = { critical: 3, high: 7, medium: 14 };

/**
 * Generates a structured study plan from a list of subjects with exam dates.
 * Uses weighted prioritization: difficulty × days_remaining inverse.
 */
export function generateStudyPlan(subjects) {
  if (!subjects || subjects.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Score each subject
  const scored = subjects
    .map((s) => {
      const examDate = new Date(s.examDate);
      examDate.setHours(0, 0, 0, 0);
      const daysLeft = differenceInDays(examDate, today);
      const weight = DIFFICULTY_WEIGHTS[s.difficulty] || 1;
      const urgencyScore = daysLeft <= 0 ? 9999 : (weight * 100) / daysLeft;

      let urgency = 'low';
      if (daysLeft <= URGENCY_THRESHOLDS.critical) urgency = 'critical';
      else if (daysLeft <= URGENCY_THRESHOLDS.high) urgency = 'high';
      else if (daysLeft <= URGENCY_THRESHOLDS.medium) urgency = 'medium';

      return { ...s, daysLeft, urgencyScore, urgency };
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore);

  // Assign daily study blocks (simple greedy allocation)
  const plan = [];
  const totalWeight = scored.reduce((s, x) => s + DIFFICULTY_WEIGHTS[x.difficulty], 0);

  scored.forEach((subject, idx) => {
    const weight = DIFFICULTY_WEIGHTS[subject.difficulty];
    const dailyHours = Math.max(1, Math.round((weight / totalWeight) * 5)); // 5 hrs/day budget
    const sessionsPerDay = dailyHours <= 2 ? 1 : 2;

    // Generate sessions up to exam
    const examDate = new Date(subject.examDate);
    const daysAvailable = Math.max(1, Math.min(subject.daysLeft, 14));

    const sessions = [];
    for (let d = 0; d < daysAvailable; d++) {
      const date = addDays(today, d);
      // Don't study the day of the exam
      if (format(date, 'yyyy-MM-dd') === format(examDate, 'yyyy-MM-dd')) continue;
      for (let s = 0; s < sessionsPerDay; s++) {
        sessions.push({
          id: `${subject.id}-d${d}-s${s}`,
          date: format(date, 'yyyy-MM-dd'),
          dateLabel: format(date, 'EEE, MMM d'),
          duration: 50, // minutes per session
          completed: false,
        });
      }
    }

    plan.push({
      subjectId: subject.id,
      subjectName: subject.name,
      difficulty: subject.difficulty,
      examDate: subject.examDate,
      daysLeft: subject.daysLeft,
      urgency: subject.urgency,
      dailyHours,
      sessions,
      rank: idx + 1,
    });
  });

  return plan;
}

export function getUrgencyColor(urgency) {
  const map = {
    critical: 'badge-red',
    high: 'badge-amber',
    medium: 'badge-blue',
    low: 'badge-green',
  };
  return map[urgency] || 'badge-green';
}

export function getDifficultyColor(difficulty) {
  const map = { easy: 'badge-green', medium: 'badge-amber', hard: 'badge-red' };
  return map[difficulty] || 'badge-blue';
}

export function formatMinutes(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
