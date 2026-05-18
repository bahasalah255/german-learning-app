import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Animated, Dimensions, Alert, Vibration, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  loadTasks, loadSessions, loadPlannerSettings,
  addTask, updateTask, deleteTask, toggleTask, recordSession,
  CATEGORY_META, PRIORITY_META, CATEGORIES,
  computeTodayStats, computeWeekData, computeStreak,
  todayStr, DEFAULT_SETTINGS,
} from '../utils/plannerUtils';
import AddTaskModal from '../components/AddTaskModal';

const { width: W } = Dimensions.get('window');

const SECTIONS = [
  { key: 'dashboard', label: 'Today',  icon: 'sunny-outline'           },
  { key: 'tasks',     label: 'Tasks',  icon: 'checkmark-circle-outline' },
  { key: 'timer',     label: 'Focus',  icon: 'timer-outline'            },
  { key: 'stats',     label: 'Stats',  icon: 'bar-chart-outline'        },
];

const TIMER_COLORS = {
  focus: ['#6366F1', '#8B5CF6'],
  short: ['#10B981', '#059669'],
  long:  ['#3B82F6', '#1D4ED8'],
};

const TIMER_LABELS = { focus: 'FOCUS', short: 'SHORT BREAK', long: 'LONG BREAK' };

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtMin(m) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PlannerScreen() {
  const [section,      setSection]      = useState('dashboard');
  const [tasks,        setTasks]        = useState([]);
  const [sessions,     setSessions]     = useState([]);
  const [settings,     setSettings]     = useState(DEFAULT_SETTINGS);
  const [showModal,    setShowModal]    = useState(false);
  const [editingTask,  setEditingTask]  = useState(null);
  const [filterCat,    setFilterCat]    = useState('all');

  // Timer
  const [timerType,       setTimerType]       = useState('focus');
  const [timeLeft,        setTimeLeft]        = useState(DEFAULT_SETTINGS.focusDuration * 60);
  const [timerRunning,    setTimerRunning]    = useState(false);
  const [timerJustEnded,  setTimerJustEnded]  = useState(false);
  const [sessionCount,    setSessionCount]    = useState(0);
  const [selectedTaskId,  setSelectedTaskId]  = useState(null);

  const timerRef      = useRef(null);
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const pulseLoop     = useRef(null);

  // Keep refs for stale-closure-safe access inside timer callback
  const settingsRef     = useRef(settings);
  const timerTypeRef    = useRef(timerType);
  const sessionCountRef = useRef(sessionCount);
  const selectedTaskRef = useRef(selectedTaskId);
  useEffect(() => { settingsRef.current     = settings;     }, [settings]);
  useEffect(() => { timerTypeRef.current    = timerType;    }, [timerType]);
  useEffect(() => { sessionCountRef.current = sessionCount; }, [sessionCount]);
  useEffect(() => { selectedTaskRef.current = selectedTaskId; }, [selectedTaskId]);

  // ── Load ───────────────────────────────────────────────────────────────────

  useFocusEffect(useCallback(() => {
    loadAll();
  }, []));

  async function loadAll() {
    const [t, s, cfg] = await Promise.all([loadTasks(), loadSessions(), loadPlannerSettings()]);
    setTasks(t);
    setSessions(s);
    setSettings(cfg);
    setTimeLeft(cfg.focusDuration * 60);
  }

  // ── Timer logic ────────────────────────────────────────────────────────────

  function secondsFor(type) {
    const cfg = settingsRef.current;
    if (type === 'short') return cfg.shortBreakDuration * 60;
    if (type === 'long')  return cfg.longBreakDuration  * 60;
    return cfg.focusDuration * 60;
  }

  // Countdown
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!timerRunning) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerRunning(false);
          setTimerJustEnded(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  // Pulse animation
  useEffect(() => {
    if (timerRunning) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1100, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 1100, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [timerRunning]);

  // Handle timer completion (avoids stale closures)
  useEffect(() => {
    if (!timerJustEnded) return;
    setTimerJustEnded(false);
    onTimerDone();
  }, [timerJustEnded]);

  async function onTimerDone() {
    const type  = timerTypeRef.current;
    const cfg   = settingsRef.current;
    const count = sessionCountRef.current;
    const taskId = selectedTaskRef.current;

    if (Platform.OS === 'android') Vibration.vibrate([0, 300, 100, 300]);
    else                           Vibration.vibrate(300);

    if (type === 'focus') {
      const newCount = count + 1;
      setSessionCount(newCount);

      await recordSession({ type: 'focus', durationMinutes: cfg.focusDuration, taskId });
      const updated = await loadSessions();
      setSessions(updated);

      const nextType = newCount % cfg.sessionsBeforeLongBreak === 0 ? 'long' : 'short';
      setTimerType(nextType);
      setTimeLeft(secondsFor(nextType));

      sendNotif(
        'Focus session complete! 🎉',
        nextType === 'long' ? `Take a long break — ${cfg.longBreakDuration} min` : `Take a short break — ${cfg.shortBreakDuration} min`
      );
    } else {
      setTimerType('focus');
      setTimeLeft(cfg.focusDuration * 60);
      sendNotif('Break over! 💪', 'Time to focus again.');
    }
  }

  async function sendNotif(title, body) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      });
    } catch (_) {}
  }

  function startTimer() {
    if (timeLeft === 0) setTimeLeft(secondsFor(timerType));
    setTimerRunning(true);
  }

  function pauseTimer() { setTimerRunning(false); }

  function resetTimer() {
    setTimerRunning(false);
    setTimeLeft(secondsFor(timerType));
  }

  function switchType(type) {
    if (timerRunning) {
      Alert.alert('Timer Running', 'Stop the current session before switching?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch', style: 'destructive',
          onPress: () => {
            setTimerRunning(false);
            setTimerType(type);
            setTimeLeft(secondsFor(type));
          },
        },
      ]);
    } else {
      setTimerType(type);
      setTimeLeft(secondsFor(type));
    }
  }

  // ── Task CRUD ──────────────────────────────────────────────────────────────

  async function handleSaveTask(data) {
    if (editingTask) await updateTask(editingTask.id, data);
    else             await addTask(data);
    setTasks(await loadTasks());
    setShowModal(false);
    setEditingTask(null);
  }

  async function handleToggle(id) {
    await toggleTask(id);
    setTasks(await loadTasks());
  }

  function handleDelete(id) {
    Alert.alert('Delete Task', 'Remove this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteTask(id);
          setTasks(await loadTasks());
          if (selectedTaskId === id) setSelectedTaskId(null);
        },
      },
    ]);
  }

  function openAdd()        { setEditingTask(null); setShowModal(true); }
  function openEdit(task)   { setEditingTask(task); setShowModal(true); }

  // ── Derived ────────────────────────────────────────────────────────────────

  const todayStats  = computeTodayStats(tasks, sessions);
  const weekData    = computeWeekData(tasks, sessions);
  const streak      = computeStreak(sessions);
  const todayTasks  = tasks.filter(t => t.date === todayStr());
  const filteredTasks = filterCat === 'all'
    ? todayTasks
    : todayTasks.filter(t => t.category === filterCat);

  const totalSec    = secondsFor(timerType);
  const timerPct    = totalSec > 0 ? (totalSec - timeLeft) / totalSec : 0;
  const timerColors = TIMER_COLORS[timerType];

  // ── Dashboard ──────────────────────────────────────────────────────────────

  function renderDashboard() {
    const goalPct  = settings.dailyGoalMinutes > 0
      ? Math.min(todayStats.totalMinutes / settings.dailyGoalMinutes, 1)
      : 0;
    const goalPctDisplay = Math.round(goalPct * 100);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>

        {/* Hero */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroDate}>
                {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              <Text style={styles.heroTitle}>Today's Plan</Text>
            </View>
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={13} color="#FFFFFF" />
              <Text style={styles.streakBadgeText}> {streak}d streak</Text>
            </View>
          </View>

          <View style={styles.goalRow}>
            <View>
              <Text style={styles.goalLabel}>Daily goal</Text>
              <Text style={styles.goalValue}>
                {fmtMin(todayStats.totalMinutes)} / {fmtMin(settings.dailyGoalMinutes)}
              </Text>
            </View>
            <Text style={styles.goalPct}>{goalPctDisplay}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${goalPctDisplay}%` }]} />
          </View>
        </LinearGradient>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          {[
            { icon: 'checkmark-circle', label: 'Done',     value: `${todayStats.completedTasks}/${todayStats.totalTasks}`, color: '#6366F1' },
            { icon: 'timer',            label: 'Time',     value: fmtMin(todayStats.totalMinutes),                         color: '#8B5CF6' },
            { icon: 'leaf',             label: 'Sessions', value: String(todayStats.focusSessions),                        color: '#EC4899' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                <Ionicons name={s.icon} size={16} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Today tasks preview */}
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          <TouchableOpacity onPress={() => setSection('tasks')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {todayTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color="#D1D5DB" />
            <Text style={styles.emptyText}>No tasks for today</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
              <Text style={styles.emptyAddText}>+ Add a task</Text>
            </TouchableOpacity>
          </View>
        ) : (
          todayTasks.slice(0, 4).map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onEdit={openEdit}
              onDelete={handleDelete}
              compact
            />
          ))
        )}

        {/* Quick focus */}
        <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 10 }]}>Quick Focus</Text>
        <TouchableOpacity
          style={styles.quickFocusCard}
          onPress={() => setSection('timer')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={timerRunning ? timerColors : ['#F3F4F6', '#EBEBEB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.quickFocusInner}
          >
            <View style={styles.quickFocusLeft}>
              <Ionicons
                name={timerRunning ? 'pause-circle' : 'play-circle'}
                size={34}
                color={timerRunning ? '#FFFFFF' : '#6366F1'}
              />
              <View>
                <Text style={[styles.quickFocusTitle, timerRunning && { color: '#FFFFFF' }]}>
                  {timerRunning ? 'Session in progress' : 'Start Pomodoro'}
                </Text>
                <Text style={[styles.quickFocusSub, timerRunning && { color: 'rgba(255,255,255,0.75)' }]}>
                  {timerRunning
                    ? fmt(timeLeft) + ' remaining · ' + TIMER_LABELS[timerType]
                    : `${settings.focusDuration} min focus session`}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={timerRunning ? '#FFFFFF' : '#9CA3AF'} />
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  function renderTasks() {
    const sorted = [...filteredTasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const ord = { high: 0, medium: 1, low: 2 };
      return ord[a.priority] - ord[b.priority];
    });

    return (
      <View style={{ flex: 1 }}>
        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          style={styles.filterScroll}
        >
          {[{ key: 'all', label: 'All' }, ...CATEGORIES.map(c => ({ key: c, label: CATEGORY_META[c].label }))].map(({ key, label }) => {
            const active = filterCat === key;
            const meta   = CATEGORY_META[key];
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.filterChip,
                  active && (meta ? { backgroundColor: meta.bg, borderColor: meta.text } : styles.filterChipActiveDefault),
                ]}
                onPress={() => setFilterCat(key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterChipText,
                  active && { color: meta ? meta.text : '#6366F1' },
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={52} color="#E5E7EB" />
            <Text style={styles.emptyStateTitle}>
              {filterCat === 'all' ? 'No tasks for today' : `No ${CATEGORY_META[filterCat]?.label} tasks`}
            </Text>
            <Text style={styles.emptyStateSub}>Tap + to add your first task</Text>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.taskListPad}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TaskRow
                task={item}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            )}
          />
        )}

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
          <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.fabInner}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Timer ──────────────────────────────────────────────────────────────────

  function renderTimer() {
    const focusTasks      = todayTasks.filter(t => !t.completed);
    const progressWidth   = timerPct * (W - 48);
    const todaySessions   = sessions.filter(
      s => s.completedAt.startsWith(todayStr()) && s.type === 'focus'
    );

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.timerPad}
      >
        {/* Session dots */}
        <View style={styles.sessionDotsRow}>
          {Array.from({ length: settings.sessionsBeforeLongBreak }, (_, i) => (
            <View
              key={i}
              style={[
                styles.sessionDot,
                i < (sessionCount % settings.sessionsBeforeLongBreak) && styles.sessionDotDone,
              ]}
            />
          ))}
          <Text style={styles.sessionCountLabel}>
            Session {sessionCount % settings.sessionsBeforeLongBreak + 1}
          </Text>
        </View>

        {/* Timer circle */}
        <Animated.View style={[styles.timerShadow, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={timerColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.timerCircle}
          >
            <Text style={styles.timerTime}>{fmt(timeLeft)}</Text>
            <Text style={styles.timerTypeLabel}>{TIMER_LABELS[timerType]}</Text>
          </LinearGradient>
        </Animated.View>

        {/* Progress bar */}
        <View style={styles.timerProgressTrack}>
          <View
            style={[
              styles.timerProgressFill,
              { width: progressWidth, backgroundColor: timerColors[0] },
            ]}
          />
        </View>

        {/* Type selector */}
        <View style={styles.typeRow}>
          {[
            { key: 'focus', label: 'Focus',       dur: settings.focusDuration },
            { key: 'short', label: 'Short Break',  dur: settings.shortBreakDuration },
            { key: 'long',  label: 'Long Break',   dur: settings.longBreakDuration },
          ].map(({ key, label, dur }) => (
            <TouchableOpacity
              key={key}
              style={[styles.typeChip, timerType === key && styles.typeChipActive]}
              onPress={() => switchType(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeLabel, timerType === key && styles.typeLabelActive]}>
                {label}
              </Text>
              <Text style={[styles.typeDur, timerType === key && { color: '#6366F1' }]}>
                {dur}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Controls */}
        <View style={styles.timerControls}>
          <TouchableOpacity style={styles.controlBtn} onPress={resetTimer}>
            <Ionicons name="refresh" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity onPress={timerRunning ? pauseTimer : startTimer} activeOpacity={0.85}>
            <LinearGradient
              colors={timerRunning ? ['#EF4444', '#DC2626'] : timerColors}
              style={styles.mainControlBtn}
            >
              <Ionicons name={timerRunning ? 'pause' : 'play'} size={34} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => switchType(timerType === 'focus' ? 'short' : 'focus')}
          >
            <Ionicons name="play-skip-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Linked task */}
        {focusTasks.length > 0 && (
          <>
            <Text style={styles.subLabel}>LINKED TASK</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.linkedTaskScroll}
            >
              <TouchableOpacity
                style={[styles.linkedChip, !selectedTaskId && styles.linkedChipActive]}
                onPress={() => setSelectedTaskId(null)}
              >
                <Text style={[styles.linkedChipText, !selectedTaskId && { color: '#6366F1' }]}>
                  Free focus
                </Text>
              </TouchableOpacity>
              {focusTasks.map(t => {
                const m      = CATEGORY_META[t.category];
                const active = selectedTaskId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.linkedChip, active && { backgroundColor: m.bg, borderColor: m.text }]}
                    onPress={() => setSelectedTaskId(t.id)}
                  >
                    <Text
                      style={[styles.linkedChipText, active && { color: m.text }]}
                      numberOfLines={1}
                    >
                      {t.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Today sessions */}
        {todaySessions.length > 0 && (
          <>
            <Text style={styles.subLabel}>TODAY'S SESSIONS</Text>
            {todaySessions.slice(0, 5).map(s => (
              <View key={s.id} style={styles.sessionHistRow}>
                <View style={styles.sessionHistIcon}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                </View>
                <Text style={styles.sessionHistText}>
                  {s.durationMinutes} min focus ·{' '}
                  {new Date(s.completedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  function renderStats() {
    const week        = weekData;
    const maxMin      = Math.max(...week.map(d => d.minutes), 1);
    const weekMin     = week.reduce((a, d) => a + d.minutes, 0);
    const weekSess    = sessions.filter(s => {
      const since = new Date(); since.setDate(since.getDate() - 6);
      return new Date(s.completedAt) >= since && s.type === 'focus';
    }).length;

    const catData = CATEGORIES.map(cat => {
      const mins = sessions.filter(s => {
        const task = tasks.find(t => t.id === s.taskId);
        return task?.category === cat && s.type === 'focus';
      }).reduce((a, s) => a + s.durationMinutes, 0);
      return { cat, mins };
    }).filter(c => c.mins > 0).sort((a, b) => b.mins - a.mins);

    const totalCatMin = catData.reduce((a, c) => a + c.mins, 0) || 1;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>

        {/* Summary banner */}
        <LinearGradient colors={['#1E1B4B', '#3730A3']} style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>THIS WEEK</Text>
          <View style={styles.summaryRow}>
            {[
              { val: fmtMin(weekMin), lbl: 'Study time' },
              { val: String(weekSess), lbl: 'Sessions' },
              { val: String(streak),  lbl: 'Day streak' },
            ].map((item, i) => (
              <React.Fragment key={item.lbl}>
                {i > 0 && <View style={styles.summaryDivider} />}
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryVal}>{item.val}</Text>
                  <Text style={styles.summaryLbl}>{item.lbl}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </LinearGradient>

        {/* Weekly bar chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Activity</Text>
          <View style={styles.barChart}>
            {week.map(day => (
              <View key={day.date} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max((day.minutes / maxMin) * 100, day.minutes > 0 ? 8 : 0)}%`,
                        backgroundColor: day.isToday ? '#6366F1' : '#C7D2FE',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, day.isToday && styles.barLabelToday]}>
                  {day.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Today progress */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Progress</Text>
          <View style={styles.todayRow}>
            {[
              { val: String(todayStats.completedTasks), lbl: 'Completed' },
              { val: String(todayStats.totalTasks),     lbl: 'Total'     },
              { val: `${todayStats.rate}%`,             lbl: 'Done'      },
            ].map(item => (
              <View key={item.lbl} style={styles.todayItem}>
                <Text style={styles.todayVal}>{item.val}</Text>
                <Text style={styles.todayLbl}>{item.lbl}</Text>
              </View>
            ))}
          </View>
          <View style={styles.rateTrack}>
            <LinearGradient
              colors={['#6366F1', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.rateFill, { width: `${todayStats.rate}%` }]}
            />
          </View>
        </View>

        {/* Category breakdown */}
        {catData.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>By Category</Text>
            {catData.map(({ cat, mins }) => {
              const m   = CATEGORY_META[cat];
              const pct = Math.round((mins / totalCatMin) * 100);
              return (
                <View key={cat} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: m.text }]} />
                  <Text style={styles.catName}>{m.label}</Text>
                  <View style={styles.catBarTrack}>
                    <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: m.text }]} />
                  </View>
                  <Text style={styles.catTime}>{fmtMin(mins)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {catData.length === 0 && sessions.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={32} color="#D1D5DB" />
            <Text style={styles.emptyText}>No data yet</Text>
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 2 }]}>
              Complete a focus session to see stats
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Planner</Text>
        {section === 'tasks' && (
          <TouchableOpacity style={styles.headerAddBtn} onPress={openAdd}>
            <Ionicons name="add" size={22} color="#6366F1" />
          </TouchableOpacity>
        )}
      </View>

      {/* Section tabs */}
      <View style={styles.tabs}>
        {SECTIONS.map(s => {
          const active = section === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setSection(s.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={s.icon} size={14} color={active ? '#6366F1' : '#9CA3AF'} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {section === 'dashboard' && renderDashboard()}
        {section === 'tasks'     && renderTasks()}
        {section === 'timer'     && renderTimer()}
        {section === 'stats'     && renderStats()}
      </View>

      <AddTaskModal
        visible={showModal}
        task={editingTask}
        onSave={handleSaveTask}
        onClose={() => { setShowModal(false); setEditingTask(null); }}
      />
    </SafeAreaView>
  );
}

// ── TaskRow component ─────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onEdit, onDelete, compact = false }) {
  const cat = CATEGORY_META[task.category];
  const pri = PRIORITY_META[task.priority];

  return (
    <TouchableOpacity
      style={[styles.taskRow, task.completed && styles.taskRowDone, compact && styles.taskRowCompact]}
      onPress={() => onEdit(task)}
      onLongPress={() => onDelete(task.id)}
      activeOpacity={0.72}
    >
      <TouchableOpacity
        style={[styles.checkbox, task.completed && styles.checkboxDone]}
        onPress={() => onToggle(task.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {task.completed && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
      </TouchableOpacity>

      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={[styles.taskTitle, task.completed && styles.taskTitleDone]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        {!compact && (
          <View style={styles.taskMeta}>
            <View style={[styles.catBadge, { backgroundColor: cat?.bg }]}>
              <Text style={[styles.catBadgeText, { color: cat?.text }]}>{cat?.label}</Text>
            </View>
            <View style={[styles.priDot, { backgroundColor: pri?.dot }]} />
            <Text style={styles.taskEst}>{task.estimatedMinutes}m</Text>
          </View>
        )}
      </View>

      {!compact && (
        <TouchableOpacity onPress={() => onDelete(task.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={15} color="#D1D5DB" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.3,
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#6366F1',
    fontWeight: '700',
  },

  scrollPad: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Hero card
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  heroDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 3,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  streakBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  goalLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 2,
  },
  goalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  goalPct: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },

  // Empty card (dashboard)
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyAddBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
  },
  emptyAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },

  // Quick focus
  quickFocusCard: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  quickFocusInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  quickFocusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  quickFocusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  quickFocusSub: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Tasks section
  filterScroll: { maxHeight: 50 },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterChipActiveDefault: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  taskListPad: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 80,
    gap: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 4,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#D1D5DB',
  },

  // Task row
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  taskRowDone: { opacity: 0.55 },
  taskRowCompact: { padding: 12, marginBottom: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  priDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskEst: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  deleteBtn: { padding: 4 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  fabInner: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Timer section
  timerPad: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: 'center',
  },
  sessionDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  sessionDotDone: {
    backgroundColor: '#6366F1',
  },
  sessionCountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 6,
  },
  timerShadow: {
    ...Platform.select({
      ios:     { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.35, shadowRadius: 24 },
      android: { elevation: 16 },
    }),
    marginBottom: 24,
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTime: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  timerTypeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 2,
    marginTop: 4,
  },
  timerProgressTrack: {
    width: W - 48,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  timerProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
    width: W - 48,
  },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 1,
  },
  typeChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.2,
  },
  typeLabelActive: { color: '#6366F1' },
  typeDur: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 28,
    width: W - 48,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainControlBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  linkedTaskScroll: {
    gap: 8,
    paddingBottom: 4,
    marginBottom: 16,
  },
  linkedChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
    maxWidth: 160,
  },
  linkedChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  linkedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  sessionHistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    width: W - 48,
  },
  sessionHistIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionHistText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },

  // Stats section
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  summaryEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  summaryVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  summaryLbl: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 14,
  },
  barChart: {
    flexDirection: 'row',
    height: 80,
    gap: 6,
    alignItems: 'flex-end',
  },
  barCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 0,
  },
  barLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  barLabelToday: {
    color: '#6366F1',
    fontWeight: '700',
  },
  todayRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  todayItem: {
    flex: 1,
    alignItems: 'center',
  },
  todayVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  todayLbl: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
  },
  rateTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  rateFill: {
    height: 6,
    borderRadius: 3,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    width: 94,
  },
  catBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catBarFill: {
    height: 5,
    borderRadius: 3,
    opacity: 0.75,
  },
  catTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    width: 36,
    textAlign: 'right',
  },
});
