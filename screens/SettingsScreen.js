import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  Modal,
  TextInput,
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
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const APP_SETTINGS_KEY = 'appSettings';
const PROFILE_NAME_KEY = 'profileName';

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
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { theme, themeMode, setThemeMode } = useTheme();
  const c = theme.colors;

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [frequency, setFrequency]       = useState('daily');
  const [permDenied, setPermDenied]     = useState(false);
  const [applying, setApplying]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [streak, setStreak]             = useState(0);
  const [profileName, setProfileName]   = useState('Guest');
  const [editName, setEditName]         = useState('');
  const [editing, setEditing]           = useState(false);

  const { settings, updateSetting } = useSettings();

  const FREQ_OPTIONS = [
    { id: '5min',  label: t('settings.every5min') },
    { id: '30min', label: t('settings.every30min') },
    { id: 'daily', label: t('settings.daily') },
  ];

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

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PROFILE_NAME_KEY).then((raw) => {
      if (!active) return;
      if (raw) setProfileName(raw);
    });
    return () => {
      active = false;
    };
  }, []);

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
    const goalOptions = t('settings.goalOptions');
    const goalValues  = t('settings.goalValues');
    Alert.alert(t('settings.goalTitle'), t('settings.goalMsg'), [
      ...goalOptions.map((label, i) => ({
        text: label,
        onPress: () => updateSetting('dailyGoal', goalValues[i]),
      })),
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const showQuizLengthPicker = () => {
    const quizOptions = t('settings.quizOptions');
    const quizValues  = t('settings.quizValues');
    Alert.alert(t('settings.quizTitle'), t('settings.quizMsg'), [
      ...quizOptions.map((label, i) => ({
        text: label,
        onPress: () => updateSetting('quizLength', quizValues[i]),
      })),
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const styles = useMemo(() => getStyles(c, isRTL), [c, isRTL]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, isRTL && { textAlign: 'right' }]}>
          {t('settings.title')}
        </Text>

        <TouchableOpacity activeOpacity={0.85} onPress={() => { setEditName(profileName); setEditing(true); }}>
          <LinearGradient
            colors={['#1E40AF', '#2563EB', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{(profileName && profileName[0]) ? profileName[0].toUpperCase() : 'G'}</Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profileName || 'Guest'}</Text>
              <View style={[styles.profileSubRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.profileSub}>
                  A1 · {t('settings.level')} · {t('settings.dayStreak', { n: streak })}
                </Text>
                <Ionicons name="flame" size={14} color="#F59E0B" style={styles.flameIcon} />
              </View>
            </View>

            <View style={styles.profileArrow}>
              <Ionicons name="pencil" size={16} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <Modal visible={editing} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('settings.editName') || 'Edit profile name'}</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('settings.namePlaceholder') || 'Your name'}
                placeholderTextColor={c.textPlaceholder}
                maxLength={40}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalCancel]}
                  onPress={() => setEditing(false)}
                >
                  <Text style={styles.modalBtnText}>{t('common.cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalSave]}
                  onPress={async () => {
                    const next = (editName || '').trim() || 'Guest';
                    setProfileName(next);
                    await AsyncStorage.setItem(PROFILE_NAME_KEY, next);
                    setEditing(false);
                  }}
                >
                  <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>{t('common.save') || 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Appearance */}
        <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>
          {t('settings.appearance')}
        </Text>
        <View style={styles.card}>
          {[
            { mode: 'light', icon: 'sunny-outline', label: t('settings.lightMode'), color: '#F59E0B' },
            { mode: 'dark', icon: 'moon-outline', label: t('settings.darkMode'), color: '#3B82F6' },
            { mode: 'system', icon: 'settings-outline', label: t('settings.systemDefault'), color: '#64748B' },
          ].map((item, idx, arr) => (
            <React.Fragment key={item.mode}>
              <TouchableOpacity
                style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}
                onPress={() => setThemeMode(item.mode)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: themeMode === item.mode ? c.primary : c.cardAlt }]}>
                  <Ionicons name={item.icon} size={18} color={themeMode === item.mode ? '#FFFFFF' : item.color} />
                </View>
                <View style={styles.rowCenter}>
                  <Text style={[styles.rowTitle, isRTL && { textAlign: 'right' }]}>{item.label}</Text>
                </View>
                {themeMode === item.mode && (
                  <Ionicons name="checkmark-circle" size={20} color={c.primary} />
                )}
              </TouchableOpacity>
              {idx < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Language selector */}
        <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>
          {t('settings.appLanguage')}
        </Text>
        <View style={styles.card}>
          {[
            { code: 'ar', flag: '🇲🇦', label: 'العربية' },
            { code: 'fr', flag: '🇫🇷', label: 'Français' },
            { code: 'en', flag: '🇺🇸', label: 'English' },
          ].map((lang, idx, arr) => (
            <React.Fragment key={lang.code}>
              <TouchableOpacity
                style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}
                onPress={() => setLanguage(lang.code)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: language === lang.code ? c.primary : c.cardAlt }]}>
                  <Text style={styles.flagEmoji}>{lang.flag}</Text>
                </View>
                <View style={styles.rowCenter}>
                  <Text style={[styles.rowTitle, isRTL && { textAlign: 'right' }]}>{lang.label}</Text>
                </View>
                {language === lang.code && (
                  <Ionicons name="checkmark-circle" size={20} color={c.primary} />
                )}
              </TouchableOpacity>
              {idx < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Notifications */}
        <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>
          {t('settings.notifications')}
        </Text>
        <View style={styles.card}>
          <View style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.iconBox, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.rowCenter}>
              <Text style={[styles.rowTitle, isRTL && { textAlign: 'right' }]}>
                {t('settings.dailyReminders')}
              </Text>
              <Text style={[styles.rowSub, isRTL && { textAlign: 'right' }]}>
                {t('settings.remindersSub')}
              </Text>
            </View>
            {applying ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : (
              <Switch
                value={notifEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: c.switchTrackOff, true: c.switchTrackOn }}
                thumbColor={c.switchThumb}
              />
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.freqBlock}>
            <View style={[styles.freqTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.iconBox, { backgroundColor: '#3B82F6' }]}>
                <Ionicons name="time-outline" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.rowCenter}>
                <Text style={[styles.rowTitle, isRTL && { textAlign: 'right' }]}>
                  {t('settings.frequency')}
                </Text>
                <Text style={[styles.rowSub, isRTL && { textAlign: 'right' }]}>
                  {t('settings.frequencySub')}
                </Text>
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

        {permDenied && (
          <TouchableOpacity
            style={styles.permBanner}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Ionicons name="warning" size={20} color="#D97706" />
            <View style={styles.permText}>
              <Text style={styles.permTitle}>{t('settings.permDeniedTitle')}</Text>
              <Text style={styles.permBody}>
                {t('settings.permDeniedBody')}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Learning */}
        <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>
          {t('settings.learning')}
        </Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}
            onPress={showGoalPicker}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#2563EB' }]}>
              <Ionicons name="trophy-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.rowCenter}>
              <Text style={[styles.rowTitle, isRTL && { textAlign: 'right' }]}>
                {t('settings.dailyGoal')}
              </Text>
            </View>
            <Text style={styles.rowValue}>{settings.dailyGoal} {t('settings.dailyGoalValue') ? t('settings.dailyGoalValue').replace('{n}','') : 'words'}</Text>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={isRTL && { transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}
            onPress={showQuizLengthPicker}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="help-circle-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.rowCenter}>
              <Text style={[styles.rowTitle, isRTL && { textAlign: 'right' }]}>
                {t('settings.quizLength')}
              </Text>
            </View>
            <Text style={styles.rowValue}>{settings.quizLength} {t('settings.quizLengthValue') ? t('settings.quizLengthValue').replace('{n}','') : 'questions'}</Text>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={isRTL && { transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.iconBox, { backgroundColor: '#10B981' }]}>
              <Ionicons name="musical-notes-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.rowCenter}>
              <Text style={[styles.rowTitle, isRTL && { textAlign: 'right' }]}>
                {t('settings.soundEffects')}
              </Text>
              <Text style={[styles.rowSub, isRTL && { textAlign: 'right' }]}>
                {settings.soundEnabled ? t('common.on') : t('common.off')}
              </Text>
            </View>
            <Switch
              value={settings.soundEnabled}
              onValueChange={(v) => updateSetting('soundEnabled', v)}
              trackColor={{ false: c.switchTrackOff, true: c.switchTrackOn }}
              thumbColor={c.switchThumb}
            />
          </View>
        </View>

        <Text style={styles.version}>{t('settings.version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(c, isRTL) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 40,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: 20,
      letterSpacing: -0.3,
    },
    profileCard: {
      borderRadius: 24,
      padding: 20,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 5,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarLetter: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    profileInfo: {
      flex: 1,
      marginLeft: isRTL ? 0 : 14,
      marginRight: isRTL ? 14 : 0,
    },
    profileName: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
      textAlign: isRTL ? 'right' : 'left',
    },
    profileSubRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    profileSub: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '500',
    },
    flameIcon: {
      marginLeft: isRTL ? 0 : 4,
      marginRight: isRTL ? 4 : 0,
    },
    profileArrow: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.4,
      color: c.sectionLabel,
      marginTop: 28,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: 12,
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginLeft: isRTL ? 0 : 66,
      marginRight: isRTL ? 66 : 0,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    flagEmoji: {
      fontSize: 20,
    },
    rowCenter: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
    },
    rowSub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    rowValue: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textSecondary,
    },
    freqBlock: {
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    freqTopRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: c.segmentedBg,
      borderRadius: 14,
      padding: 4,
      marginTop: 14,
    },
    segment: {
      flex: 1,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: c.segmentActiveBg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.segmentText,
    },
    segmentTextActive: {
      fontSize: 13,
      fontWeight: '800',
      color: c.segmentActiveText,
    },
    permBanner: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: '#FEF3C7',
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      gap: 12,
    },
    permText: {
      flex: 1,
    },
    permTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: '#92400E',
      marginBottom: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    permBody: {
      fontSize: 13,
      color: '#B45309',
      lineHeight: 18,
      textAlign: isRTL ? 'right' : 'left',
    },
    version: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 32,
      marginBottom: 40,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: '88%',
      maxWidth: 360,
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 24,
      elevation: 10,
      borderWidth: 1.5,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: 16,
    },
    modalInput: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 20,
      backgroundColor: c.inputBg,
      color: c.inputText,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    modalBtn: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 12,
    },
    modalCancel: {
      backgroundColor: c.cardAlt,
    },
    modalSave: {
      backgroundColor: c.primary,
    },
    modalBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.textPrimary,
    },
  });
}
