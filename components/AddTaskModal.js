import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, CATEGORY_META, PRIORITY_META, todayStr } from '../utils/plannerUtils';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const TIME_OPTIONS = [5, 10, 15, 25, 30, 45, 60];

export default function AddTaskModal({ visible, task, onSave, onClose }) {
  const { t, isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [title,              setTitle]              = useState('');
  const [category,           setCategory]           = useState('vocabulary');
  const [priority,           setPriority]           = useState('medium');
  const [estimatedMinutes,   setEstimatedMinutes]   = useState(25);
  const [error,              setError]              = useState('');

  const isEditing = !!task;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setCategory(task.category);
      setPriority(task.priority);
      setEstimatedMinutes(task.estimatedMinutes);
    } else {
      setTitle('');
      setCategory('vocabulary');
      setPriority('medium');
      setEstimatedMinutes(25);
    }
    setError('');
  }, [task, visible]);

  function handleSave() {
    if (!title.trim()) { setError(t('addTask.errorTitle')); return; }
    onSave({ title: title.trim(), category, priority, estimatedMinutes, date: todayStr() });
  }

  const catLabel  = (cat) => t(`addTask.categories.${cat}`) || CATEGORY_META[cat]?.label;
  const priLabel  = (pri) => t(`addTask.priorities.${pri}`) || PRIORITY_META[pri]?.label;

  const styles = useMemo(() => getStyles(c, isRTL, isDark), [c, isRTL, isDark]);

  // Dynamic style calculator for category chips
  const getCatChipStyle = (cat, active) => {
    const meta = CATEGORY_META[cat];
    if (!active) {
      return { backgroundColor: c.borderLight, borderColor: 'transparent' };
    }
    if (isDark) {
      return { backgroundColor: meta.text + '25', borderColor: meta.text };
    }
    return { backgroundColor: meta.bg, borderColor: meta.text };
  };

  const getCatTextColor = (cat, active) => {
    const meta = CATEGORY_META[cat];
    if (!active) return c.textSecondary;
    return meta.text;
  };

  // Dynamic style calculator for priority chips
  const getPriChipStyle = (p, active) => {
    const meta = PRIORITY_META[p];
    if (!active) {
      return { backgroundColor: c.borderLight, borderColor: c.border };
    }
    if (isDark) {
      return { backgroundColor: meta.text + '25', borderColor: meta.text };
    }
    return { backgroundColor: meta.bg, borderColor: meta.text };
  };

  const getPriTextColor = (p, active) => {
    const meta = PRIORITY_META[p];
    if (!active) return c.textSecondary;
    return meta.text;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isEditing ? t('addTask.editTitle') : t('addTask.newTitle')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Title input */}
            <Text style={[styles.label, isRTL && { textAlign: 'right' }]}>{t('addTask.taskLabel')}</Text>
            <TextInput
              style={[styles.input, !!error && styles.inputError, isRTL && { textAlign: 'right' }]}
              placeholder={t('addTask.taskPlaceholder')}
              placeholderTextColor={c.textPlaceholder}
              value={title}
              onChangeText={v => { setTitle(v); setError(''); }}
              autoFocus={!isEditing}
              maxLength={100}
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {/* Category */}
            <Text style={[styles.label, isRTL && { textAlign: 'right' }]}>{t('addTask.categoryLabel')}</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map(cat => {
                const meta = CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, getCatChipStyle(cat, active)]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={meta.icon} size={12} color={getCatTextColor(cat, active)} />
                    <Text style={[styles.chipText, { color: getCatTextColor(cat, active) }]}>
                      {catLabel(cat)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Priority */}
            <Text style={[styles.label, isRTL && { textAlign: 'right' }]}>{t('addTask.priorityLabel')}</Text>
            <View style={styles.priorityRow}>
              {['low', 'medium', 'high'].map(p => {
                const meta = PRIORITY_META[p];
                const active = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityChip, getPriChipStyle(p, active)]}
                    onPress={() => setPriority(p)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dot, { backgroundColor: active ? meta.dot : c.border }]} />
                    <Text style={[styles.priorityText, { color: getPriTextColor(p, active) }]}>
                      {priLabel(p)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Estimated time */}
            <Text style={[styles.label, isRTL && { textAlign: 'right' }]}>{t('addTask.timeLabel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRow}>
              {TIME_OPTIONS.map(min => {
                const active = estimatedMinutes === min;
                return (
                  <TouchableOpacity
                    key={min}
                    style={[styles.timeChip, active && styles.timeChipActive]}
                    onPress={() => setEstimatedMinutes(min)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                      {min}m
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ height: 24 }} />

            <TouchableOpacity onPress={handleSave} activeOpacity={0.85} style={styles.saveWrap}>
              <LinearGradient
                colors={c.primary === '#818CF8' ? ['#4338CA', '#9D174D'] : ['#6366F1', '#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Ionicons name={isEditing ? 'checkmark' : 'add'} size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{isEditing ? t('addTask.saveChanges') : t('addTask.addTaskBtn')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getStyles(c, isRTL, isDark) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      maxHeight: '88%',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 2,
    },
    input: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 15,
      color: c.textPrimary,
      marginBottom: 16,
      backgroundColor: c.inputBg,
    },
    inputError: {
      borderColor: c.error,
    },
    errorText: {
      fontSize: 12,
      color: c.error,
      marginTop: -12,
      marginBottom: 12,
      marginLeft: 4,
    },
    chipRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    chip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
    },
    priorityRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      marginBottom: 16,
    },
    priorityChip: {
      flex: 1,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1.5,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    priorityText: {
      fontSize: 13,
      fontWeight: '600',
    },
    timeRow: {
      marginBottom: 16,
      flexDirection: isRTL ? 'row-reverse' : 'row',
    },
    timeChip: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: c.borderLight,
      marginRight: isRTL ? 0 : 8,
      marginLeft: isRTL ? 8 : 0,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    timeChipActive: {
      backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#EEF2FF',
      borderColor: c.primary,
    },
    timeChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },
    timeChipTextActive: {
      color: c.primary,
    },
    saveWrap: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    saveBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 15,
      gap: 8,
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
