import React, { useState, useRef, useMemo } from 'react';
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
import { refreshScheduledNotificationsIfEnabled } from '../utils/notifications';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const STORAGE_KEY = 'words';

const ARTICLES = [
  { id: 'der',    label: 'der', sublabel: 'masc.',  color: '#4A8FE8' },
  { id: 'die',    label: 'die', sublabel: 'fem.',   color: '#E8706A' },
  { id: 'das',    label: 'das', sublabel: 'neut.',  color: '#4DBFA0' },
  { id: 'plural', label: 'die', sublabel: 'plural', color: '#7C3AED' },
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

export default function AddWordScreen() {
  const navigation = useNavigation();
  const { t, isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [article,     setArticle]     = useState(null);
  const [word,        setWord]        = useState('');
  const [translation, setTranslation] = useState('');
  const [example,     setExample]     = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [wordError,        setWordError]        = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const [articleError,     setArticleError]     = useState(false);
  const [saving, setSaving] = useState(false);

  const wordShake        = useRef(new Animated.Value(0)).current;
  const translationShake = useRef(new Animated.Value(0)).current;
  const articleShake     = useRef(new Animated.Value(0)).current;

  const selectedArticle = ARTICLES.find(a => a.id === article);

  const wordBorderColor = wordError
    ? c.error
    : focusedField === 'word'
    ? (selectedArticle ? selectedArticle.color : c.primary)
    : c.border;

  const translationBorderColor = translationError
    ? c.error
    : focusedField === 'translation' ? c.primary : c.border;

  const exampleBorderColor = focusedField === 'example' ? c.primary : c.border;

  const handleSave = async () => {
    const trimmedWord        = word.trim();
    const trimmedTranslation = translation.trim();
    let hasError = false;

    if (!article) {
      setArticleError(true);
      shakeAnim(articleShake);
      hasError = true;
    }
    if (!trimmedWord) {
      setWordError(true);
      shakeAnim(wordShake);
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
      
      const isPlurSelection = article === 'plural';
      const newEntry = {
        id:          generateId(),
        word:        trimmedWord,
        translation: trimmedTranslation,
        article:     isPlurSelection ? 'die' : article,
        is_plural:   isPlurSelection ? true : undefined,
        createdAt:   new Date().toISOString(),
        ...(example.trim() ? { example: example.trim() } : {}),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry, ...existing]));
      await refreshScheduledNotificationsIfEnabled();
      navigation.goBack();
    } catch {
      setSaving(false);
    }
  };

  const styles = useMemo(() => getStyles(c, isRTL, isDark), [c, isRTL, isDark]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('addWord.headerTitle')}</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Scrollable content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title block */}
          <View style={styles.titleBlock}>
            <Text style={[styles.pageTitle, isRTL && { textAlign: 'right' }]}>
              {t('addWord.pageTitle')}
            </Text>
            <Text style={[styles.pageSubtitle, isRTL && { textAlign: 'right' }]}>
              {t('addWord.pageSubtitle')}
            </Text>
          </View>

          {/* Article selector */}
          <Animated.View style={{ transform: [{ translateX: articleShake }] }}>
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, articleError && styles.labelError]}>
                {t('addWord.articleLabel')}
              </Text>
              <Text style={styles.sectionHint}>{t('addWord.tapToChoose')}</Text>
            </View>
            <View style={[styles.articleRow, articleError && styles.articleRowError]}>
              {ARTICLES.map((art) => {
                const isSelected = article === art.id;
                return (
                  <TouchableOpacity
                    key={art.id}
                    style={[
                      styles.articleCard,
                      isSelected
                        ? { backgroundColor: art.color, borderWidth: 0 }
                        : { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border },
                    ]}
                    onPress={() => { setArticle(art.id); setArticleError(false); }}
                    activeOpacity={0.8}
                  >
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                    <Text style={[
                      styles.articleCardLabel,
                      { color: isSelected ? '#FFFFFF' : art.color },
                    ]}>
                      {art.label}
                    </Text>
                    <Text style={[
                      styles.articleCardSublabel,
                      { color: isSelected ? 'rgba(255,255,255,0.8)' : c.textSecondary },
                    ]}>
                      {art.sublabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Input fields */}
          <View style={styles.fieldsBlock}>
            {/* German word */}
            <Animated.View style={{ transform: [{ translateX: wordShake }] }}>
              <Text style={[styles.fieldLabel, isRTL && { textAlign: 'right' }]}>
                {t('addWord.germanWordLabel')}
              </Text>
              <TextInput
                style={[styles.input, { borderColor: wordBorderColor }, isRTL && { textAlign: 'right' }]}
                value={word}
                onChangeText={(txt) => { setWord(txt); setWordError(false); }}
                onFocus={() => setFocusedField('word')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="words"
                returnKeyType="next"
                placeholderTextColor={c.textPlaceholder}
              />
            </Animated.View>

            {/* Translation */}
            <Animated.View style={{ transform: [{ translateX: translationShake }] }}>
              <Text style={[styles.fieldLabel, isRTL && { textAlign: 'right' }]}>
                {t('addWord.translationLabel')}
              </Text>
              <TextInput
                style={[styles.input, { borderColor: translationBorderColor }, isRTL && { textAlign: 'right' }]}
                value={translation}
                onChangeText={(txt) => { setTranslation(txt); setTranslationError(false); }}
                onFocus={() => setFocusedField('translation')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                returnKeyType="next"
                placeholder={t('addWord.translationHint')}
                placeholderTextColor={c.textPlaceholder}
              />
            </Animated.View>

            {/* Example */}
            <View>
              <View style={[styles.fieldLabelRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={[styles.fieldLabel, isRTL && { textAlign: 'right' }]}>
                  {t('addWord.exampleLabel')}
                </Text>
                <Text style={styles.fieldLabelOptional}> · {t('common.optional')}</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea, { borderColor: exampleBorderColor }, isRTL && { textAlign: 'right' }]}
                value={example}
                onChangeText={setExample}
                onFocus={() => setFocusedField('example')}
                onBlur={() => setFocusedField(null)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoCapitalize="sentences"
                placeholder={t('addWord.exampleHint')}
                placeholderTextColor={c.textPlaceholder}
              />
            </View>
          </View>
        </ScrollView>

        {/* Sticky save button */}
        <View style={styles.saveContainer}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
            style={[styles.saveTouch, saving && { opacity: 0.7 }]}
          >
            <LinearGradient
              colors={c.primary === '#818CF8' ? ['#4338CA', '#9D174D'] : ['#7B61FF', '#C850C0', '#FF6B9D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              <Text style={styles.saveLabel}>
                {saving ? t('addWord.saving') : t('addWord.saveWord')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(c, isRTL, isDark) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
    },
    headerRight: {
      width: 32,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    titleBlock: {
      marginTop: 24,
      marginBottom: 0,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: c.textPrimary,
    },
    pageSubtitle: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 6,
      lineHeight: 20,
    },
    sectionLabelRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.2,
      color: c.textSecondary,
    },
    labelError: {
      color: c.error,
    },
    sectionHint: {
      fontSize: 11,
      color: c.textMuted,
      fontStyle: 'italic',
    },
    articleRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      borderRadius: 16,
      padding: 4,
    },
    articleRowError: {
      borderWidth: 2,
      borderColor: c.error,
      padding: 4,
    },
    articleCard: {
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
      right: isRTL ? undefined : 6,
      left: isRTL ? 6 : undefined,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    articleCardLabel: {
      fontSize: 20,
      fontWeight: '700',
    },
    articleCardSublabel: {
      fontSize: 11,
      marginTop: 2,
    },
    fieldsBlock: {
      marginTop: 24,
      gap: 16,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.2,
      color: c.textSecondary,
      marginBottom: 8,
    },
    fieldLabelRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    fieldLabelOptional: {
      fontSize: 11,
      color: c.textMuted,
      fontWeight: '400',
    },
    input: {
      height: 52,
      borderRadius: 14,
      backgroundColor: c.inputBg,
      paddingHorizontal: 16,
      fontSize: 16,
      color: c.textPrimary,
      borderWidth: 1.5,
    },
    textArea: {
      height: 88,
      paddingTop: 14,
      paddingBottom: 14,
      fontSize: 15,
    },
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
}
