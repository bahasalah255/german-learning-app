import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sentences';

const CATEGORIES = [
  { id: 'Daily',  label: 'Daily',  sublabel: 'routine', color: '#D97706' },
  { id: 'Travel', label: 'Travel', sublabel: 'trips',   color: '#2563EB' },
  { id: 'Work',   label: 'Work',   sublabel: 'office',  color: '#7C3AED' },
  { id: 'School', label: 'School', sublabel: 'studies', color: '#059669' },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function shakeAnim(value) {
  Animated.sequence([
    Animated.timing(value, { toValue: 7,  duration: 55, useNativeDriver: true }),
    Animated.timing(value, { toValue: -7, duration: 55, useNativeDriver: true }),
    Animated.timing(value, { toValue: 5,  duration: 55, useNativeDriver: true }),
    Animated.timing(value, { toValue: -5, duration: 55, useNativeDriver: true }),
    Animated.timing(value, { toValue: 0,  duration: 55, useNativeDriver: true }),
  ]).start();
}

export default function AddSentenceScreen() {
  const navigation = useNavigation();

  const [category,    setCategory]    = useState(null);
  const [sentence,    setSentence]    = useState('');
  const [translation, setTranslation] = useState('');
  const [notes,       setNotes]       = useState('');
  const [focusedField,      setFocusedField]      = useState(null);
  const [sentenceError,     setSentenceError]     = useState(false);
  const [translationError,  setTranslationError]  = useState(false);
  const [categoryError,     setCategoryError]     = useState(false);
  const [saving, setSaving] = useState(false);

  const sentenceShake    = useRef(new Animated.Value(0)).current;
  const translationShake = useRef(new Animated.Value(0)).current;
  const categoryShake    = useRef(new Animated.Value(0)).current;

  const selectedCategory = CATEGORIES.find(c => c.id === category);

  const sentenceBorderColor = sentenceError
    ? '#EF4444'
    : focusedField === 'sentence' && selectedCategory
    ? selectedCategory.color
    : '#E8E8F0';

  const translationBorderColor = translationError ? '#EF4444' : '#E8E8F0';

  const handleSave = async () => {
    const trimmedSentence    = sentence.trim();
    const trimmedTranslation = translation.trim();
    let hasError = false;

    if (!category) {
      setCategoryError(true);
      shakeAnim(categoryShake);
      hasError = true;
    }
    if (!trimmedSentence) {
      setSentenceError(true);
      shakeAnim(sentenceShake);
      hasError = true;
    }
    if (!trimmedTranslation) {
      setTranslationError(true);
      shakeAnim(translationShake);
      hasError = true;
    }
    if (hasError) return;

    setSaving(true);
    try {
      const stored   = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      const newEntry = {
        id:          generateId(),
        sentence:    trimmedSentence,
        translation: trimmedTranslation,
        category,
        createdAt:   new Date().toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry, ...existing]));
      navigation.goBack();
    } catch {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#EEEEFF" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={18} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New sentence</Text>
          <View style={styles.headerRight} />
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title block */}
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>Add a new sentence</Text>
            <Text style={styles.pageSubtitle}>
              Pick a category — it helps organize your phrases.
            </Text>
          </View>

          {/* ── Category selector ── */}
          <Animated.View style={{ transform: [{ translateX: categoryShake }] }}>
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, categoryError && styles.labelError]}>
                CATEGORY
              </Text>
              <Text style={styles.sectionHint}>tap to choose</Text>
            </View>
            <View style={[styles.categoryRow, categoryError && styles.categoryRowError]}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      isSelected
                        ? { backgroundColor: cat.color, borderWidth: 0 }
                        : { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E8E8F0' },
                    ]}
                    onPress={() => { setCategory(cat.id); setCategoryError(false); }}
                    activeOpacity={0.8}
                  >
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                    <Text style={[
                      styles.categoryCardLabel,
                      { color: isSelected ? '#FFFFFF' : cat.color },
                    ]}>
                      {cat.label}
                    </Text>
                    <Text style={[
                      styles.categoryCardSublabel,
                      { color: isSelected ? 'rgba(255,255,255,0.8)' : '#9090A0' },
                    ]}>
                      {cat.sublabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Input fields ── */}
          <View style={styles.fieldsBlock}>
            {/* German sentence */}
            <Animated.View style={{ transform: [{ translateX: sentenceShake }] }}>
              <Text style={styles.fieldLabel}>GERMAN SENTENCE</Text>
              <TextInput
                style={[styles.input, styles.textArea, { borderColor: sentenceBorderColor }]}
                value={sentence}
                onChangeText={(t) => { setSentence(t); setSentenceError(false); }}
                onFocus={() => setFocusedField('sentence')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="sentences"
                returnKeyType="next"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder="e.g. Ich lerne jeden Tag Deutsch."
                placeholderTextColor="#C0C0D0"
              />
            </Animated.View>

            {/* Translation */}
            <Animated.View style={{ transform: [{ translateX: translationShake }] }}>
              <Text style={styles.fieldLabel}>TRANSLATION</Text>
              <TextInput
                style={[styles.input, { borderColor: translationBorderColor }]}
                value={translation}
                onChangeText={(t) => { setTranslation(t); setTranslationError(false); }}
                onFocus={() => setFocusedField('translation')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                returnKeyType="next"
                placeholder="e.g. I learn German every day."
                placeholderTextColor="#C0C0D0"
              />
            </Animated.View>

            {/* Notes — optional */}
            <View>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>NOTES</Text>
                <Text style={styles.fieldLabelOptional}> · optional</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea, { borderColor: '#E8E8F0' }]}
                value={notes}
                onChangeText={setNotes}
                onFocus={() => setFocusedField('notes')}
                onBlur={() => setFocusedField(null)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoCapitalize="sentences"
                placeholder="Grammar tip or usage context..."
                placeholderTextColor="#C0C0D0"
              />
            </View>
          </View>
        </ScrollView>

        {/* ── Sticky save button ── */}
        <View style={styles.saveContainer}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
            style={[styles.saveTouch, saving && { opacity: 0.7 }]}
          >
            <LinearGradient
              colors={['#7B61FF', '#C850C0', '#FF6B9D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              <Text style={styles.saveLabel}>
                {saving ? 'Saving…' : 'Save sentence'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#EEEEFF',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  headerRight: {
    width: 32,
  },

  /* Scroll */
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  /* Title */
  titleBlock: {
    marginTop: 24,
    marginBottom: 0,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#9090A0',
    marginTop: 6,
    lineHeight: 20,
  },

  /* Category selector */
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#9090A0',
  },
  labelError: {
    color: '#EF4444',
  },
  sectionHint: {
    fontSize: 11,
    color: '#9090A0',
    fontStyle: 'italic',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 16,
    padding: 4,
  },
  categoryRowError: {
    borderWidth: 2,
    borderColor: '#EF4444',
    padding: 4,
  },
  categoryCard: {
    flex: 1,
    height: 72,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryCardSublabel: {
    fontSize: 11,
    marginTop: 2,
  },

  /* Input fields */
  fieldsBlock: {
    marginTop: 24,
    gap: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#9090A0',
    marginBottom: 8,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  fieldLabelOptional: {
    fontSize: 11,
    color: '#9090A0',
    fontWeight: '400',
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A2E',
    borderWidth: 1.5,
  },
  textArea: {
    height: 88,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
  },

  /* Save button */
  saveContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  saveTouch: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  saveGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
