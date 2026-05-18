import AsyncStorage from '@react-native-async-storage/async-storage';

const TASKS_KEY    = 'planner_tasks';
const SESSIONS_KEY = 'planner_sessions';
const SETTINGS_KEY = 'planner_settings';

export const DEFAULT_SETTINGS = {
  dailyGoalMinutes:       30,
  focusDuration:          25,
  shortBreakDuration:      5,
  longBreakDuration:      15,
  sessionsBeforeLongBreak: 4,
};

export const CATEGORIES = ['vocabulary', 'grammar', 'listening', 'pronunciation', 'revision'];

export const CATEGORY_META = {
  vocabulary:    { label: 'Vocabulary',    icon: 'book-outline',    bg: '#DBEAFE', text: '#2563EB' },
  grammar:       { label: 'Grammar',       icon: 'school-outline',  bg: '#EDE9FE', text: '#7C3AED' },
  listening:     { label: 'Listening',     icon: 'headset-outline', bg: '#D1FAE5', text: '#059669' },
  pronunciation: { label: 'Pronunciation', icon: 'mic-outline',     bg: '#FCE7F3', text: '#DB2777' },
  revision:      { label: 'Revision',      icon: 'refresh-outline', bg: '#FEF3C7', text: '#D97706' },
};

export const PRIORITY_META = {
  low:    { label: 'Low',    bg: '#D1FAE5', text: '#059669', dot: '#10B981' },
  medium: { label: 'Medium', bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B' },
  high:   { label: 'High',   bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' },
};

const uid = () => `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export const todayStr = () => new Date().toISOString().split('T')[0];

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function loadTasks() {
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function persistTasks(tasks) {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function addTask(partial) {
  const tasks = await loadTasks();
  const task = {
    id: uid(),
    title: '',
    category: 'vocabulary',
    priority: 'medium',
    estimatedMinutes: 25,
    date: todayStr(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
  await persistTasks([...tasks, task]);
  return task;
}

export async function updateTask(id, patch) {
  const tasks = await loadTasks();
  await persistTasks(tasks.map(t => (t.id === id ? { ...t, ...patch } : t)));
}

export async function deleteTask(id) {
  const tasks = await loadTasks();
  await persistTasks(tasks.filter(t => t.id !== id));
}

export async function toggleTask(id) {
  const tasks = await loadTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  await updateTask(id, {
    completed: !task.completed,
    completedAt: !task.completed ? new Date().toISOString() : null,
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function loadSessions() {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function recordSession(partial) {
  const sessions = await loadSessions();
  const session = {
    id: uid(),
    type: 'focus',
    durationMinutes: 25,
    taskId: null,
    completedAt: new Date().toISOString(),
    ...partial,
  };
  const trimmed = [session, ...sessions].slice(0, 120);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
  return session;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function loadPlannerSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export async function savePlannerSettings(patch) {
  const current = await loadPlannerSettings();
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }));
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

export function computeTodayStats(tasks, sessions) {
  const today = todayStr();
  const dayTasks    = tasks.filter(t => t.date === today);
  const daySessions = sessions.filter(s => s.completedAt.startsWith(today) && s.type === 'focus');
  const done        = dayTasks.filter(t => t.completed);
  return {
    totalTasks:     dayTasks.length,
    completedTasks: done.length,
    totalMinutes:   daySessions.reduce((a, s) => a + s.durationMinutes, 0),
    focusSessions:  daySessions.length,
    rate:           dayTasks.length ? Math.round((done.length / dayTasks.length) * 100) : 0,
  };
}

export function computeWeekData(tasks, sessions) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const date  = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    const mins  = sessions
      .filter(s => s.completedAt.startsWith(date) && s.type === 'focus')
      .reduce((a, s) => a + s.durationMinutes, 0);
    const completed = tasks.filter(t => t.date === date && t.completed).length;
    return { date, label, minutes: mins, completed, isToday: date === todayStr() };
  });
}

export function computeStreak(sessions) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const date      = d.toISOString().split('T')[0];
    const hasActivity = sessions.some(s => s.completedAt.startsWith(date) && s.type === 'focus');
    if (!hasActivity) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
