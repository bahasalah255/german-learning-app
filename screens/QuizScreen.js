import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARTICLE_COLORS } from '../constants/articleColors';
import { addXP } from '../utils/progress';

const WORDS_KEY     = 'words';
const SENTENCES_KEY = 'sentences';
const MODE          = { TRANSLATION: 'translation', ARTICLE: 'article' };
const MIN_TRANSLATION = 3;
const MIN_ARTICLE     = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Normal quiz builders ─────────────────────────────────────────────────────

function buildTranslationQuestion(words, previousWordId) {
  const pool =
    words.length > MIN_TRANSLATION
      ? words.filter((w) => w.id !== previousWordId)
      : words;
  const correct     = pool[Math.floor(Math.random() * pool.length)];
  const distractors = shuffle(words.filter((w) => w.id !== correct.id)).slice(0, 2);
  return {
    wordId:        correct.id,
    word:          correct.word,
    article:       correct.article,
    correctAnswer: correct.translation,
    options: shuffle([correct, ...distractors]).map((w) => ({
      id:        w.id,
      label:     w.translation,
      isCorrect: w.id === correct.id,
    })),
  };
}

function buildArticleQuestion(words, previousWordId) {
  const pool =
    words.length > MIN_ARTICLE
      ? words.filter((w) => w.id !== previousWordId)
      : words;
  const correct = pool[Math.floor(Math.random() * pool.length)];
  return {
    wordId:        correct.id,
    word:          correct.word,
    correctAnswer: correct.article,
    options: shuffle(['der', 'die', 'das', 'plural']).map((art) => ({
      id:        art,
      label:     art,
      isCorrect: art === correct.article,
    })),
  };
}

// ─── Focus quiz builders (notification-triggered) ────────────────────────────

function buildFocusArticleQuestion(focusItem) {
  return {
    stepLabel:     'Choose the correct article',
    displayText:   focusItem.word,
    hint:          'What is the article for this word?',
    correctAnswer: focusItem.article,
    isArticleStep: true,
    options: shuffle(['der', 'die', 'das', 'plural']).map((art) => ({
      id:        art,
      label:     art,
      isCorrect: art === focusItem.article,
    })),
  };
}

function buildFocusWordQuestion(focusItem, allWords) {
  const distractors = shuffle(
    allWords.filter((w) => w.id !== focusItem.wordId)
  ).slice(0, 2);

  const correctOption = { id: focusItem.wordId, label: focusItem.word, isCorrect: true };
  const wrongOptions  = distractors.map((w) => ({ id: w.id, label: w.word, isCorrect: false }));

  return {
    stepLabel:     'Find the German word',
    displayText:   focusItem.translation,
    hint:          'What is the German word for this translation?',
    correctAnswer: focusItem.word,
    isArticleStep: false,
    options:       shuffle([correctOption, ...wrongOptions]),
  };
}

