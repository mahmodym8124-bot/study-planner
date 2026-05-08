import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MODES = {
  focus25: { label: '25 min', seconds: 25 * 60, type: 'focus' },
  focus50: { label: '50 min', seconds: 50 * 60, type: 'focus' },
  short:   { label: '5 min break',  seconds: 5  * 60, type: 'break' },
  long:    { label: '15 min break', seconds: 15 * 60, type: 'break' },
};

function pad(n) { return String(n).padStart(2, '0'); }

function Ring({ pct, color = '#4f9cf9', size = 210 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a2540" strokeWidth={10} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg px-3 py-2 text-xs">
      <p className="text-txt-muted font-mono">{label}</p>
      <p className="text-accent-blue font-bold">{payload[0].value}m</p>
    </div>
  );
};

export default function Pomodoro() {
  const { subjects, recordSession, weeklyData, todayMinutes, todaySessions, pomodoroStats } = useApp();

  const [modeKey, setModeKey]                 = useState('focus25');
  const [timeLeft, setTimeLeft]               = useState(MODES.focus25.seconds);
  const [running, setRunning]                 = useState(false);
  const [completed, setCompleted]             = useState(0);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [phase, setPhase]                     = useState('idle');

  const mode    = MODES[modeKey];
  const isBreak = mode.type === 'break';
  const pct     = timeLeft / mode.seconds;
  const ringColor = isBreak ? '#22d3a0' : '#4f9cf9';

  // Sync ref after each render so interval callback reads current value without stale closure
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const handleComplete = useCallback(() => {
    setRunning(false);
    setPhase('done');
    if (!isBreak) {
      const mins = Math.round(mode.seconds / 60);
      recordSession(mins, selectedSubject || null);
      setCompleted(c => c + 1);
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Session complete! 🎯', { body: `${mode.label} done.` });
        }
      } catch { /* silently ignore if notifications are blocked */ }
    }
  }, [isBreak, mode, recordSession, selectedSubject]);

  // Timer — all state updates happen inside the setInterval callback, not the effect body.
  // Reading timeLeft via ref avoids stale closures without adding timeLeft as a dependency.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (timeLeftRef.current <= 1) {
        clearInterval(id);
        setTimeLeft(0);
        handleComplete();
      } else {
        setTimeLeft(prev => prev - 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, handleComplete]);

  const start = () => {
    if (phase === 'done') setTimeLeft(mode.seconds);
    setRunning(true);
    setPhase('running');
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch { /* silently ignore */ }
  };

  const pause  = () => { setRunning(false); setPhase('paused'); };
  const reset  = () => { setRunning(false); setPhase('idle'); setTimeLeft(mode.seconds); };

  const switchMode = (key) => {
    setModeKey(key);
    setRunning(false);
    setPhase('idle');
    setTimeLeft(MODES[key].seconds);
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Timer panel */}
        <div className="lg:col-span-2 card flex flex-col items-center gap-6">
          <div className="flex gap-1 bg-bg-muted rounded-xl p-1 w-full max-w-sm">
            {Object.entries(MODES).map(([key, m]) => (
              <button key={key} onClick={() => switchMode(key)}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-lg transition-all duration-200 ${
                  modeKey === key
                    ? m.type === 'break'
                      ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                      : 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                    : 'text-txt-muted hover:text-txt-secondary'
                }`}
              >{m.label}</button>
            ))}
          </div>

          {subjects.length > 0 && (
            <div className="w-full max-w-xs">
              <label className="label mb-1.5 block text-center">Studying</label>
              <select className="select text-center" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                <option value="">— Select subject —</option>
                {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div className="relative flex items-center justify-center">
            <Ring pct={pct} color={ringColor} size={210} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-mono text-5xl font-bold text-txt-primary tracking-tight">
                {pad(mins)}:{pad(secs)}
              </p>
              <p className="text-xs text-txt-muted mt-1 font-mono uppercase tracking-widest">
                {phase === 'idle'   ? mode.label
                : phase === 'done' ? (isBreak ? 'break done' : 'session done ✓')
                : isBreak          ? 'on break'
                :                    'focusing'}
              </p>
              {phase === 'running' && !isBreak && selectedSubject && (
                <p className="text-xs text-accent-blue mt-2">{selectedSubject}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${i < completed ? 'bg-accent-amber scale-110' : 'bg-bg-border'}`} />
            ))}
            <span className="text-xs text-txt-muted ml-1 font-mono">{completed}/4 pomodoros</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-secondary" onClick={reset}>Reset</button>
            {phase === 'running' ? (
              <button className="px-8 py-3 rounded-xl font-bold text-sm bg-accent-amber/20 text-accent-amber border border-accent-amber/30 hover:bg-accent-amber/30 transition-all cursor-pointer" onClick={pause}>
                ⏸ Pause
              </button>
            ) : (
              <button
                className={`px-8 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  isBreak
                    ? 'bg-accent-green/20 text-accent-green border border-accent-green/30 hover:bg-accent-green/30'
                    : 'bg-accent-blue text-white hover:bg-blue-500'
                }`}
                onClick={start}
              >
                {phase === 'paused' ? '▶ Resume' : phase === 'done' ? '↺ New Session' : '▶ Start'}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div className="card">
            <p className="label mb-3">Today</p>
            <div className="space-y-3">
              {[
                { label: 'Sessions',          val: todaySessions,                                    color: 'text-accent-blue'  },
                { label: 'Focused',           val: `${todayMinutes}m`,                               color: 'text-accent-amber' },
                { label: 'All-time sessions', val: pomodoroStats.totalSessions,                      color: 'text-accent-green' },
                { label: 'All-time focus',    val: `${Math.round(pomodoroStats.totalMinutes / 60)}h`, color: 'text-txt-primary'  },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <p className="text-sm text-txt-secondary">{label}</p>
                  <p className={`font-mono font-bold ${color}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="label mb-3">This Week (min)</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={weeklyData} barSize={14}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar dataKey="minutes" fill={isBreak ? '#22d3a0' : '#4f9cf9'} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card bg-accent-blue/5 border-accent-blue/20">
            <p className="label mb-2">Focus Tip</p>
            <p className="text-xs text-txt-secondary leading-relaxed">
              {completed >= 4
                ? '🎉 4 pomodoros done! Take a long 15-min break before the next set.'
                : completed >= 2
                ? '💪 Good momentum! Stay away from your phone during sessions.'
                : 'Close unneeded tabs, silence your phone. One task at a time.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
