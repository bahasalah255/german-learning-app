import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../../utils/LanguageContext';
import { getStoryById, loadStories } from '../services/StoryService';
import { getCustomStoryById, customStoryToReaderShape } from '../services/CustomStoryService';
import {
  isWordSaved,
  loadBookmarks,
  loadStoryProgress,
  saveStoryProgress,
  toggleBookmark,
  toggleSavedWord,
  loadSavedWords,
  loadFavoriteWords,
  toggleFavoriteWord,
  saveLastOpenedStory,
} from '../services/StoryInteractionService';

function normalizeTerm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,/#!$%\^&\*;:{}=\-_`~()?¡¿"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitUnmatchedText(text, parentKey) {
  const wordRegex = /([a-zA-ZäöüÄÖÜßéèàâçôêîûëüïöä]+)/;
  const parts = text.split(wordRegex);
  const segments = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    
    const isWord = /^[a-zA-ZäöüÄÖÜßéèàâçôêîûëüïöä]+$/.test(part);
    segments.push({
      text: part,
      key: `${parentKey}-unmatched-${i}-${part}`,
      match: isWord ? { german: part } : null,
      isVocabulary: false,
    });
  }
  return segments;
}

function splitParagraphText(text, localVocabulary, globalVocabulary) {
  const source = String(text || '');
  
  const localList = (localVocabulary || [])
    .map((word) => ({
      ...word,
      term: normalizeTerm(word.german),
    }))
    .filter((word) => word.term);

  const globalList = Object.values(globalVocabulary || {})
    .map((word) => ({
      ...word,
      term: normalizeTerm(word.german),
    }))
    .filter((word) => word.term);

  // Combine and de-duplicate (local matches take priority)
  const seenTerms = new Set();
  const entries = [];

  for (const item of localList) {
    if (!seenTerms.has(item.term)) {
      seenTerms.add(item.term);
      entries.push({ ...item, isLocal: true });
    }
  }

  for (const item of globalList) {
    if (!seenTerms.has(item.term)) {
      seenTerms.add(item.term);
      entries.push({ ...item, isLocal: false });
    }
  }

  // Sort by length descending so longer compound words match first
  entries.sort((left, right) => right.term.length - left.term.length);

  if (!entries.length) {
    return splitUnmatchedText(source, 'root');
  }

  let segments = [{ text: source, key: 'root', match: null, isVocabulary: false }];

  for (const candidate of entries) {
    const nextSegments = [];
    for (const seg of segments) {
      if (seg.match || seg.isVocabulary) {
        nextSegments.push(seg);
        continue;
      }

      let cursor = 0;
      const segText = seg.text;

      while (cursor < segText.length) {
        const remainder = segText.slice(cursor);
        const index = remainder.toLowerCase().indexOf(candidate.term);

        if (index < 0) {
          nextSegments.push({
            text: remainder,
            key: `${seg.key}-${cursor}-rem`,
            match: null,
            isVocabulary: false,
          });
          break;
        }

        if (index > 0) {
          nextSegments.push({
            text: remainder.slice(0, index),
            key: `${seg.key}-${cursor}-pre`,
            match: null,
            isVocabulary: false,
          });
        }

        const matchedText = remainder.slice(index, index + candidate.term.length);
        nextSegments.push({
          text: matchedText,
          key: `${seg.key}-${cursor}-match-${candidate.term}`,
          match: candidate,
          isVocabulary: true,
        });

        cursor += index + candidate.term.length;
      }
    }
    segments = nextSegments;
  }

  const finalSegments = [];
  for (const seg of segments) {
    if (seg.isVocabulary) {
      finalSegments.push(seg);
    } else {
      finalSegments.push(...splitUnmatchedText(seg.text, seg.key));
    }
  }

  return finalSegments;
}

function splitIntoSentences(text) {
  if (!text) return [];
  return text.match(/[^.!?]+[.!?]*/g) || [text];
}

