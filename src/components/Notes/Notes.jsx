import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { format } from 'date-fns';

function NoteEditor({ note, onSave, onCancel }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const taRef = useRef(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), content });
  };

  return (
    <div className="card border-accent-blue/30 animate-slide-up space-y-3">
      <input
        className="input text-base font-semibold"
        placeholder="Note title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        ref={taRef}
        className="input min-h-[200px] resize-y font-mono text-xs leading-relaxed"
        placeholder={`Write your notes here...\n\nTips:\n• Use formulas: E = mc²\n• List key points\n• Write example steps\n• Add questions to review later`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn-primary" onClick={handleSave}>Save Note</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete, isSelected, onSelect }) {
  return (
    <div
      className={`card card-hover cursor-pointer animate-fade-in ${isSelected ? 'border-accent-blue/40 bg-accent-blue/5' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-txt-primary text-sm truncate">{note.title}</p>
          <p className="text-xs text-txt-muted font-mono mt-0.5">
            {format(new Date(note.updatedAt), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            className="btn-ghost py-1 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >✏</button>
          <button
            className="btn-ghost py-1 px-2 text-xs hover:text-accent-red"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >✕</button>
        </div>
      </div>
      {note.content && (
        <p className="text-xs text-txt-muted mt-2 line-clamp-2 leading-relaxed font-mono">
          {note.content}
        </p>
      )}
    </div>
  );
}

export default function Notes() {
  const { subjects, notes, setNotes } = useApp();

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | note.id
  const [showTopicInput, setShowTopicInput] = useState(false);

  // notes structure: { [subjectId]: { [topicName]: [{ id, title, content, createdAt, updatedAt }] } }
  const subjectNotes = selectedSubject ? (notes[selectedSubject] || {}) : {};
  const topicNotes = selectedTopic ? (subjectNotes[selectedTopic] || []) : [];

  const addTopic = () => {
    if (!newTopicName.trim() || !selectedSubject) return;
    setNotes((prev) => ({
      ...prev,
      [selectedSubject]: {
        ...(prev[selectedSubject] || {}),
        [newTopicName.trim()]: (prev[selectedSubject]?.[newTopicName.trim()] || []),
      },
    }));
    setSelectedTopic(newTopicName.trim());
    setNewTopicName('');
    setShowTopicInput(false);
  };

  const deleteTopic = (topic) => {
    setNotes((prev) => {
      const updated = { ...prev[selectedSubject] };
      delete updated[topic];
      return { ...prev, [selectedSubject]: updated };
    });
    if (selectedTopic === topic) setSelectedTopic(null);
  };

  const saveNote = ({ title, content }) => {
    const now = new Date().toISOString();
    setNotes((prev) => {
      const subjNotes = prev[selectedSubject] || {};
      const topicList = subjNotes[selectedTopic] || [];
      let updated;
      if (editing === 'new') {
        updated = [...topicList, { id: Date.now().toString(), title, content, createdAt: now, updatedAt: now }];
      } else {
        updated = topicList.map((n) =>
          n.id === editing ? { ...n, title, content, updatedAt: now } : n
        );
      }
      return { ...prev, [selectedSubject]: { ...subjNotes, [selectedTopic]: updated } };
    });
    setEditing(null);
  };

  const deleteNote = (noteId) => {
    setNotes((prev) => {
      const updated = (prev[selectedSubject]?.[selectedTopic] || []).filter((n) => n.id !== noteId);
      return { ...prev, [selectedSubject]: { ...prev[selectedSubject], [selectedTopic]: updated } };
    });
    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  const selectedNote = topicNotes.find((n) => n.id === selectedNoteId);

  return (
    <div className="p-6 h-full animate-fade-in">
      <div className="flex gap-4 h-full min-h-[600px]">

        {/* Column 1: Subjects */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-2">
          <p className="label">Subjects</p>
          {subjects.length === 0 ? (
            <p className="text-xs text-txt-muted">Add subjects in Scheduler first.</p>
          ) : (
            subjects.map((s) => {
              const topicCount = Object.keys(notes[s.id] || {}).length;
              const noteCount = Object.values(notes[s.id] || {}).reduce((a, t) => a + t.length, 0);
              return (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSubject(s.id); setSelectedTopic(null); setSelectedNoteId(null); setEditing(null); }}
                  className={`text-left p-3 rounded-lg border transition-all duration-200 ${
                    selectedSubject === s.id
                      ? 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue'
                      : 'bg-bg-card border-bg-border text-txt-secondary hover:text-txt-primary hover:bg-bg-hover'
                  }`}
                >
                  <p className="text-xs font-semibold truncate">{s.name}</p>
                  <p className="text-[10px] font-mono mt-0.5 opacity-60">{topicCount} topics · {noteCount} notes</p>
                </button>
              );
            })
          )}
        </div>

        {/* Column 2: Topics */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="label">Topics</p>
            {selectedSubject && (
              <button className="text-[10px] text-accent-blue hover:underline cursor-pointer" onClick={() => setShowTopicInput(true)}>+ Add</button>
            )}
          </div>

          {showTopicInput && (
            <div className="flex gap-1">
              <input
                className="input text-xs py-1.5"
                placeholder="Topic name…"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                autoFocus
              />
              <button className="btn-primary text-xs px-2 py-1" onClick={addTopic}>✓</button>
            </div>
          )}

          {!selectedSubject ? (
            <p className="text-xs text-txt-muted">Select a subject first.</p>
          ) : Object.keys(subjectNotes).length === 0 ? (
            <p className="text-xs text-txt-muted">No topics yet. Add one above.</p>
          ) : (
            Object.keys(subjectNotes).map((topic) => {
              const count = subjectNotes[topic]?.length || 0;
              return (
                <button
                  key={topic}
                  onClick={() => { setSelectedTopic(topic); setSelectedNoteId(null); setEditing(null); }}
                  className={`group text-left p-3 rounded-lg border transition-all duration-200 ${
                    selectedTopic === topic
                      ? 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber'
                      : 'bg-bg-card border-bg-border text-txt-secondary hover:text-txt-primary hover:bg-bg-hover'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold truncate">{topic}</p>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-accent-red transition-all text-[10px]"
                      onClick={(e) => { e.stopPropagation(); deleteTopic(topic); }}
                    >✕</button>
                  </div>
                  <p className="text-[10px] font-mono mt-0.5 opacity-60">{count} notes</p>
                </button>
              );
            })
          )}
        </div>

        {/* Column 3: Notes list */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="label">Notes</p>
            {selectedTopic && (
              <button className="text-[10px] text-accent-blue hover:underline cursor-pointer" onClick={() => { setEditing('new'); setSelectedNoteId(null); }}>+ New</button>
            )}
          </div>

          {!selectedTopic ? (
            <p className="text-xs text-txt-muted">Select a topic first.</p>
          ) : topicNotes.length === 0 && editing !== 'new' ? (
            <div className="card text-center py-6">
              <p className="text-txt-muted text-xs">No notes yet.</p>
              <button className="btn-primary text-xs mt-2" onClick={() => setEditing('new')}>Create Note</button>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto">
              {topicNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isSelected={selectedNoteId === note.id}
                  onSelect={() => { setSelectedNoteId(note.id); setEditing(null); }}
                  onEdit={() => { setEditing(note.id); setSelectedNoteId(note.id); }}
                  onDelete={() => deleteNote(note.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Column 4: Note content / editor */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <NoteEditor
              note={editing === 'new' ? null : topicNotes.find((n) => n.id === editing)}
              onSave={saveNote}
              onCancel={() => setEditing(null)}
            />
          ) : selectedNote ? (
            <div className="card h-full animate-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-txt-primary">{selectedNote.title}</h2>
                  <p className="text-xs text-txt-muted font-mono mt-0.5">
                    Updated {format(new Date(selectedNote.updatedAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                <button className="btn-primary text-xs" onClick={() => setEditing(selectedNote.id)}>Edit</button>
              </div>
              <div className="border-t border-bg-border pt-4">
                <pre className="text-sm text-txt-secondary font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {selectedNote.content || <span className="text-txt-muted italic">No content.</span>}
                </pre>
              </div>
            </div>
          ) : (
            <div className="card h-full flex flex-col items-center justify-center text-center">
              <p className="text-4xl opacity-10 mb-3">◫</p>
              <p className="text-txt-muted text-sm">Select a note to read</p>
              <p className="text-txt-muted text-xs mt-1">or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