function buildFocusSentenceQuestion(focusItem, allSentences) {
  const distractors = shuffle(
    allSentences.filter((s) => s.id !== focusItem.sentenceId)
  ).slice(0, 2);

  const correctOption = {
    id:        focusItem.sentenceId,
    label:     focusItem.sentence,
    isCorrect: true,
  };
  const wrongOptions = distractors.map((s) => ({
    id:        s.id,
    label:     s.sentence,
    isCorrect: false,
  }));

  return {
    stepLabel:     'Find the German sentence',
    displayText:   focusItem.translation,
    hint:          'Which sentence matches this translation?',
    correctAnswer: focusItem.sentence,
    isArticleStep: false,
    options:       shuffle([correctOption, ...wrongOptions]),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuizScreen({ route, navigation }) {
  const [words,     setWords]     = useState([]);
  const [sentences, setSentences] = useState([]);
  const [mode,      setMode]      = useState(MODE.TRANSLATION);
  const [question,  setQuestion]  = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [score,     setScore]     = useState({ correct: 0, total: 0 });
  const [loading,   setLoading]   = useState(true);

  const [focusItem,      setFocusItem]      = useState(null);
  const [focusQuestions, setFocusQuestions] = useState([]);
  const [focusStep,      setFocusStep]      = useState(0);
  const [focusSelected,  setFocusSelected]  = useState(null);
  const [focusScore,     setFocusScore]     = useState({ correct: 0, total: 0 });

  useEffect(() => {
    const fi = route.params?.focusItem;
    if (!fi) return;
    setFocusItem(fi);
    setFocusStep(0);
    setFocusSelected(null);
    setFocusScore({ correct: 0, total: 0 });
  }, [route.params?.focusItem]);

  useEffect(() => {
    if (!focusItem) return;

    if (focusItem.type === 'word') {
      const q1     = buildFocusArticleQuestion(focusItem);
      const others = words.filter((w) => w.id !== focusItem.wordId);
      const q2     = others.length >= 1 ? buildFocusWordQuestion(focusItem, words) : null;
      setFocusQuestions(q2 ? [q1, q2] : [q1]);
    } else if (focusItem.type === 'sentence') {
      setFocusQuestions([buildFocusSentenceQuestion(focusItem, sentences)]);
    }
  }, [focusItem, words, sentences]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setSelected(null);
      setScore({ correct: 0, total: 0 });
      Promise.all([
        AsyncStorage.getItem(WORDS_KEY).then((r) => (r ? JSON.parse(r) : [])),
        AsyncStorage.getItem(SENTENCES_KEY).then((r) => (r ? JSON.parse(r) : [])),
      ])
        .then(([w, s]) => { setWords(w); setSentences(s); })
        .catch(() => { setWords([]); setSentences([]); })
        .finally(() => setLoading(false));
    }, [])
  );

  useEffect(() => {
    if (focusItem) return;
    if (mode === MODE.TRANSLATION && words.length >= MIN_TRANSLATION) {
      setQuestion(buildTranslationQuestion(words, null));
    } else if (mode === MODE.ARTICLE && words.length >= MIN_ARTICLE) {
      setQuestion(buildArticleQuestion(words, null));
    } else {
      setQuestion(null);
    }
    setSelected(null);
  }, [words, mode, focusItem]);

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    setQuestion(null);
    setSelected(null);
    setMode(newMode);
    setScore({ correct: 0, total: 0 });
  };

  const handleSelect = (option) => {
    if (selected !== null) return;
    setSelected(option.id);
    setScore((prev) => ({
      correct: prev.correct + (option.isCorrect ? 1 : 0),
      total:   prev.total + 1,
    }));
    if (option.isCorrect) addXP();
  };

  const handleNext = () => {
    setSelected(null);
    setQuestion((prev) =>
      mode === MODE.TRANSLATION
        ? buildTranslationQuestion(words, prev?.wordId ?? null)
        : buildArticleQuestion(words, prev?.wordId ?? null)
    );
  };

  const handleFocusSelect = (option) => {
    if (focusSelected !== null) return;
    setFocusSelected(option.id);
    setFocusScore((prev) => ({
      correct: prev.correct + (option.isCorrect ? 1 : 0),
      total:   prev.total + 1,
    }));
    if (option.isCorrect) addXP();
  };

  const handleFocusNext = () => {
    if (focusStep + 1 >= focusQuestions.length) {
      setFocusStep(focusQuestions.length);
    } else {
      setFocusStep((s) => s + 1);
      setFocusSelected(null);
    }
  };

  const exitFocusQuiz = () => {
    setFocusItem(null);
    setFocusStep(0);
    setFocusSelected(null);
    setFocusScore({ correct: 0, total: 0 });
    navigation.setParams({ focusItem: null });
  };

  const isAnswered     = selected !== null;
  const wasCorrect     = isAnswered && question?.options.find((o) => o.id === selected)?.isCorrect;
  const minRequired    = mode === MODE.TRANSLATION ? MIN_TRANSLATION : MIN_ARTICLE;
  const hasEnoughWords = words.length >= minRequired;

  const getOptionStyle = (option, isArticleMode) => {
    if (isAnswered) {
      if (option.isCorrect)       return [styles.option, styles.optionCorrect];
      if (option.id === selected) return [styles.option, styles.optionWrong];
      return [styles.option, styles.optionDimmed];
    }
    if (isArticleMode) {
      const colors = ARTICLE_COLORS[option.id];
      if (!colors) return styles.option;
      return [styles.option, { backgroundColor: colors.bg, borderColor: 'transparent' }];
    }
    return styles.option;
  };

  const getOptionTextStyle = (option, isArticleMode) => {
    if (isAnswered) {
      if (option.isCorrect)       return [styles.optionText, styles.optionTextCorrect];
      if (option.id === selected) return [styles.optionText, styles.optionTextWrong];
      return [styles.optionText, styles.optionTextDimmed];
    }
    if (isArticleMode) {
      const colors = ARTICLE_COLORS[option.id];
      if (!colors) return styles.optionText;
      return [styles.optionText, { color: colors.text, fontWeight: '800' }];
    }
    return styles.optionText;
  };

  const focusCurrentQ   = focusQuestions[focusStep] ?? null;
  const focusDone       = focusStep >= focusQuestions.length && focusQuestions.length > 0;
  const isFocusAnswered = focusSelected !== null;
  const focusWasCorrect =
    isFocusAnswered && focusCurrentQ?.options.find((o) => o.id === focusSelected)?.isCorrect;

  const getFocusOptionStyle = (option) => {
    if (isFocusAnswered) {
      if (option.isCorrect)            return [styles.option, styles.optionCorrect];
      if (option.id === focusSelected) return [styles.option, styles.optionWrong];
      return [styles.option, styles.optionDimmed];
    }
    if (focusCurrentQ?.isArticleStep) {
      const colors = ARTICLE_COLORS[option.id];
      if (!colors) return styles.option;
      return [styles.option, { backgroundColor: colors.bg, borderColor: 'transparent' }];
    }
    return styles.option;
  };

  const getFocusOptionTextStyle = (option) => {
    if (isFocusAnswered) {
      if (option.isCorrect)            return [styles.optionText, styles.optionTextCorrect];
      if (option.id === focusSelected) return [styles.optionText, styles.optionTextWrong];
      return [styles.optionText, styles.optionTextDimmed];
    }
    if (focusCurrentQ?.isArticleStep) {
      const colors = ARTICLE_COLORS[option.id];
      if (!colors) return styles.optionText;
      return [styles.optionText, { color: colors.text, fontWeight: '800' }];
    }
    return styles.optionText;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Focus Quiz ────────────────────────────────────────────────────────────

  if (focusItem) {
    const focusLabel =
      focusItem.type === 'word' ? focusItem.word : 'this sentence';

    // Done card icon: trophy for perfect, star for partial, refresh for zero
    const doneIconName =
      focusScore.correct === focusScore.total ? 'trophy' :
      focusScore.correct > 0 ? 'star' : 'reload-circle';
    const doneIconColor =
      focusScore.correct === focusScore.total ? '#F59E0B' :
      focusScore.correct > 0 ? '#6366F1' : '#9CA3AF';

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Quick Quiz</Text>
              <Text style={styles.subtitle}>Started from notification</Text>
            </View>
            <TouchableOpacity style={styles.exitButton} onPress={exitFocusQuiz} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {focusDone ? (
            <>
              <View style={styles.doneCard}>
                <View style={styles.doneIconWrap}>
                  <Ionicons name={doneIconName} size={40} color={doneIconColor} />
                </View>
                <Text style={styles.doneTitle}>Quiz complete!</Text>
                <Text style={styles.doneBody}>
                  You got{' '}
                  <Text style={styles.doneScore}>
                    {focusScore.correct} / {focusScore.total}
                  </Text>{' '}
                  correct for{' '}
                  <Text style={{ fontWeight: '700', color: '#1A1A2E' }}>{focusLabel}</Text>
                </Text>
              </View>
              <TouchableOpacity style={styles.nextButton} onPress={exitFocusQuiz} activeOpacity={0.85}>
                <Text style={styles.nextButtonText}>Continue to full quiz</Text>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </>

          ) : focusCurrentQ ? (
            <>
              <View style={styles.stepRow}>
                {focusQuestions.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.stepDot,
                      i === focusStep && styles.stepDotActive,
                      i < focusStep  && styles.stepDotDone,
                    ]}
                  />
                ))}
                <Text style={styles.stepLabel}>
                  Question {focusStep + 1} of {focusQuestions.length}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.questionLabel}>{focusCurrentQ.stepLabel}</Text>
                <Text style={[
                  styles.wordText,
                  focusItem.type === 'sentence' && styles.sentenceText,
                ]}>
                  {focusCurrentQ.displayText}
                </Text>
                <Text style={styles.questionHint}>{focusCurrentQ.hint}</Text>

                <View style={styles.options}>
                  {focusCurrentQ.options.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={getFocusOptionStyle(option)}
                      onPress={() => handleFocusSelect(option)}
                      activeOpacity={isFocusAnswered ? 1 : 0.75}
                      disabled={isFocusAnswered}
                    >
                      <Text style={[
                        getFocusOptionTextStyle(option),
                        focusItem.type === 'sentence' && styles.optionSentenceText,
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {isFocusAnswered && (
                  <View style={[styles.feedbackRow, focusWasCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
                    <View style={styles.feedbackInner}>
                      <Ionicons
                        name={focusWasCorrect ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={focusWasCorrect ? '#059669' : '#DC2626'}
                      />
                      <Text style={[styles.feedbackText, focusWasCorrect ? styles.feedbackTextCorrect : styles.feedbackTextWrong]}>
                        {focusWasCorrect
                          ? 'Correct!'
                          : `"${focusCurrentQ.correctAnswer}"`}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {isFocusAnswered && (
                <TouchableOpacity style={styles.nextButton} onPress={handleFocusNext} activeOpacity={0.85}>
                  <Text style={styles.nextButtonText}>
                    {focusStep + 1 < focusQuestions.length ? 'Next question' : 'See results'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Normal Quiz ───────────────────────────────────────────────────────────

  const articleColors =
    question && mode === MODE.TRANSLATION ? ARTICLE_COLORS[question.article] : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
      <ScrollView
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Quiz</Text>
            <Text style={styles.subtitle}>Test your knowledge</Text>
          </View>
          {score.total > 0 && (
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>
                {score.correct}
                <Text style={styles.scoreTotal}> / {score.total}</Text>
              </Text>
            </View>
          )}
        </View>

        <View style={styles.modeSelector}>
          {[MODE.TRANSLATION, MODE.ARTICLE].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeButton, mode === m && styles.modeButtonActive]}
              onPress={() => handleModeSwitch(m)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]}>
                {m === MODE.TRANSLATION ? 'Translation' : 'Article'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!hasEnoughWords && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="library-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>
              {words.length === 0 ? 'No words yet' : 'Not enough words'}
            </Text>
            <Text style={styles.emptyBody}>
              {words.length === 0
                ? 'Add words in the Words tab to start the quiz.'
                : `Translation Quiz needs at least ${MIN_TRANSLATION} words. Add ${MIN_TRANSLATION - words.length} more to continue.`}
            </Text>
            {words.length > 0 && (
              <View style={styles.emptyPill}>
                <Text style={styles.emptyPillText}>
                  {words.length} / {MIN_TRANSLATION} words added
                </Text>
              </View>
            )}
          </View>
        )}

        {hasEnoughWords && question && (
          <View style={styles.card}>
            <Text style={styles.questionLabel}>
              {mode === MODE.TRANSLATION ? 'Translate this word' : 'Choose the correct article'}
            </Text>
            <View style={styles.wordRow}>
              {mode === MODE.TRANSLATION && articleColors && (
                <View style={[styles.articleBadge, { backgroundColor: articleColors.bg }]}>
                  <Text style={[styles.articleBadgeText, { color: articleColors.text }]}>
                    {question.article}
                  </Text>
                </View>
              )}
              <Text style={styles.wordText}>{question.word}</Text>
            </View>
            <Text style={styles.questionHint}>
              {mode === MODE.TRANSLATION
                ? 'What is the correct translation?'
                : 'What is the article for this word?'}
            </Text>
            <View style={styles.options}>
              {question.options.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={getOptionStyle(option, mode === MODE.ARTICLE)}
                  onPress={() => handleSelect(option)}
                  activeOpacity={isAnswered ? 1 : 0.75}
                  disabled={isAnswered}
                >
                  <Text style={getOptionTextStyle(option, mode === MODE.ARTICLE)}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {isAnswered && (
              <View style={[styles.feedbackRow, wasCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
                <View style={styles.feedbackInner}>
                  <Ionicons
                    name={wasCorrect ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={wasCorrect ? '#059669' : '#DC2626'}
                  />
                  <Text style={[styles.feedbackText, wasCorrect ? styles.feedbackTextCorrect : styles.feedbackTextWrong]}>
                    {wasCorrect
                      ? 'Correct!'
                      : `The answer is "${question.correctAnswer}"`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {isAnswered && hasEnoughWords && (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>Next question</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {score.total > 0 && (
          <Text style={styles.progressHint}>
            {score.total} question{score.total === 1 ? '' : 's'} answered this session
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inner:     { padding: 24, paddingTop: 36, paddingBottom: 60 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:     { fontSize: 30, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle:  { fontSize: 15, color: '#6B7280' },

  exitButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginTop: 4 },

  scorePill:  { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 4 },
  scoreText:  { fontSize: 20, fontWeight: '800', color: '#4F46E5' },
  scoreTotal: { fontSize: 14, fontWeight: '600', color: '#A5B4FC' },

  modeSelector:         { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 24 },
  modeButton:           { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  modeButtonActive:     { backgroundColor: '#4F46E5', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  modeButtonText:       { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  modeButtonTextActive: { color: '#FFFFFF' },

  stepRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  stepDotActive: { backgroundColor: '#4F46E5', width: 20, borderRadius: 4 },
  stepDotDone:   { backgroundColor: '#A5B4FC' },
  stepLabel:     { fontSize: 13, color: '#9CA3AF', marginLeft: 4, fontWeight: '500' },

  card:          { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3, marginBottom: 20 },
  questionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 18 },
  wordRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  articleBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  articleBadgeText: { fontSize: 14, fontWeight: '700' },
  wordText:      { fontSize: 32, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.5, marginBottom: 8, flexShrink: 1 },
  sentenceText:  { fontSize: 20, fontWeight: '700', letterSpacing: 0, lineHeight: 28 },
  questionHint:  { fontSize: 14, color: '#9CA3AF', marginBottom: 24 },

  options:            { gap: 12 },
  option:             { borderRadius: 14, paddingVertical: 18, paddingHorizontal: 20, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', alignItems: 'center' },
  optionCorrect:      { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionWrong:        { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  optionDimmed:       { borderColor: '#F3F4F6', backgroundColor: '#FAFAFA', opacity: 0.45 },
  optionText:         { fontSize: 17, fontWeight: '600', color: '#374151', textAlign: 'center' },
  optionSentenceText: { fontSize: 15 },
  optionTextCorrect:  { color: '#059669', fontWeight: '700' },
  optionTextWrong:    { color: '#DC2626', fontWeight: '700' },
  optionTextDimmed:   { color: '#9CA3AF' },

  feedbackRow:         { marginTop: 18, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  feedbackCorrect:     { backgroundColor: '#ECFDF5' },
  feedbackWrong:       { backgroundColor: '#FEF2F2' },
  feedbackInner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  feedbackText:        { fontSize: 15, fontWeight: '600' },
  feedbackTextCorrect: { color: '#059669' },
  feedbackTextWrong:   { color: '#DC2626' },

  nextButton:     { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginBottom: 20 },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  progressHint: { textAlign: 'center', fontSize: 13, color: '#D1D5DB' },

  doneCard:    { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, marginBottom: 20 },
  doneIconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  doneTitle:   { fontSize: 22, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },
  doneBody:    { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  doneScore:   { fontWeight: '800', color: '#4F46E5', fontSize: 18 },

  emptyCard:     { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 10 },
  emptyBody:     { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  emptyPill:     { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  emptyPillText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
});
