import { useApp } from '../../context/AppContext';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'scheduler', label: 'Study Scheduler', icon: '◷' },
  { id: 'pomodoro', label: 'Focus Timer', icon: '◉' },
  { id: 'notes', label: 'Notes', icon: '◫' },
  { id: 'exam', label: 'Exam Mode', icon: '◆' },
];

export default function Sidebar() {
  const { activeView, setActiveView, todayMinutes, todaySessions } = useApp();

  return (
    <aside className="w-60 flex-shrink-0 bg-bg-card border-r border-bg-border flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center">
            <span className="text-accent-blue text-sm font-mono font-bold">E</span>
          </div>
          <div>
            <p className="text-sm font-bold text-txt-primary leading-none">StudyPlanner</p>
            <p className="text-[10px] text-txt-muted font-mono mt-0.5">ENGINEERING EDITION</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="label px-3 mb-3 mt-1">Navigation</p>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`nav-link w-full text-left ${activeView === item.id ? 'nav-link-active' : ''}`}
          >
            <span className="font-mono text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Today stats */}
      <div className="p-4 border-t border-bg-border">
        <p className="label mb-3">Today's Focus</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-bg-muted rounded-lg p-2.5 text-center">
            <p className="font-mono font-bold text-accent-blue text-lg leading-none">
              {todayMinutes < 60 ? `${todayMinutes}m` : `${Math.floor(todayMinutes / 60)}h${todayMinutes % 60 > 0 ? todayMinutes % 60 + 'm' : ''}`}
            </p>
            <p className="text-[10px] text-txt-muted mt-1">Focused</p>
          </div>
          <div className="bg-bg-muted rounded-lg p-2.5 text-center">
            <p className="font-mono font-bold text-accent-amber text-lg leading-none">
              {todaySessions}
            </p>
            <p className="text-[10px] text-txt-muted mt-1">Sessions</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
