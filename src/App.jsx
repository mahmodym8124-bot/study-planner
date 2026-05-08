import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import Scheduler from './components/Scheduler/Scheduler';
import Pomodoro from './components/Pomodoro/Pomodoro';
import Notes from './components/Notes/Notes';
import ExamMode from './components/ExamMode/ExamMode';

function AppShell() {
  const { activeView } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const views = {
    dashboard: <Dashboard />,
    scheduler: <Scheduler />,
    pomodoro: <Pomodoro />,
    notes: <Notes />,
    exam: <ExamMode />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed lg:relative z-30 lg:z-auto h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center px-4 py-3 border-b border-bg-border bg-bg-card">
          <button className="text-txt-secondary hover:text-txt-primary mr-3 text-lg" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <span className="text-sm font-bold text-txt-primary">Engineer Study Planner</span>
        </div>
        <Header activeView={activeView} />
        <main className="flex-1 overflow-y-auto grid-bg">
          {views[activeView] || views.dashboard}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
