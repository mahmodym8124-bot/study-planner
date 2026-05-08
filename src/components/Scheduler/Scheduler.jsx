import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { generateStudyPlan, getUrgencyColor, getDifficultyColor } from '../../utils/planner';
import { format } from 'date-fns';

function AddSubjectForm({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const today = format(new Date(), 'yyyy-MM-dd');

  const handleSubmit = () => {
    if (!name.trim() || !examDate) return;
    onAdd({ id: Date.now().toString(), name: name.trim(), examDate, difficulty });
    onClose();
  };

  return (
    <div className="card border-accent-blue/30 animate-slide-up">
      <p className="text-base font-bold text-txt-primary mb-4">Add Subject</p>
      <div className="space-y-3">
        <div>
          <label className="label mb-1.5 block">Subject Name</label>
          <input className="input" placeholder="e.g. Electromagnetic Fields" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Exam Date</label>
            <input type="date" className="input" min={today} value={examDate} onChange={e => setExamDate(e.target.value)} />
          </div>
          <div>
            <label className="label mb-1.5 block">Difficulty</label>
            <select className="select" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button className="btn-primary flex-1" onClick={handleSubmit}>Add Subject</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SessionList({ plan }) {
  const { setStudyPlan } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const upcoming = plan.sessions.filter(s => s.date >= todayStr).slice(0, 8);

  const toggle = (sessionId) => {
    setStudyPlan(prev =>
      prev.map(p =>
        p.subjectId === plan.subjectId
          ? { ...p, sessions: p.sessions.map(s => s.id === sessionId ? { ...s, completed: !s.completed } : s) }
          : p
      )
    );
  };

  if (upcoming.length === 0) return <p className="text-xs text-txt-muted mt-3">No upcoming sessions.</p>;

  return (
    <div className="mt-3 space-y-1.5 animate-fade-in">
      <p className="label">Upcoming Sessions (click to mark done)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
        {upcoming.map(s => (
          <div
            key={s.id}
            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all select-none ${
              s.completed ? 'bg-accent-green/5 border border-accent-green/20 opacity-60' : 'bg-bg-muted hover:bg-bg-hover border border-transparent'
            }`}
            onClick={() => toggle(s.id)}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${s.completed ? 'bg-accent-green border-accent-green' : 'border-bg-border'}`}>
              {s.completed && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
            <span className="text-xs font-mono text-txt-secondary">{s.dateLabel}</span>
            <span className="text-xs text-txt-muted ml-auto">{s.duration}min</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Scheduler() {
  const { subjects, setSubjects, studyPlan, setStudyPlan } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const addSubject = (s) => setSubjects(prev => [...prev, s]);

  const deleteSubject = (id) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
    setStudyPlan(prev => prev.filter(p => p.subjectId !== id));
  };

  const generatePlan = () => {
    const plan = generateStudyPlan(subjects);
    setStudyPlan(plan);
    setExpandedId(null);
  };

  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedPlan = [...studyPlan].sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Subjects table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-bold text-txt-primary">My Subjects</p>
          <button className="btn-primary" onClick={() => setShowForm(v => !v)}>+ Add Subject</button>
        </div>

        {showForm && (
          <div className="mb-4">
            <AddSubjectForm onAdd={addSubject} onClose={() => setShowForm(false)} />
          </div>
        )}

        {subjects.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-5xl mb-3 opacity-10">◷</p>
            <p className="text-txt-muted text-sm">No subjects yet. Add your first one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border">
                  {['Subject', 'Exam Date', 'Days Left', 'Difficulty', ''].map(h => (
                    <th key={h} className="text-left label pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {subjects.map(s => {
                  const msLeft = new Date(s.examDate) - new Date();
                  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
                  return (
                    <tr key={s.id} className="hover:bg-bg-hover transition-colors">
                      <td className="py-3 pr-4 font-medium text-txt-primary">{s.name}</td>
                      <td className="py-3 pr-4 font-mono text-txt-secondary text-xs">{s.examDate}</td>
                      <td className="py-3 pr-4">
                        <span className={daysLeft <= 3 ? 'badge-red' : daysLeft <= 7 ? 'badge-amber' : 'badge-blue'}>
                          {daysLeft === 0 ? 'TODAY' : `${daysLeft}d`}
                        </span>
                      </td>
                      <td className="py-3 pr-4"><span className={getDifficultyColor(s.difficulty)}>{s.difficulty}</span></td>
                      <td className="py-3">
                        <button className="text-txt-muted hover:text-accent-red transition-colors text-xs" onClick={() => deleteSubject(s.id)}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {subjects.length > 0 && (
          <div className="mt-4 pt-4 border-t border-bg-border">
            <button className="btn-primary w-full" onClick={generatePlan}>⚡ Generate Smart Study Plan</button>
          </div>
        )}
      </div>

      {/* Plan cards */}
      {sortedPlan.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-txt-primary">Generated Study Plan</p>
            <span className="text-xs text-txt-muted font-mono">Sorted by priority score</span>
          </div>

          {sortedPlan.map((plan, idx) => {
            const done = plan.sessions.filter(s => s.completed).length;
            const total = plan.sessions.length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const isOpen = expandedId === plan.subjectId;

            return (
              <div key={plan.subjectId} className="card card-hover animate-slide-up" style={{ animationDelay: `${idx * 0.04}s` }}>
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(isOpen ? null : plan.subjectId)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm flex-shrink-0 ${idx === 0 ? 'bg-accent-amber/20 text-accent-amber' : 'bg-bg-muted text-txt-muted'}`}>
                      #{plan.rank}
                    </div>
                    <div>
                      <p className="font-semibold text-txt-primary">{plan.subjectName}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={getUrgencyColor(plan.urgency)}>{plan.urgency}</span>
                        <span className={getDifficultyColor(plan.difficulty)}>{plan.difficulty}</span>
                        <span className="text-xs text-txt-muted font-mono">
                          {plan.daysLeft === 0 ? 'Exam today!' : `${plan.daysLeft}d left`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-xs font-mono text-accent-green font-bold">{pct}%</p>
                    <p className="text-[10px] text-txt-muted">{done}/{total} done</p>
                    <p className="text-xs text-txt-muted mt-1">{isOpen ? '▲' : '▼'}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1 bg-bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-accent-blue rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>

                {isOpen && <SessionList plan={plan} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