function buildSpeechItems(storyParagraphs, storyVocabulary, globalVocab) {
  const items = [];
  if (!Array.isArray(storyParagraphs)) return items;
  storyParagraphs.forEach((paragraph, pIdx) => {
    const paragraphText = paragraph.german_text || '';
    const sentences = splitIntoSentences(paragraphText);
    
    // Get all matched words in the entire paragraph
    const pWords = splitParagraphText(paragraphText, storyVocabulary, globalVocab);
    const matchedWords = pWords.filter(seg => seg.match);
    
    let currentWordOffset = 0;
    
    sentences.forEach((sentenceText, sIdx) => {
      const sWords = splitParagraphText(sentenceText, storyVocabulary, globalVocab);
      const sMatched = sWords.filter(seg => seg.match);
      const wordCount = sMatched.length;
      
      items.push({
        paragraphIndex: pIdx,
        sentenceIndex: sIdx,
        text: sentenceText.trim(),
        startWordIndex: currentWordOffset,
        wordCount: wordCount,
        words: sMatched.map(w => w.text),
      });
      
      currentWordOffset += wordCount;
    });
  });
  return items;
}

const SPEECH_POS_PREFIX = '@story_speech_pos_';

const saveSpeechPosition = async (storyId, pos) => {
  try {
    await AsyncStorage.setItem(`${SPEECH_POS_PREFIX}${storyId}`, String(pos));
  } catch (e) {
    console.warn('Error saving speech position:', e);
  }
};

const clearSpeechPosition = async (storyId) => {
  try {
    await AsyncStorage.removeItem(`${SPEECH_POS_PREFIX}${storyId}`);
  } catch (e) {
    console.warn('Error clearing speech position:', e);
  }
};

