import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, CATEGORY_META, PRIORITY_META, todayStr } from '../utils/plannerUtils';

const TIME_OPTIONS = [5, 10, 15, 25, 30, 45, 60];

export default function AddTaskModal({ visible, task, onSave, onClose }) {
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
    if (!title.trim()) { setError('Please enter a task title'); return; }
    onSave({ title: title.trim(), category, priority, estimatedMinutes, date: todayStr() });
  }

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
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Task' : 'New Task'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Title input */}
            <Text style={styles.label}>TASK</Text>
            <TextInput
              style={[styles.input, !!error && styles.inputError]}
              placeholder="e.g. Learn 10 new adjectives..."
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={v => { setTitle(v); setError(''); }}
              autoFocus={!isEditing}
              maxLength={100}
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {/* Category */}
            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map(cat => {
                const m      = CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && { backgroundColor: m.bg, borderColor: m.text }]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={m.icon} size={12} color={active ? m.text : '#9CA3AF'} />
                    <Text style={[styles.chipText, { color: active ? m.text : '#9CA3AF' }]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Priority */}
            <Text style={styles.label}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              {['low', 'medium', 'high'].map(p => {
                const m      = PRIORITY_META[p];
                const active = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityChip, active && { backgroundColor: m.bg, borderColor: m.text }]}
                    onPress={() => setPriority(p)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dot, { backgroundColor: active ? m.dot : '#D1D5DB' }]} />
                    <Text style={[styles.priorityText, { color: active ? m.text : '#9CA3AF' }]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Estimated time */}
            <Text style={styles.label}>ESTIMATED TIME</Text>
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
                colors={['#6366F1', '#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Ionicons name={isEditing ? 'checkmark' : 'add'} size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Task'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
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
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  timeChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  timeChipTextActive: {
    color: '#6366F1',
  },
  saveWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveBtn: {
    flexDirection: 'row',
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
