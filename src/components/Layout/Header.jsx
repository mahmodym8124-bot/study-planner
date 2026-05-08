import { format } from 'date-fns';

const VIEW_TITLES = {
  dashboard: { title: 'Dashboard', sub: 'Your study overview' },
  scheduler: { title: 'Study Scheduler', sub: 'Smart prioritization engine' },
  pomodoro: { title: 'Focus Timer', sub: 'Deep work sessions' },
  notes: { title: 'Notes', sub: 'Subject → Topic → Content' },
  exam: { title: 'Exam Mode', sub: 'Quick revision before exams' },
};

export default function Header({ activeView }) {
  const info = VIEW_TITLES[activeView] || VIEW_TITLES.dashboard;
  const now = new Date();

  return (
    <header className="h-14 border-b border-bg-border flex items-center justify-between px-6 bg-bg-card/50 backdrop-blur-sm flex-shrink-0">
      <div>
        <h1 className="text-base font-bold text-txt-primary leading-none">{info.title}</h1>
        <p className="text-xs text-txt-muted mt-0.5">{info.sub}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 bg-bg-muted border border-bg-border rounded-lg px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse inline-block" />
          <span className="text-xs font-mono text-txt-secondary">
            {format(now, 'EEE, MMM d')}
          </span>
        </div>
      </div>
    </header>
  );
}
