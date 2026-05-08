import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../context/AppContext';
import { getUrgencyColor, getDifficultyColor, formatMinutes } from '../../utils/planner';
import { differenceInDays } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-card border border-bg-border rounded-lg px-3 py-2">
        <p className="text-xs text-txt-muted font-mono">{label}</p>
        <p className="text-sm font-bold text-accent-blue">{payload[0].value}m focus</p>
      </div>
    );
  }
  return null;
};

function StatCard({ label, value, sub, accent = 'blue' }) {
  const colors = {
    blue: 'text-accent-blue',
    amber: 'text-accent-amber',
    green: 'text-accent-green',
    purple: 'text-accent-purple',
  };
  return (
    <div className="card card-hover">
      <p className="label mb-3">{label}</p>
      <p className={`font-mono text-3xl font-bold ${colors[accent]} leading-none`}>{value}</p>
      {sub && <p className="text-xs text-txt-muted mt-2">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { subjects, studyPlan, weeklyData, todayMinutes, todaySessions, pomodoroStats } = useApp();

  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = studyPlan.flatMap((p) =>
    p.sessions.filter((s) => s.date === today).map((s) => ({ ...s, subjectName: p.subjectName, urgency: p.urgency }))
  );
  const completedToday = todayTasks.filter((t) => t.completed).length;

  const upcomingExams = subjects
    .map((s) => ({
      ...s,
      daysLeft: differenceInDays(new Date(s.examDate), new Date()),
    }))
    .filter((s) => s.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 4);

  const weekTotal = weeklyData.reduce((a, d) => a + d.minutes, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Focus" value={formatMinutes(todayMinutes)} sub={`${todaySessions} sessions completed`} accent="blue" />
        <StatCard label="This Week" value={formatMinutes(weekTotal)} sub="Total focused time" accent="amber" />
        <StatCard label="All-Time Sessions" value={pomodoroStats.totalSessions} sub="Pomodoro sessions done" accent="green" />
        <StatCard label="Subjects Tracked" value={subjects.length} sub={`${studyPlan.length} with study plans`} accent="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly chart */}
        <div className="card lg:col-span-2">
          <p className="label mb-4">Weekly Focus (minutes)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} barSize={22}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,156,249,0.05)' }} />
              <Bar dataKey="minutes" fill="#4f9cf9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming exams */}
        <div className="card">
          <p className="label mb-3">Upcoming Exams</p>
          {upcomingExams.length === 0 ? (
            <p className="text-sm text-txt-muted">No exams scheduled. Add subjects in Scheduler.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingExams.map((s) => {
                const plan = studyPlan.find((p) => p.subjectId === s.id);
                return (
                  <div key={s.id} className="bg-bg-muted rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-txt-primary truncate">{s.name}</p>
                      <span className={getUrgencyColor(plan?.urgency || 'low')}>
                        {s.daysLeft === 0 ? 'TODAY' : `${s.daysLeft}d`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className={getDifficultyColor(s.difficulty)}>{s.difficulty}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Today's sessions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="label">Today's Study Sessions</p>
          <span className="text-xs text-txt-muted font-mono">{completedToday}/{todayTasks.length} done</span>
        </div>
        {todayTasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-txt-muted text-sm">No sessions for today.</p>
            <p className="text-txt-muted text-xs mt-1">Generate a study plan in the Scheduler tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  task.completed
                    ? 'bg-accent-green/5 border-accent-green/20 opacity-60'
                    : 'bg-bg-muted border-bg-border'
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.completed ? 'bg-accent-green' : 'bg-accent-blue'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{task.subjectName}</p>
                  <p className="text-xs text-txt-muted font-mono">{task.duration}min session</p>
                </div>
                {task.completed && <span className="ml-auto text-accent-green text-xs">✓</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress per subject */}
      {studyPlan.length > 0 && (
        <div className="card">
          <p className="label mb-4">Subject Progress</p>
          <div className="space-y-3">
            {studyPlan.map((p) => {
              const done = p.sessions.filter((s) => s.completed).length;
              const total = p.sessions.length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={p.subjectId}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-txt-primary">{p.subjectName}</p>
                    <div className="flex items-center gap-2">
                      <span className={getUrgencyColor(p.urgency)}>{p.urgency}</span>
                      <span className="text-xs font-mono text-txt-muted">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-blue transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
