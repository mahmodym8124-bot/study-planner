import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getExamData, EXAM_DATA } from '../../utils/examData';

function FormulaCard({ formula }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(`${formula.name}: ${formula.expr}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="bg-bg-muted border border-bg-border rounded-xl p-4 group hover:border-accent-blue/30 transition-all">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-txt-muted font-mono mb-1">{formula.name}</p>
        <button
          onClick={copy}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-accent-blue cursor-pointer transition-all"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <p className="font-mono text-accent-amber text-sm font-semibold">{formula.expr}</p>
      {formula.note && <p className="text-[11px] text-txt-muted mt-1">{formula.note}</p>}
    </div>
  );
}

function QuestionCard({ question, idx }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div
      className={`card card-hover cursor-pointer select-none transition-all ${revealed ? 'border-accent-green/30 bg-accent-green/5' : ''}`}
      onClick={() => setRevealed(!revealed)}
    >
      <div className="flex items-start gap-3">
        <span className="badge-blue flex-shrink-0">Q{idx + 1}</span>
        <div>
          <p className="text-sm text-txt-primary">{question}</p>
          {revealed && (
            <div className="mt-2 pt-2 border-t border-bg-border animate-fade-in">
              <p className="text-xs text-accent-green font-mono">→ Think through your answer, then verify with your notes/textbook.</p>
            </div>
          )}
        </div>
        <span className="ml-auto text-txt-muted text-xs flex-shrink-0">{revealed ? '▲' : '▼'}</span>
      </div>
    </div>
  );
}

function SubjectSelector({ subjects, selected, onSelect }) {
  // Merge user subjects with built-in exam data keys
  const builtInKeys = Object.keys(EXAM_DATA);
  const allOptions = [
    ...subjects.map((s) => ({ id: s.id, name: s.name, isUser: true })),
    ...builtInKeys
      .filter((k) => !subjects.some((s) =>
        s.name.toLowerCase().includes(k.toLowerCase().split(' ')[0])
      ))
      .map((k) => ({ id: k, name: k, isUser: false })),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {allOptions.map((opt) => {
        const data = getExamData(opt.name);
        const isActive = selected === opt.name;
        return (
          <button
            key={opt.id}
            onClick={() => onSelect(isActive ? null : opt.name)}
            className={`card text-left transition-all duration-200 ${
              isActive ? 'border-accent-amber/40 bg-accent-amber/5' : 'card-hover'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl opacity-60">◆</span>
              {opt.isUser && <span className="badge-blue text-[10px]">my subject</span>}
            </div>
            <p className="text-sm font-semibold text-txt-primary leading-tight">{opt.name}</p>
            {data && (
              <p className="text-[11px] text-txt-muted mt-1 font-mono">
                {data.topics.length} topics · {data.formulas.length} formulas · {data.questions.length} Qs
              </p>
            )}
            {!data && (
              <p className="text-[11px] text-txt-muted mt-1 italic">No built-in data yet</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function ExamMode() {
  const { subjects } = useApp();
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [activeTab, setActiveTab] = useState('topics');
  const [checkedTopics, setCheckedTopics] = useState({});

  const data = selectedSubject ? getExamData(selectedSubject) : null;

  const toggleTopic = (topic) => {
    setCheckedTopics((prev) => ({ ...prev, [topic]: !prev[topic] }));
  };

  const checkedCount = Object.values(checkedTopics).filter(Boolean).length;
  const totalTopics = data?.topics.length || 0;
  const readinessPct = totalTopics ? Math.round((checkedCount / totalTopics) * 100) : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card bg-accent-amber/5 border-accent-amber/20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">◆</span>
          <div>
            <p className="font-bold text-txt-primary">Exam Mode</p>
            <p className="text-xs text-txt-muted">Select a subject to start quick revision. Check off topics as you review them.</p>
          </div>
        </div>
      </div>

      {/* Subject grid */}
      <div>
        <p className="label mb-3">Select Subject</p>
        <SubjectSelector
          subjects={subjects}
          selected={selectedSubject}
          onSelect={(name) => {
            setSelectedSubject(name);
            setCheckedTopics({});
            setActiveTab('topics');
          }}
        />
      </div>

      {/* Content */}
      {data && (
        <div className="card animate-slide-up">
          {/* Subject header + progress */}
          <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-txt-primary">{data.subjectName}</h2>
              <p className="text-xs text-txt-muted mt-0.5">Revision checklist</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-accent-amber">{readinessPct}%</p>
                <p className="text-[10px] text-txt-muted">readiness</p>
              </div>
              <div className="w-16 h-16 relative flex items-center justify-center">
                <svg viewBox="0 0 64 64" className="w-full h-full rotate-[-90deg]">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#1a2540" strokeWidth="7" />
                  <circle
                    cx="32" cy="32" r="26" fill="none" stroke="#f0a04b" strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={2 * Math.PI * 26 * (1 - readinessPct / 100)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                  />
                </svg>
                <span className="absolute text-[10px] font-mono text-accent-amber">{checkedCount}/{totalTopics}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-bg-muted rounded-xl p-1 mb-5">
            {['topics', 'formulas', 'questions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all duration-200 capitalize ${
                  activeTab === tab
                    ? 'bg-bg-card text-txt-primary shadow-sm'
                    : 'text-txt-muted hover:text-txt-secondary'
                }`}
              >
                {tab} {tab === 'topics' ? `(${totalTopics})` : tab === 'formulas' ? `(${data.formulas.length})` : `(${data.questions.length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'topics' && (
            <div className="space-y-2 animate-fade-in">
              {data.topics.map((topic) => (
                <div
                  key={topic}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    checkedTopics[topic]
                      ? 'bg-accent-green/5 border-accent-green/20 opacity-70'
                      : 'bg-bg-muted border-transparent hover:border-bg-border'
                  }`}
                  onClick={() => toggleTopic(topic)}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checkedTopics[topic] ? 'bg-accent-green border-accent-green' : 'border-bg-border'
                  }`}>
                    {checkedTopics[topic] && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <p className={`text-sm ${checkedTopics[topic] ? 'line-through text-txt-muted' : 'text-txt-primary'}`}>
                    {topic}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'formulas' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
              {data.formulas.map((f, i) => (
                <FormulaCard key={i} formula={f} />
              ))}
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs text-txt-muted mb-3">Click a question to mark it for self-review.</p>
              {data.questions.map((q, i) => (
                <QuestionCard key={i} question={q} idx={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {!data && selectedSubject && (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3 opacity-20">◆</p>
          <p className="text-txt-muted text-sm">No built-in exam data for this subject yet.</p>
          <p className="text-txt-muted text-xs mt-1">Add your own notes in the Notes tab for this subject.</p>
        </div>
      )}
    </div>
  );
}
