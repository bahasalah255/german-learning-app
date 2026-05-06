import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadNotificationSettings,
  applyNotificationSettings,
  saveNotificationSettings,
} from '../utils/notifications';
import { loadProgress } from '../utils/progress';

const APP_SETTINGS_KEY = 'appSettings';

const FREQ_OPTIONS = [
  { id: '5min',  label: 'Every 5 min' },
  { id: '30min', label: 'Every 30 min' },
  { id: 'daily', label: 'Daily' },
];

const DEFAULT_APP_SETTINGS = {
  dailyGoal:    5,
  quizLength:   5,
  soundEnabled: true,
};

function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(APP_SETTINGS_KEY).then((raw) => {
      if (raw) setSettings({ ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) });
    });
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, updateSetting };
}

export default function SettingsScreen() {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [frequency, setFrequency]       = useState('daily');
  const [permDenied, setPermDenied]     = useState(false);
  const [applying, setApplying]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [streak, setStreak]             = useState(0);

  const { settings, updateSetting } = useSettings();

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadNotificationSettings(), loadProgress()]).then(
        ([notifSettings, progress]) => {
          setNotifEnabled(notifSettings.enabled);
          setFrequency(notifSettings.frequency);
          setStreak(progress.streakCount);
          setLoading(false);
        }
      );
    }, [])
  );

  const applyAndSave = async (newEnabled, newFreq) => {
    setApplying(true);
    setPermDenied(false);
    const result = await applyNotificationSettings({ enabled: newEnabled, frequency: newFreq });
    if (result === 'denied') {
      setNotifEnabled(false);
      setPermDenied(true);
    } else if (result === 'scheduled') {
      setNotifEnabled(true);
      setPermDenied(false);
    }
    setApplying(false);
  };

  const handleToggle = async (value) => {
    setNotifEnabled(value);
    await applyAndSave(value, frequency);
  };

  const handleFrequency = async (id) => {
    if (id === frequency) return;
    setFrequency(id);
    if (notifEnabled) {
      await applyAndSave(true, id);
    } else {
      await saveNotificationSettings({ enabled: false, frequency: id });
    }
  };

  const showGoalPicker = () => {
    Alert.alert('Daily goal', 'How many words per day?', [
      { text: '3 words',  onPress: () => updateSetting('dailyGoal', 3) },
      { text: '5 words',  onPress: () => updateSetting('dailyGoal', 5) },
      { text: '10 words', onPress: () => updateSetting('dailyGoal', 10) },
      { text: '20 words', onPress: () => updateSetting('dailyGoal', 20) },
      { text: 'Cancel',   style: 'cancel' },
    ]);
  };

  const showQuizLengthPicker = () => {
    Alert.alert('Quiz length', 'How many questions per session?', [
      { text: '5 questions',  onPress: () => updateSetting('quizLength', 5) },
      { text: '10 questions', onPress: () => updateSetting('quizLength', 10) },
      { text: '15 questions', onPress: () => updateSetting('quizLength', 15) },
      { text: '20 questions', onPress: () => updateSetting('quizLength', 20) },
      { text: 'Cancel',       style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#EEEEFF" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7B61FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#EEEEFF" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ── */}
        <Text style={styles.pageTitle}>Settings</Text>

        {/* ── Profile card ── */}
        <LinearGradient
          colors={['#7B61FF', '#C850C0', '#FF6B9D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.profileCard}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>L</Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Lina</Text>
            <View style={styles.profileSubRow}>
              <Text style={styles.profileSub}>
                A1 · Beginner · {streak} day streak
              </Text>
              <Ionicons name="flame" size={14} color="#FF9500" style={styles.flameIcon} />
            </View>
          </View>

          <TouchableOpacity style={styles.profileArrow} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>

        {/* ════════════════ NOTIFICATIONS ════════════════ */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>

          {/* Daily reminders */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: '#FF9500' }]}>
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.rowCenter}>
              <Text style={styles.rowTitle}>Daily reminders</Text>
              <Text style={styles.rowSub}>Practice nudges & streak alerts</Text>
            </View>
            {applying ? (
              <ActivityIndicator size="small" color="#7B61FF" />
            ) : (
              <Switch
                value={notifEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: '#E0E0E8', true: '#4DBFA0' }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>

          <View style={styles.divider} />

          {/* Frequency */}
          <View style={styles.freqBlock}>
            <View style={styles.freqTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#FF6B9D' }]}>
                <Ionicons name="time-outline" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.rowCenter}>
                <Text style={styles.rowTitle}>Frequency</Text>
                <Text style={styles.rowSub}>How often you get nudged</Text>
              </View>
            </View>

            <View style={styles.segmented}>
              {FREQ_OPTIONS.map((opt) => {
                const active = opt.id === frequency;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => handleFrequency(opt.id)}
                    activeOpacity={0.7}
                    disabled={applying}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Permission denied banner */}
        {permDenied && (
          <TouchableOpacity
            style={styles.permBanner}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Ionicons name="warning" size={20} color="#D97706" />
            <View style={styles.permText}>
              <Text style={styles.permTitle}>Permission denied</Text>
              <Text style={styles.permBody}>
                Tap here to open Settings and allow notifications.
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ════════════════ LEARNING ════════════════ */}
        <Text style={styles.sectionLabel}>LEARNING</Text>
        <View style={styles.card}>

          {/* Daily goal */}
          <TouchableOpacity style={styles.row} onPress={showGoalPicker} activeOpacity={0.7}>
            <View style={[styles.iconBox, { backgroundColor: '#4A8FE8' }]}>
              <Ionicons name="trophy-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.rowCenter}>
              <Text style={styles.rowTitle}>Daily goal</Text>
            </View>
            <Text style={styles.rowValue}>{settings.dailyGoal} words</Text>
            <Ionicons name="chevron-forward" size={16} color="#C0C0CC" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Quiz length */}
          <TouchableOpacity style={styles.row} onPress={showQuizLengthPicker} activeOpacity={0.7}>
            <View style={[styles.iconBox, { backgroundColor: '#7B61FF' }]}>
              <Ionicons name="help-circle-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.rowCenter}>
              <Text style={styles.rowTitle}>Quiz length</Text>
            </View>
            <Text style={styles.rowValue}>{settings.quizLength} questions</Text>
            <Ionicons name="chevron-forward" size={16} color="#C0C0CC" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Sound effects */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: '#4DBFA0' }]}>
              <Ionicons name="musical-notes-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.rowCenter}>
              <Text style={styles.rowTitle}>Sound effects</Text>
              <Text style={styles.rowSub}>{settings.soundEnabled ? 'On' : 'Off'}</Text>
            </View>
            <Switch
              value={settings.soundEnabled}
              onValueChange={(v) => updateSetting('soundEnabled', v)}
              trackColor={{ false: '#E0E0E8', true: '#4DBFA0' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── Version ── */}
        <Text style={styles.version}>Lerne · v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEEEFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
  },

  /* Page title */
  pageTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 16,
    marginBottom: 20,
  },

  /* Profile card */
  profileCard: {
    height: 88,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  profileSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  flameIcon: {
    marginLeft: 4,
  },
  profileArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: '#9090A0',
    marginTop: 28,
    marginBottom: 10,
  },

  /* Card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },

  /* Row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },

  /* Divider */
  divider: {
    height: 0.5,
    backgroundColor: '#F0F0F8',
    marginLeft: 64,
  },

  /* Icon box */
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Row content */
  rowCenter: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  rowSub: {
    fontSize: 12,
    color: '#9090A0',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    color: '#9090A0',
  },

  /* Frequency block */
  freqBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  freqTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  /* Segmented control */
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F8',
    borderRadius: 50,
    padding: 3,
    marginTop: 12,
  },
  segment: {
    flex: 1,
    height: 34,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    color: '#9090A0',
  },
  segmentTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A2E',
  },

  /* Permission denied banner */
  permBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    gap: 12,
  },
  permText: {
    flex: 1,
  },
  permTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  permBody: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
  },

  /* Version */
  version: {
    fontSize: 13,
    color: '#C0C0CC',
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
});
