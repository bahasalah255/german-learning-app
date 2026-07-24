import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addXP } from '../utils/progress';
import { speakGerman, stopSpeech } from '../utils/speech';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { isPlural, getArticleLabel, getTTSString, getArticleStyle } from '../utils/articleHelpers';

const WORDS_KEY      = 'words';
const QUIZ_LENGTH    = 5;
const XP_PER_CORRECT = 10;
const MIN_WORDS      = 3;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(words) {
  return shuffle(words)
    .slice(0, Math.min(QUIZ_LENGTH, words.length))
    .map((w, i) => ({
      key:                w.id + '_' + i,
      german:             w.word,
      translation:        w.translation,
      article:            w.article || null,
      is_plural:          w.is_plural || false,
      grammatical_gender: w.grammatical_gender || null,
    }));
}

function getArticleColors(item, isDark) {
  if (!item || !item.article) return null;
  const style = getArticleStyle(item, isDark);
  return { bg: style.bg, color: style.text };
}

export default function QuizScreen({ route, navigation }) {
  const { t, isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [words,        setWords]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [phase,        setPhase]        = useState('mode_select'); // 'mode_select'|'quiz'|'done'
  const [quizMode,     setQuizMode]     = useState(null);          // 'de_to_tr'|'tr_to_de'
  const [questions,    setQuestions]    = useState([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [inputValue,   setInputValue]   = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [answerState,  setAnswerState]  = useState('idle'); // 'idle' | 'correct' | 'wrong'
  const [score,        setScore]        = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount,   setWrongCount]   = useState(0);
  const [streak,       setStreak]       = useState(0);
  const [bestStreak,   setBestStreak]   = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);

  const shakeAnim            = useRef(new Animated.Value(0)).current;
  const cardEnterAnim        = useRef(new Animated.Value(0)).current;
  const inputRef             = useRef(null);
  const routeRef             = useRef(route);
  routeRef.current           = route;
  const focusItemConsumedRef = useRef(false);
  const retryTimerRef        = useRef(null);

  const runCardEntrance = useCallback(() => {
    cardEnterAnim.setValue(0);
    Animated.timing(cardEnterAnim, {
      toValue: 1, duration: 380, useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (phase === 'quiz' && questions.length > 0 && !loading) runCardEntrance();
  }, [currentIdx, phase, loading]);

  const resetGameState = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setCurrentIdx(0);
    setInputValue('');
    setAnswerState('idle');
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setStreak(0);
    setBestStreak(0);
  };

  const applyFocusedQuiz = (focusItem, loadedWords) => {
    const focused = {
      key:                String(focusItem.id) + '_focus',
      german:             focusItem.word      || focusItem.sentence    || '',
      translation:        focusItem.translation || '',
      article:            focusItem.article   || null,
      is_plural:          focusItem.is_plural || false,
      grammatical_gender: focusItem.grammatical_gender || null,
    };
    const others = loadedWords.filter(w => w.id !== (focusItem.wordId || focusItem.id));
    const fillQs = shuffle(others)
      .slice(0, Math.min(QUIZ_LENGTH - 1, others.length))
      .map((w, i) => ({
        key:                w.id + '_' + i,
        german:             w.word,
        translation:        w.translation,
        article:            w.article || null,
        is_plural:          w.is_plural || false,
        grammatical_gender: w.grammatical_gender || null,
      }));
    setQuestions([focused, ...fillQs]);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      stopSpeech();
      setIsPlaying(false);
      const focusItem = routeRef.current?.params?.focusItem;

      AsyncStorage.getItem(WORDS_KEY)
        .then((raw) => {
          const loaded = raw ? JSON.parse(raw) : [];
          setWords(loaded);
          resetGameState();

          if (focusItem?.type) {
            focusItemConsumedRef.current = true;
            const mode = focusItem.displayMode === 'ar_shown' ? 'tr_to_de' : 'de_to_tr';
            setQuizMode(mode);
            applyFocusedQuiz(focusItem, loaded);
            setPhase('quiz');
            navigation?.setParams({ focusItem: null });
          } else {
            setPhase('mode_select');
            setQuizMode(null);
            setQuestions([]);
          }
        })
        .catch(() => setWords([]))
        .finally(() => setLoading(false));
    }, [])
  );

  useEffect(() => {
    const focusItem = route?.params?.focusItem;
    if (!focusItem?.type) return;
    if (focusItemConsumedRef.current) { focusItemConsumedRef.current = false; return; }
    stopSpeech();
    setIsPlaying(false);
    AsyncStorage.getItem(WORDS_KEY)
      .then((raw) => {
        const loaded = raw ? JSON.parse(raw) : [];
        setWords(loaded);
        const mode = focusItem.displayMode === 'ar_shown' ? 'tr_to_de' : 'de_to_tr';
        setQuizMode(mode);
        applyFocusedQuiz(focusItem, loaded);
        resetGameState();
        setPhase('quiz');
        navigation?.setParams({ focusItem: null });
      })
      .catch(() => {});
  }, [route?.params?.focusItem]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const startQuiz = (mode) => {
    setQuizMode(mode);
    setQuestions(buildQuestions(words));
    setPhase('quiz');
    setTimeout(() => inputRef.current?.focus(), 400);
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || answerState !== 'idle') return;

    const q             = questions[currentIdx];
    const userAnswer    = inputValue.trim().toLowerCase();
    const correctAnswer = quizMode === 'de_to_tr'
      ? q.translation.trim().toLowerCase()
      : q.german.trim().toLowerCase();

    const correct =
      userAnswer === correctAnswer ||
      correctAnswer.includes(userAnswer) ||
      userAnswer.includes(correctAnswer);

    if (correct) {
      setAnswerState('correct');
      const newStreak = streak + 1;
      setStreak(newStreak);
      setBestStreak(prev => Math.max(prev, newStreak));
      setScore(prev => prev + XP_PER_CORRECT);
      setCorrectCount(prev => prev + 1);
      await addXP(XP_PER_CORRECT);
    } else {
      setAnswerState('wrong');
      setWrongCount(prev => prev + 1);
      setStreak(0);
      triggerShake();

      retryTimerRef.current = setTimeout(() => {
        setAnswerState('idle');
        setInputValue('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }, 1400);
    }
  };

  const handleNext = () => {
    stopSpeech();
    setIsPlaying(false);
    setAnswerState('idle');
    setInputValue('');

    if (currentIdx + 1 >= questions.length) {
      setPhase('done');
    } else {
      setCurrentIdx(prev => prev + 1);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const handlePlayAgain = () => {
    resetGameState();
    setPhase('mode_select');
    setQuizMode(null);
    setQuestions([]);
  };

  const handleListen = (germanWord) => {
    if (isPlaying) { stopSpeech(); setIsPlaying(false); return; }
    setIsPlaying(true);
    speakGerman(germanWord, {
      onDone:  () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const styles = useMemo(() => getStyles(c, isRTL, isDark), [c, isRTL, isDark]);

  const isDeToTr  = quizMode === 'de_to_tr';
  const isCorrect = answerState === 'correct';
  const isWrong   = answerState === 'wrong';

  const inputBorderColor =
    isCorrect    ? c.success :
    isWrong      ? c.error :
    inputFocused ? c.primary :
    c.border;
  const inputBgColor =
    isCorrect ? (isDark ? 'rgba(34, 197, 94, 0.15)' : '#ECFDF5') :
    isWrong   ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FFF0EF') :
    c.inputBg;
  const inputTextColor =
    isCorrect ? c.success :
    isWrong   ? c.error :
    c.inputText;

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

  // MODE SELECTOR
  if (phase === 'mode_select') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>

          <LinearGradient
            colors={['#1E40AF', '#2563EB', '#3B82F6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerRow}>
              <View style={styles.bannerLeft}>
                <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>
                  {t('quiz.subtitle').toUpperCase()}
                </Text>
                <Text style={[styles.bannerTitle, isRTL && { textAlign: 'right' }]}>
                  {t('quiz.title')}
                </Text>
              </View>
              <Ionicons name="sparkles" size={40} color="rgba(255,255,255,0.9)" />
            </View>
          </LinearGradient>

          {words.length < MIN_WORDS ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="library-outline" size={36} color={c.primary} />
              </View>
              <Text style={[styles.emptyTitle, isRTL && { textAlign: 'right' }]}>
                {t('quiz.noWords')}
              </Text>
              <Text style={[styles.emptyBody, isRTL && { textAlign: 'right' }]}>
                {t('quiz.addWordsFirst')}
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.modeHeading, isRTL && { textAlign: 'right' }]}>
                Quiz mode
              </Text>

              <View style={styles.modeGrid}>
                <TouchableOpacity style={styles.modeCardTouch} onPress={() => startQuiz('de_to_tr')} activeOpacity={0.88}>
                  <LinearGradient colors={['#2563EB', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
                    <Text style={styles.modeCardFlag}>🇩🇪 → 🌍</Text>
                    <Text style={styles.modeCardTitle}>German → Translation</Text>
                    <Text style={styles.modeCardSub}>See German word, type the translation</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modeCardTouch} onPress={() => startQuiz('tr_to_de')} activeOpacity={0.88}>
                  <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
                    <Text style={styles.modeCardFlag}>🌍 → 🇩🇪</Text>
                    <Text style={styles.modeCardTitle}>Translation → German</Text>
                    <Text style={styles.modeCardSub}>See the translation, type the German word</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={styles.wordCountPill}>
                <Ionicons name="book-outline" size={14} color={c.textSecondary} />
                <Text style={styles.wordCountText}>
                  {words.length} word{words.length !== 1 ? 's' : ''} available
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // RESULTS SCREEN
  if (phase === 'done') {
    const perfect = correctCount === questions.length && wrongCount === 0;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>

          <LinearGradient
            colors={['#1E40AF', '#2563EB', '#3B82F6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerRow}>
              <View style={styles.bannerLeft}>
                <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>QUIZ COMPLETE</Text>
                <Text style={[styles.bannerTitle,   isRTL && { textAlign: 'right' }]}>
                  {perfect ? t('quiz.perfect') : t('quiz.wellDone')}
                </Text>
              </View>
              <Ionicons name={perfect ? 'trophy' : 'star'} size={40} color="rgba(255,255,255,0.9)" />
            </View>
          </LinearGradient>

          <View style={styles.xpHeadline}>
            <View style={styles.xpIconWrap}>
              <Ionicons name="flash" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.xpHeadlineText}>+{score} XP earned</Text>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#ECFDF5' }]}>
                  <Ionicons name="checkmark-circle" size={22} color={c.success} />
                </View>
                <Text style={styles.statValue}>{correctCount}</Text>
                <Text style={styles.statLabel}>Correct</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FFF0EF' }]}>
                  <Ionicons name="close-circle" size={22} color={c.error} />
                </View>
                <Text style={styles.statValue}>{wrongCount}</Text>
                <Text style={styles.statLabel}>Wrong tries</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFF8E0' }]}>
                  <Ionicons name="flame" size={22} color="#F5C842" />
                </View>
                <Text style={styles.statValue}>{bestStreak}</Text>
                <Text style={styles.statLabel}>Best streak</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={handlePlayAgain} activeOpacity={0.88} style={styles.gradientTouch}>
            <LinearGradient
              colors={['#2563EB', '#3B82F6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.gradientBtnText}>Play again</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Words')}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={18} color={c.primary} />
            <Text style={styles.backBtnText}>Back to words</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ACTIVE QUIZ SCREEN
  const currentQ  = questions[currentIdx];
  const artColors = currentQ.article ? getArticleColors(currentQ.article, isDark) : null;
  const cardTranslateY = cardEnterAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.inner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner */}
          <LinearGradient
            colors={['#1E40AF', '#2563EB', '#3B82F6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerRow}>
              <View style={styles.bannerLeft}>
                <Text style={[styles.bannerEyebrow, isRTL && { textAlign: 'right' }]}>
                  {t('quiz.subtitle').toUpperCase()}
                </Text>
                <Text style={[styles.bannerTitle, isRTL && { textAlign: 'right' }]}>
                  {t('quiz.title')}
                </Text>
              </View>
              <View style={styles.scoreBubble}>
                <Text style={styles.scoreBubbleNum}>{score}</Text>
                <Text style={styles.scoreBubbleLabel}>XP</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            {questions.map((_, i) => (
              <View key={i} style={[
                styles.progressSeg,
                i === currentIdx && styles.progressSegActive,
                i < currentIdx  && styles.progressSegDone,
              ]} />
            ))}
          </View>

          {/* Question count */}
          <Text style={[styles.questionCount, isRTL && { textAlign: 'right' }]}>
            {currentIdx + 1} / {questions.length}
          </Text>

          {/* Noun Card */}
          <Animated.View style={[
            styles.wordCardOuter,
            { opacity: cardEnterAnim, transform: [{ translateY: cardTranslateY }] },
          ]}>
            <LinearGradient
              colors={['#1E3A8A', '#2563EB', '#3B82F6']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.wordCardGradient}
            >
              <View style={[styles.blob, styles.blob1]} />
              <View style={[styles.blob, styles.blob2]} />

              <View style={styles.glassCard}>
                <View style={styles.wordBadge}>
                  <Text style={styles.wordBadgeText}>
                    {isDeToTr ? 'What does this mean?' : 'How do you say this in German?'}
                  </Text>
                </View>

                <Text style={[styles.wordCardWord, !isDeToTr && styles.wordCardWordArabic]}>
                  {isDeToTr ? currentQ.german : currentQ.translation}
                </Text>

                {isDeToTr && currentQ.article && artColors && (
                  <View style={[styles.articleInfoPill, { backgroundColor: artColors.bg }]}>
                    <Text style={[styles.articleInfoText, { color: artColors.color }]}>
                      {getArticleLabel(currentQ)}
                    </Text>
                  </View>
                )}

                {!isDeToTr && currentQ.article && (
                  <Text style={styles.nounHint}>(noun)</Text>
                )}

                {isDeToTr && (
                  <TouchableOpacity
                    style={[styles.wordCardListenBtn, isPlaying && styles.wordCardListenBtnActive]}
                    onPress={() => handleListen(getTTSString(currentQ))}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
                      size={18}
                      color={isPlaying ? '#FFFFFF' : c.primary}
                    />
                    <Text style={[styles.wordCardListenText, isPlaying && styles.wordCardListenTextActive]}>
                      {isPlaying ? 'Playing…' : 'Listen'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Input field */}
          <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
            {isDeToTr ? 'TYPE THE TRANSLATION' : 'TYPE THE GERMAN WORD'}
          </Text>

          <View style={styles.inputRow}>
            <Animated.View style={[
              styles.inputWrapper,
              {
                borderColor:     inputBorderColor,
                backgroundColor: inputBgColor,
                transform: [{ translateX: shakeAnim }],
              },
            ]}>
              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: inputTextColor }, isRTL && { textAlign: 'right' }]}
                placeholder={isDeToTr ? 'Type translation…' : 'Type German word…'}
                placeholderTextColor={c.textPlaceholder}
                value={inputValue}
                onChangeText={(text) => {
                  setInputValue(text);
                  if (answerState === 'wrong') {
                    setAnswerState('idle');
                    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                  }
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                editable={answerState !== 'correct'}
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit={false}
                returnKeyType="done"
                onSubmitEditing={answerState === 'idle' ? handleSubmit : undefined}
              />
            </Animated.View>

            {!isCorrect && (
              <TouchableOpacity
                onPress={handleSubmit}
                activeOpacity={0.88}
                disabled={!inputValue.trim() || answerState !== 'idle'}
                style={[
                  styles.submitBtnTouch,
                  (!inputValue.trim() || answerState !== 'idle') && { opacity: 0.4 },
                ]}
              >
                <LinearGradient
                  colors={['#2563EB', '#3B82F6']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Correct/Wrong Feedback */}
          {isCorrect && (
            <View style={styles.feedbackBoxCorrect}>
              <Ionicons name="checkmark-circle" size={20} color={c.success} />
              <Text style={styles.feedbackCorrectText}>Richtig!</Text>
            </View>
          )}
          {isWrong && (
            <View style={styles.feedbackBoxWrong}>
              <Ionicons name="close-circle" size={20} color={c.error} />
              <Text style={styles.feedbackWrongText}>Falsch! — try again</Text>
            </View>
          )}

          {/* Next Button */}
          {isCorrect && (
            <TouchableOpacity onPress={handleNext} activeOpacity={0.88} style={[styles.gradientTouch, { marginTop: 8 }]}>
              <LinearGradient
                colors={['#22C55E', '#16A34A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.gradientBtnText}>
                  {currentIdx + 1 >= questions.length ? t('quiz.seeResults') : t('quiz.next')}
                </Text>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(c, isRTL, isDark) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
    inner:     { padding: 20, paddingTop: 20, paddingBottom: 60 },

    banner:        { borderRadius: 24, padding: 22, marginBottom: 16, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },
    bannerRow:     { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' },
    bannerLeft:    { flex: 1 },
    bannerEyebrow: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5, marginBottom: 5, textTransform: 'uppercase' },
    bannerTitle:   { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },

    scoreBubble: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: 'center',
      marginLeft: isRTL ? 0 : 12,
      marginRight: isRTL ? 12 : 0,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    scoreBubbleNum:   { fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 26 },
    scoreBubbleLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

    progressRow:       { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 6, marginBottom: 10 },
    progressSeg:       { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.border },
    progressSegActive: { backgroundColor: c.primary },
    progressSegDone:   { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.4)' : '#93C5FD' },

    questionCount: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 14 },

    modeHeading:   { fontSize: 20, fontWeight: '800', color: c.textPrimary, marginBottom: 16 },
    modeGrid:      { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginBottom: 20 },
    modeCardTouch: { flex: 1, borderRadius: 20, overflow: 'hidden', shadowColor: c.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: isDark ? 0.35 : 0.15, shadowRadius: 14, elevation: 6 },
    modeCard:      { borderRadius: 20, padding: 20, minHeight: 160, justifyContent: 'flex-end' },
    modeCardFlag:  { fontSize: 22, marginBottom: 10 },
    modeCardTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, lineHeight: 20 },
    modeCardSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 16 },
    wordCountPill: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.border },
    wordCountText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },

    wordCardOuter:    { width: '100%', borderRadius: 32, overflow: 'hidden', marginBottom: 0, minHeight: 220, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
    wordCardGradient: { borderRadius: 32, overflow: 'hidden', minHeight: 220, position: 'relative' },
    blob:  { position: 'absolute' },
    blob1: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.12)', top: -30, left: -30 },
    blob2: { width: 90,  height: 90,  borderRadius: 45, backgroundColor: '#60A5FA', opacity: 0.3, top: 10, right: 20 },
    glassCard: {
      margin: 20,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      zIndex: 2,
    },
    wordBadge:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14 },
    wordBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
    wordCardWord:        { fontSize: 44, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', letterSpacing: -1, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, marginBottom: 10 },
    wordCardWordArabic:  { fontSize: 34, lineHeight: 48, letterSpacing: 0 },
    articleInfoPill:     { borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
    articleInfoText:     { fontSize: 13, fontWeight: '800' },
    nounHint:            { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', marginBottom: 12 },
    wordCardListenBtn:       { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 50, paddingHorizontal: 22, paddingVertical: 10, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
    wordCardListenBtnActive: { backgroundColor: c.primary },
    wordCardListenText:       { fontSize: 14, fontWeight: '700', color: c.primary },
    wordCardListenTextActive: { color: '#FFFFFF' },

    inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: c.textSecondary, marginTop: 24, marginBottom: 10, textTransform: 'uppercase' },
    inputRow:   { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 },
    inputWrapper: {
      flex: 1,
      height: 60,
      borderRadius: 18,
      borderWidth: 2,
      paddingHorizontal: 20,
      justifyContent: 'center',
    },
    textInput: { fontSize: 18, fontWeight: '700', padding: 0 },
    submitBtnTouch: { borderRadius: 18, overflow: 'hidden', shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    submitBtn:      { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

    feedbackBoxCorrect: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginTop: 12,
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#A7F3D0'
    },
    feedbackBoxWrong: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginTop: 12,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FFF0EF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCD0C8'
    },
    feedbackCorrectText: { fontSize: 15, fontWeight: '700', color: c.success },
    feedbackWrongText:   { fontSize: 15, fontWeight: '700', color: c.error },

    gradientTouch:  { borderRadius: 18, overflow: 'hidden', marginBottom: 14, shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
    gradientBtn:    { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, paddingHorizontal: 20, gap: 8 },
    gradientBtnText:{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },

    backBtn:     { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border },
    backBtnText: { fontSize: 16, fontWeight: '700', color: c.primary },

    xpHeadline:     { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 8, elevation: 2 },
    xpIconWrap:     { width: 42, height: 42, borderRadius: 12, backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF9C3', alignItems: 'center', justifyContent: 'center' },
    xpHeadlineText: { fontSize: 20, fontWeight: '800', color: c.textPrimary },
    statsCard:      { backgroundColor: c.card, borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.25 : 0.05, shadowRadius: 10, elevation: 3 },
    statsRow:       { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-around' },
    statItem:       { alignItems: 'center', flex: 1 },
    statIconWrap:   { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue:      { fontSize: 28, fontWeight: '800', color: c.textPrimary, lineHeight: 32 },
    statLabel:      { fontSize: 12, color: c.textSecondary, fontWeight: '600', marginTop: 2 },
    statDivider:    { width: 1, height: 60, backgroundColor: c.border },

    emptyCard:    { backgroundColor: c.card, borderRadius: 24, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: c.border, shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
    emptyIconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
    emptyTitle:   { fontSize: 20, fontWeight: '800', color: c.textPrimary, marginBottom: 10 },
    emptyBody:    { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 23 },
  });
}