export default function StoryReaderScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t, isRTL, language } = useLanguage();
  const [story, setStory] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [savedWords, setSavedWords] = useState([]);
  const [favoriteWords, setFavoriteWords] = useState([]);
  const [globalVocabulary, setGlobalVocabulary] = useState({});
  const [selectedWord, setSelectedWord] = useState(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [audioState, setAudioState] = useState('idle');
  const [progress, setProgress] = useState(null);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);

  const activeParagraphIndexRef = useRef(-1);
  const activeWordIndexRef = useRef(-1);
  const isSpeakingRef = useRef(false);
  const timerRef = useRef(null);
  // Cache: { [germanWord]: { french, arabic } } — avoids duplicate API calls
  const translationCacheRef = useRef({});

  const paragraphs = Array.isArray(story?.paragraphs) ? story.paragraphs : [];
  const vocabulary = Array.isArray(story?.vocabulary) ? story.vocabulary : [];

  const speechItems = useMemo(() => {
    if (!story || !story.paragraphs) return [];
    return buildSpeechItems(story.paragraphs, story.vocabulary, globalVocabulary);
  }, [story, globalVocabulary]);

  const startHighlightingForSentence = (item) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!item.wordCount) {
      setActiveParagraphIndex(item.paragraphIndex);
      setActiveWordIndex(-1);
      return;
    }

    setActiveParagraphIndex(item.paragraphIndex);
    setActiveWordIndex(item.startWordIndex);
    activeParagraphIndexRef.current = item.paragraphIndex;
    activeWordIndexRef.current = item.startWordIndex;

    const playWord = (wIdx) => {
      const relativeIdx = wIdx - item.startWordIndex;
      if (relativeIdx >= item.wordCount) {
        return;
      }

      const word = item.words[relativeIdx];
      const duration = 180 + (word ? word.length : 5) * 45;

      timerRef.current = setTimeout(() => {
        const nextIndex = wIdx + 1;
        if (nextIndex < item.startWordIndex + item.wordCount) {
          setActiveWordIndex(nextIndex);
          activeWordIndexRef.current = nextIndex;
          playWord(nextIndex);
        }
      }, duration);
    };

    playWord(item.startWordIndex);
  };

  const stopHighlighting = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setActiveParagraphIndex(-1);
    setActiveWordIndex(-1);
    activeParagraphIndexRef.current = -1;
    activeWordIndexRef.current = -1;
  };

  useEffect(() => {
    let active = true;

    // Reset TTS and highlighting state when changing story
    isSpeakingRef.current = false;
    Speech.stop();
    stopHighlighting();
    setCurrentSpeechIndex(0);
    setAudioState('idle');

    const SPEECH_POS_PREFIX = '@story_speech_pos_';

    (async () => {
      const storyId = route.params?.storyId;
      let loaded = null;
      if (storyId && String(storyId).startsWith('custom_')) {
        const customStory = await getCustomStoryById(storyId);
        if (customStory) {
          loaded = customStoryToReaderShape(customStory);
        }
      } else {
        loaded = await getStoryById(storyId);
      }
      if (active) setStory(loaded);

      if (loaded?.id) {
        const [storyBookmarks, storyProgress, allSaved, allFavorites, allStories, savedPosRaw] = await Promise.all([
          loadBookmarks(loaded.id),
          loadStoryProgress(loaded.id),
          loadSavedWords(),
          loadFavoriteWords(),
          loadStories(),
          AsyncStorage.getItem(`${SPEECH_POS_PREFIX}${loaded.id}`),
        ]);

        if (active) {
          setBookmarks(storyBookmarks);
          setProgress(storyProgress);

          const savedPos = savedPosRaw ? parseInt(savedPosRaw, 10) : 0;
          setCurrentSpeechIndex(savedPos);
          if (savedPos > 0) {
            setAudioState('paused');
          }

          const storySaved = allSaved
            .filter((item) => item.storyId === loaded.id)
            .map((item) => normalizeTerm(item.german));
          setSavedWords(storySaved);

          const storyFavorites = allFavorites
            .filter((item) => item.storyId === loaded.id)
            .map((item) => normalizeTerm(item.german));
          setFavoriteWords(storyFavorites);

          // Build global vocabulary dictionary
          const dict = {};
          allStories.forEach((s) => {
            if (Array.isArray(s.vocabulary)) {
              s.vocabulary.forEach((v) => {
                const norm = normalizeTerm(v.german);
                if (norm && !dict[norm]) {
                  dict[norm] = v;
                }
              });
            }
          });
          setGlobalVocabulary(dict);

          // ── Reading Progress Tracking ───────────────────────────
          // Record the last opened story so the Home "Continue Reading"
          // card can surface it.
          saveLastOpenedStory(loaded.id, loaded.title);

          // If no progress record exists yet, create one at 0 %
          if (!storyProgress) {
            const totalParagraphs = Array.isArray(loaded.paragraphs)
              ? loaded.paragraphs.length
              : 0;
            saveStoryProgress(loaded.id, {
              paragraphIndex: 0,
              percentage: 0,
              completed: false,
              totalParagraphs,
            });
          }
        }
      }
    })();

    return () => {
      active = false;
      isSpeakingRef.current = false;
      Speech.stop();
      stopHighlighting();
    };
  }, [route.params?.storyId]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (isSpeakingRef.current) {
          isSpeakingRef.current = false;
          Speech.stop();
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          setAudioState('paused');
          if (story?.id) {
            const SPEECH_POS_PREFIX = '@story_speech_pos_';
            AsyncStorage.setItem(`${SPEECH_POS_PREFIX}${story.id}`, String(currentSpeechIndex)).catch(() => {});
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [audioState, currentSpeechIndex, story?.id]);

  const vocabularyIndex = useMemo(() => {
    return vocabulary.reduce((index, word) => {
      index[normalizeTerm(word.german)] = word;
      return index;
    }, {});
  }, [vocabulary]);

  // ── Progress tracking helper ─────────────────────────────────────────────
  // Called whenever the user reaches a new paragraph (on bookmark or on view).
  const trackParagraphProgress = async (paragraphIndex) => {
    if (!story) return;
    const total = paragraphs.length || 1;
    const reached = paragraphIndex + 1;                       // 1-based
    const percentage = Math.round((reached / total) * 100);
    const completed = percentage >= 100;

    const saved = await saveStoryProgress(story.id, {
      paragraphIndex,
      percentage,
      completed,
      totalParagraphs: total,
      lastParagraphId: paragraphs[paragraphIndex]?.paragraph_id ?? null,
      lastParagraphOrder: paragraphs[paragraphIndex]?.order ?? null,
      completedAt: completed ? Date.now() : undefined,
    });
    setProgress(saved);
  };

  const handleToggleBookmark = async (paragraph) => {
    if (!story) return;

    const result = await toggleBookmark({
      storyId: story.id,
      paragraphId: paragraph.paragraph_id,
      paragraphOrder: paragraph.order,
      excerpt: paragraph.german_text,
    });

    setBookmarks(result.bookmarks);

    // Also advance the reading progress to this paragraph
    const idx = paragraphs.findIndex(
      (p) => p.paragraph_id === paragraph.paragraph_id
    );
    if (idx >= 0) await trackParagraphProgress(idx);
  };

  /**
   * Fetch French + Arabic translations from MyMemory (free, no key needed).
   * Returns { french, arabic } or null on failure.
   */
  const fetchTranslations = useCallback(async (germanWord) => {
    const cached = translationCacheRef.current[germanWord];
    if (cached) return cached;

    try {
      const [frRes, arRes] = await Promise.all([
        fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(germanWord)}&langpair=de|fr`),
        fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(germanWord)}&langpair=de|ar`),
      ]);
      const [frData, arData] = await Promise.all([frRes.json(), arRes.json()]);

      const french = frData?.responseData?.translatedText || null;
      const arabic = arData?.responseData?.translatedText || null;

      const result = { french, arabic };
      translationCacheRef.current[germanWord] = result;
      return result;
    } catch {
      return null;
    }
  }, []);

  const handleWordPress = async (word) => {
    if (!story) return;
    const term = normalizeTerm(word.german);
    const matched = vocabularyIndex[term] || globalVocabulary[term] || word;

    // If we already have translations, show immediately
    if (matched.french || matched.arabic || matched.translation) {
      setSelectedWord(matched);
      setTranslationLoading(false);
      return;
    }

    // Show modal with loading indicator while fetching
    setSelectedWord({ ...matched });
    setTranslationLoading(true);

    const result = await fetchTranslations(word.german);
    if (result) {
      setSelectedWord((prev) =>
        prev ? { ...prev, french: result.french, arabic: result.arabic } : prev
      );
    }
    setTranslationLoading(false);
  };

  const handleToggleSave = async (word) => {
    if (!story) return;
    const result = await toggleSavedWord(word, story.id);
    const storySaved = result.savedWords
      .filter((item) => item.storyId === story.id)
      .map((item) => normalizeTerm(item.german));
    setSavedWords(storySaved);
  };

  const handleToggleFavorite = async (word) => {
    if (!story) return;
    const result = await toggleFavoriteWord(word, story.id);
    const storyFavorites = result.favorites
      .filter((item) => item.storyId === story.id)
      .map((item) => normalizeTerm(item.german));
    setFavoriteWords(storyFavorites);
  };

  const playFromIndex = async (index) => {
    if (!isSpeakingRef.current) return;

    if (index >= speechItems.length) {
      await clearSpeechPosition(story.id);
      handleStop();
      return;
    }

    setAudioState('playing');
    setCurrentSpeechIndex(index);
    await saveSpeechPosition(story.id, index);

    const item = speechItems[index];
    startHighlightingForSentence(item);
    trackParagraphProgress(item.paragraphIndex);

    Speech.speak(item.text, {
      language: 'de-DE',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => {
        if (isSpeakingRef.current) {
          playFromIndex(index + 1);
        }
      },
      onStopped: () => {
        // Handled by state changes
      },
      onError: (err) => {
        console.warn('Speech error:', err);
        handleStop();
      },
    });
  };

  const handlePlayPause = async () => {
    if (!story) return;

    if (audioState === 'playing') {
      isSpeakingRef.current = false;
      Speech.stop();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setAudioState('paused');
      await saveSpeechPosition(story.id, currentSpeechIndex);
    } else {
      isSpeakingRef.current = true;
      playFromIndex(currentSpeechIndex);
    }
  };

  const handleStop = async () => {
    if (!story) return;

    isSpeakingRef.current = false;
    Speech.stop();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCurrentSpeechIndex(0);
    setActiveParagraphIndex(-1);
    setActiveWordIndex(-1);
    setAudioState('idle');
    await clearSpeechPosition(story.id);
  };

  const startQuiz = () => {
    navigation.navigate('StoryQuiz', { storyId: story.id });
  };

  if (!story) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>{t('stories.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F4F6FB" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, isRTL && { flexDirection: 'row-reverse' }]}> 
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('stories.readerTitle')}</Text>
          <View style={styles.backBtnSpacer} />
        </View>

        <View style={styles.storyHeader}>
          <Text style={styles.category}>{story.category}</Text>
          <Text style={styles.title}>{story.title}</Text>
          <Text style={styles.subtitle}>{story.summary}</Text>
          <View style={[styles.actionRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={[styles.actionButton, styles.actionPrimary]} onPress={handlePlayPause} activeOpacity={0.85}>
              <Ionicons name={audioState === 'playing' ? "pause" : "play"} size={16} color="#FFFFFF" />
              <Text style={styles.actionPrimaryText}>
                {audioState === 'playing' ? "Pause" : (audioState === 'paused' ? "Resume" : t('stories.listenStory'))}
              </Text>
            </TouchableOpacity>
            {audioState !== 'idle' && (
              <TouchableOpacity style={[styles.actionButton, styles.actionSecondary]} onPress={handleStop} activeOpacity={0.85}>
                <Ionicons name="stop" size={16} color="#4F46E5" />
                <Text style={styles.actionSecondaryText}>{t('stories.stopListening')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t('stories.paragraphs')}</Text>
          {paragraphs.length ? paragraphs.map((paragraph, paragraphIndex) => {
            const isActiveParagraph = activeParagraphIndex === paragraphIndex;

            // Build segments once per paragraph render; count word-only segments for index tracking
            const segments = splitParagraphText(paragraph.german_text, story.vocabulary, globalVocabulary) || [];
            let wordCounter = -1;

            return (
              <View
                key={paragraph.paragraph_id}
                style={[
                  styles.paragraphCard,
                  isActiveParagraph && styles.paragraphCardActive,
                ]}
              >
                <View style={[styles.paragraphHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={styles.paragraphLabel}>{t('stories.paragraph')} {paragraph.order}</Text>
                  <TouchableOpacity style={styles.bookmarkButton} onPress={() => handleToggleBookmark(paragraph)} activeOpacity={0.85}>
                    <Ionicons
                      name={bookmarks.some((item) => item.paragraphId === paragraph.paragraph_id) ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color="#4F46E5"
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.paragraphText, isRTL && { textAlign: 'right' }]}>
                  {segments.map((segment) => {
                    if (!segment.match) {
                      return <Text key={segment.key}>{segment.text}</Text>;
                    }

                    wordCounter += 1;
                    const myWordIndex = wordCounter;
                    const isHighlighted = isActiveParagraph && activeWordIndex === myWordIndex;
                    const normalized = normalizeTerm(segment.match.german);
                    const isSaved = savedWords.includes(normalized);
                    const isVocab = segment.isVocabulary;

                    return (
                      <Pressable key={segment.key} onPress={() => handleWordPress(segment.match)}>
                        <Text style={[
                          isVocab ? styles.vocabInline : styles.wordInline,
                          isSaved && styles.vocabInlineSaved,
                          isHighlighted && styles.activeWord,
                        ]}>
                          {segment.text}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Text>
                <Text style={[styles.translationText, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar'
                    ? paragraph.arabic_translation
                    : paragraph.french_translation}
                </Text>
              </View>
            );
          }) : (
            <Text style={[styles.quizSubText, isRTL && { textAlign: 'right' }]}>{t('stories.noQuiz')}</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t('stories.vocabularyPreview')}</Text>
          {vocabulary.slice(0, 8).map((word) => (
            <TouchableOpacity key={word.german} style={[styles.vocabRow, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => handleWordPress(word)} activeOpacity={0.85}> 
              <View style={styles.vocabBadge}>
                <Text style={styles.vocabBadgeText}>{word.article || '•'}</Text>
              </View>
              <View style={styles.vocabContent}>
                <Text style={[styles.vocabWord, isRTL && { textAlign: 'right' }]}>{word.german}</Text>
                <Text style={[styles.vocabMeta, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? word.arabic : word.french} · {word.example_sentence}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{t('stories.quizPreview')}</Text>
          <Text style={[styles.quizText, isRTL && { textAlign: 'right' }]}>
            {story.quiz?.length || 0} {t('stories.quizQuestions')}
          </Text>
          <Text style={[styles.quizSubText, isRTL && { textAlign: 'right' }]}>
            {t('stories.nextPhaseNote')}
          </Text>
          <TouchableOpacity style={styles.quizButton} onPress={startQuiz} activeOpacity={0.9}>
            <Text style={styles.quizButtonText}>{t('stories.openQuiz')}</Text>
            <Ionicons name="help-circle-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={Boolean(selectedWord)} transparent animationType="fade" onRequestClose={() => { setSelectedWord(null); setTranslationLoading(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedWord ? (() => {
              const term = normalizeTerm(selectedWord.german);
              const isUnknownWord = !vocabularyIndex[term] && !globalVocabulary[term];
              const showUnknownIndication = isUnknownWord && !translationLoading && !selectedWord.french && !selectedWord.arabic && !selectedWord.translation;
              return (
                <>
                  <View style={styles.modalHeaderRow}>
                    <Text style={styles.modalLabel}>🇩🇪 German word</Text>
                    {selectedWord.article ? (
                      <View style={styles.articlePillSmall}>
                        <Text style={styles.articlePillSmallText}>{selectedWord.article}</Text>
                      </View>
                    ) : null}
                    {isUnknownWord && (
                      <View style={[styles.articlePillSmall, { backgroundColor: '#FEE2E2', borderColor: '#FEE2E2' }]}>
                        <Text style={[styles.articlePillSmallText, { color: '#EF4444' }]}>{t('stories.unknownWord')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.modalTitle}>{selectedWord.german}</Text>
                  {selectedWord.pronunciation ? (
                    <Text style={styles.modalMeta}>{selectedWord.pronunciation}</Text>
                  ) : null}

                  {showUnknownIndication ? (
                    <View style={{ marginVertical: 12, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="alert-circle" size={18} color="#EF4444" />
                      <Text style={{ fontSize: 13, color: '#991B1B', fontWeight: '700' }}>
                        {t('stories.unknownWord')}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.modalLabel}>🇫🇷 French translation</Text>
                      {translationLoading ? (
                        <ActivityIndicator size="small" color="#4F46E5" style={{ marginVertical: 6 }} />
                      ) : (
                        <Text style={styles.modalTranslationText}>
                          {selectedWord.french || selectedWord.translation || '—'}
                        </Text>
                      )}

                      <Text style={styles.modalLabel}>🇦🇪 Arabic translation</Text>
                      {translationLoading ? (
                        <ActivityIndicator size="small" color="#4F46E5" style={{ marginVertical: 6 }} />
                      ) : (
                        <Text style={[styles.modalTranslationText, { textAlign: 'right' }]}>
                          {selectedWord.arabic || '—'}
                        </Text>
                      )}
                    </>
                  )}

                {Boolean(selectedWord.example_sentence || selectedWord.exampleSentence) ? (
                  <>
                    <Text style={styles.modalLabel}>Example sentence</Text>
                    <Text style={styles.modalExample}>
                      {selectedWord.example_sentence || selectedWord.exampleSentence}
                    </Text>
                  </>
                ) : null}

                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnCircle}
                    onPress={() => Speech.speak(selectedWord.german, { language: 'de-DE', pitch: 1, rate: 0.9 })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="volume-high" size={20} color="#4F46E5" />
                    <Text style={styles.actionBtnText}>{t('stories.listenWord')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtnCircle, savedWords.includes(normalizeTerm(selectedWord.german)) && styles.actionBtnCircleActive]}
                    onPress={() => handleToggleSave(selectedWord)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={savedWords.includes(normalizeTerm(selectedWord.german)) ? 'star' : 'star-outline'}
                      size={20}
                      color={savedWords.includes(normalizeTerm(selectedWord.german)) ? '#FFFFFF' : '#4F46E5'}
                    />
                    <Text style={[styles.actionBtnText, savedWords.includes(normalizeTerm(selectedWord.german)) && styles.actionBtnTextActive]}>
                      {savedWords.includes(normalizeTerm(selectedWord.german)) ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtnCircle, favoriteWords.includes(normalizeTerm(selectedWord.german)) && styles.actionBtnCircleActiveFav]}
                    onPress={() => handleToggleFavorite(selectedWord)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={favoriteWords.includes(normalizeTerm(selectedWord.german)) ? 'heart' : 'heart-outline'}
                      size={20}
                      color={favoriteWords.includes(normalizeTerm(selectedWord.german)) ? '#FFFFFF' : '#EF4444'}
                    />
                    <Text style={[styles.actionBtnText, favoriteWords.includes(normalizeTerm(selectedWord.german)) && styles.actionBtnTextActive]}>
                      {favoriteWords.includes(normalizeTerm(selectedWord.german)) ? 'Favorite' : 'Favorite'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.closeButton} onPress={() => { setSelectedWord(null); setTranslationLoading(false); }}>
                  <Text style={styles.closeButtonText}>{t('stories.close')}</Text>
                </TouchableOpacity>
              </>
            );
          })() : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#1A1A2E',
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtnSpacer: {
    width: 36,
    height: 36,
  },
  storyHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  category: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: '#1A1A2E',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionPrimary: {
    backgroundColor: '#4F46E5',
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionSecondary: {
    backgroundColor: '#EEF2FF',
  },
  actionSecondaryText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  paragraphCard: {
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#EEF2FF',
    padding: 14,
    marginBottom: 10,
  },
  paragraphCardActive: {
    borderColor: '#7C3AED',
    borderLeftWidth: 4,
    backgroundColor: '#F5F3FF',
  },
  paragraphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paragraphLabel: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  paragraphText: {
    color: '#1F2937',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 8,
  },
  vocabInline: {
    color: '#4338CA',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  vocabInlineSaved: {
    color: '#059669',
  },
  wordInline: {
    color: '#1F2937',
  },
  activeWord: {
    backgroundColor: '#7C3AED',
    color: '#FFFFFF',
    borderRadius: 5,
    overflow: 'hidden',
    paddingHorizontal: 2,
    fontWeight: '800',
  },
  translationText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  vocabRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  bookmarkButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vocabBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  vocabBadgeText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '800',
  },
  vocabContent: {
    flex: 1,
  },
  vocabWord: {
    color: '#1A1A2E',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  vocabMeta: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
  },
  quizText: {
    color: '#1A1A2E',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  quizSubText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  quizButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quizButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  modalMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  modalTranslationText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalExample: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  articlePillSmall: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  articlePillSmallText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    textTransform: 'lowercase',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
    marginBottom: 16,
  },
  actionBtnCircle: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    gap: 4,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  actionBtnCircleActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  actionBtnCircleActiveFav: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
  },
  actionBtnTextActive: {
    color: '#FFFFFF',
  },
  closeButton: {
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#1F2937',
    fontWeight: '800',
  },
});