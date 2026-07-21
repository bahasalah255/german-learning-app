import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Audio } from 'expo-av';
import { getVoiceModule, VOICE_UNAVAILABLE_MESSAGE } from '../utils/voiceModule';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { speakGerman, stopSpeech } from '../utils/speech';
import { CURATED_SENTENCES } from '../utils/curatedSentences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  getPracticeTexts,
  savePracticeText,
  updatePracticeText,
  deletePracticeText,
} from '../services/practiceStorage';
import RecordingAnimation from './RecordingAnimation';

const ARABIC_DIACRITICS = /َ|ً|ُ|ٌ|ِ|ٍ|ْ|ّ|ـ/g;

export function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(ARABIC_DIACRITICS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanGermanWord(word) {
  if (!word) return '';
  return String(word)
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¡¿"']/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .trim();
}

function compareSpeech(targetText, spokenText) {
  const targetWords = targetText.split(/\s+/).filter(Boolean);
  const spokenWords = spokenText.split(/\s+/).filter(Boolean);

  const tCleaned = targetWords.map(cleanGermanWord);
  const sCleaned = spokenWords.map(cleanGermanWord);

  const n = tCleaned.length;
  const m = sCleaned.length;

  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (tCleaned[i - 1] === sCleaned[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const matchedTargetIndices = new Set();
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (tCleaned[i - 1] === sCleaned[j - 1]) {
      matchedTargetIndices.add(i - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  let correctCount = 0;
  const wordResults = targetWords.map((word, index) => {
    const correct = matchedTargetIndices.has(index);
    if (correct) correctCount += 1;
    return { word, correct };
  });

  const accuracy =
    targetWords.length > 0
      ? Math.round((correctCount / targetWords.length) * 100)
      : 0;

  return { wordResults, accuracy };
}

async function requestMicrophonePermission() {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export default function SpeechTracker({ initialTargetText = '' }) {
  const Voice = useMemo(() => getVoiceModule(), []);
  const voiceAvailable = Voice != null;
  console.log('voiceAvailable =', voiceAvailable, '| Voice =', Voice);

  const navigation = useNavigation();
  const { t, language, isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const styles = useMemo(() => getStyles(c, isRTL, isDark), [c, isRTL, isDark]);

  const [activeCategory, setActiveCategory] = useState('A1');
  const [sentencesList, setSentencesList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [savedSentences, setSavedSentences] = useState([]);
  const [customSentence, setCustomSentence] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Recording & speech states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [wordResults, setWordResults] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(
    voiceAvailable ? null : VOICE_UNAVAILABLE_MESSAGE
  );

  // Custom Practice states
  const [customTexts, setCustomTexts] = useState([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customText, setCustomText] = useState('');
  const [editingTextId, setEditingTextId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [customPracticeActiveText, setCustomPracticeActiveText] = useState(null);

  const activeSentence = sentencesList[currentIndex] || null;

  const loadCustomTexts = useCallback(async () => {
    const data = await getPracticeTexts();
    setCustomTexts(data);
  }, []);

  const handleSaveCustomText = async () => {
    if (!customTitle.trim()) {
      Alert.alert(t('common.error'), t('custom.errorTitle'));
      return;
    }
    if (!customText.trim()) {
      Alert.alert(t('common.error'), t('custom.errorText'));
      return;
    }

    try {
      if (editingTextId) {
        await updatePracticeText(editingTextId, {
          title: customTitle.trim(),
          text: customText.trim(),
        });
        setEditingTextId(null);
      } else {
        await savePracticeText(customTitle.trim(), customText.trim());
      }
      setCustomTitle('');
      setCustomText('');
      loadCustomTexts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelEdit = () => {
    setEditingTextId(null);
    setCustomTitle('');
    setCustomText('');
  };

  const handleEditCustomText = (item) => {
    setEditingTextId(item.id);
    setCustomTitle(item.title);
    setCustomText(item.text);
  };

  const handleToggleFavorite = async (item) => {
    await updatePracticeText(item.id, { favorite: !item.favorite });
    loadCustomTexts();
  };

  const handleDeleteCustomText = (item) => {
    Alert.alert(
      t('common.confirm'),
      t('custom.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deletePracticeText(item.id);
            loadCustomTexts();
            if (customPracticeActiveText?.id === item.id) {
              setCustomPracticeActiveText(null);
              setSentencesList([]);
              setCurrentIndex(0);
            }
          },
        },
      ]
    );
  };

  const handlePracticeCustomText = (item) => {
    resetPracticeState();
    
    const phrases = item.text
      .split(/[.?!]|\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (phrases.length === 0) {
      Alert.alert('Info', t('custom.errorNoSentences'));
      return;
    }

    const items = phrases.map((phrase, index) => ({
      id: `custom-practice-${item.id}-${index}`,
      sentence: phrase,
      translation: '',
      level: 'Custom Practice',
    }));

    setSentencesList(items);
    setCurrentIndex(0);
    setCustomPracticeActiveText(item);
  };

  const filteredTexts = useMemo(() => {
    const filtered = customTexts.filter((t) =>
      t.title.toLowerCase().includes(searchText.toLowerCase())
    );
    return filtered.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [customTexts, searchText]);

  // Load saved custom sentences
  const loadSavedSentences = async () => {
    setLoadingSaved(true);
    try {
      const raw = await AsyncStorage.getItem('sentences');
      const loaded = raw ? JSON.parse(raw) : [];
      setSavedSentences(loaded);
      return loaded;
    } catch {
      setSavedSentences([]);
      return [];
    } finally {
      setLoadingSaved(false);
    }
  };

  // Initialize sentences on mount / prop changes
  useEffect(() => {
    const init = async () => {
      const saved = await loadSavedSentences();

      if (initialTargetText) {
        // 1. Search in curated sentences
        const curatedMatch = CURATED_SENTENCES.find(
          (s) => s.sentence.toLowerCase() === initialTargetText.toLowerCase()
        );
        if (curatedMatch) {
          setActiveCategory(curatedMatch.level);
          const filtered = CURATED_SENTENCES.filter((s) => s.level === curatedMatch.level);
          setSentencesList(filtered);
          const idx = filtered.findIndex((s) => s.id === curatedMatch.id);
          setCurrentIndex(idx >= 0 ? idx : 0);
          return;
        }

        // 2. Search in saved sentences
        const savedMatch = saved.find(
          (s) => s.sentence.toLowerCase() === initialTargetText.toLowerCase()
        );
        if (savedMatch) {
          setActiveCategory('saved');
          setSentencesList(saved);
          const idx = saved.findIndex((s) => s.id === savedMatch.id);
          setCurrentIndex(idx >= 0 ? idx : 0);
          return;
        }

        // 3. Fallback: temporary custom sentence
        const tempItem = {
          id: 'temp-custom',
          sentence: initialTargetText,
          translation: '',
          level: 'Custom',
        };
        setCustomSentence(tempItem);
        setActiveCategory('custom');
        setSentencesList([tempItem]);
        setCurrentIndex(0);
      } else {
        // Default: load A1 curated sentences
        const filtered = CURATED_SENTENCES.filter((s) => s.level === 'A1');
        setSentencesList(filtered);
        setCurrentIndex(0);
        setActiveCategory('A1');
      }
    };

    init();
  }, [initialTargetText]);

  useEffect(() => {
    loadCustomTexts();
  }, [loadCustomTexts]);

  const resetPracticeState = () => {
    setAccuracy(null);
    setWordResults([]);
    setSpokenText('');
    setError(null);
    stopSpeech();
    setIsPlaying(false);
    setShowTranslation(false);
  };

  const handleCategoryChange = async (cat) => {
    setActiveCategory(cat);
    resetPracticeState();

    if (cat === 'saved') {
      const saved = await loadSavedSentences();
      setSentencesList(saved);
      setCurrentIndex(0);
    } else if (cat === 'custom' && customSentence) {
      setSentencesList([customSentence]);
      setCurrentIndex(0);
    } else if (cat === 'custom_practice') {
      setSentencesList([]);
      setCurrentIndex(0);
      setCustomPracticeActiveText(null);
    } else {
      const filtered = CURATED_SENTENCES.filter((s) => s.level === cat);
      setSentencesList(filtered);
      setCurrentIndex(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < sentencesList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetPracticeState();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      resetPracticeState();
    }
  };

  const handleShuffle = () => {
    if (sentencesList.length > 1) {
      let nextIdx = currentIndex;
      while (nextIdx === currentIndex) {
        nextIdx = Math.floor(Math.random() * sentencesList.length);
      }
      setCurrentIndex(nextIdx);
      resetPracticeState();
    }
  };

  const handleListen = () => {
    if (!activeSentence) return;
    if (isPlaying) {
      stopSpeech();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    speakGerman(activeSentence.sentence, {
      onStart: () => setIsPlaying(true),
      onDone: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const getTranslationText = (sentence) => {
    if (!sentence) return '';
    if (typeof sentence.translation === 'string') return sentence.translation;
    return sentence.translation[language] || sentence.translation.en || '';
  };

  const getLevelLabel = (lvl) => {
    if (lvl === 'A1') return `A1 · ${t('learnGerman.filters.beginner')}`;
    if (lvl === 'A2') return `A2 · ${t('learnGerman.filters.beginner')}`;
    if (lvl === 'B1') return `B1 · ${t('learnGerman.filters.intermediate')}`;
    if (lvl === 'B2') return `B2 · ${t('learnGerman.filters.advanced')}`;
    return lvl;
  };

  const applyResults = useCallback(
    (transcript) => {
      const text = transcript?.trim() ?? '';
      setSpokenText(text);
      if (!text || !activeSentence) {
        setWordResults([]);
        setAccuracy(0);
        return;
      }
      const { wordResults: results, accuracy: pct } = compareSpeech(
        activeSentence.sentence,
        text
      );
      setWordResults(results);
      setAccuracy(pct);
    },
    [activeSentence?.sentence]
  );

  useEffect(() => {
    if (!Voice) return undefined;

    Voice.onSpeechStart = () => {
      setIsRecording(true);
      setError(null);
    };

    Voice.onSpeechEnd = () => {
      setIsRecording(false);
      setIsProcessing(true);
    };

    Voice.onSpeechResults = (event) => {
      setIsProcessing(false);
      const transcript = event.value?.[0] ?? '';
      applyResults(transcript);
    };

    Voice.onSpeechError = (event) => {
      setIsRecording(false);
      setIsProcessing(false);
      const message =
        event.error?.message ||
        'La reconnaissance vocale a échoué. Réessayez sur un appareil réel.';
      setError(message);
    };

    return () => {
      stopSpeech();
      Voice.destroy()
        .then(Voice.removeAllListeners)
        .catch(() => Voice.removeAllListeners());
    };
  }, [Voice, applyResults]);

  const startRecording = async () => {
    if (!Voice) {
      setError(VOICE_UNAVAILABLE_MESSAGE);
      return;
    }

    setError(null);
    setSpokenText('');
    setWordResults([]);
    setAccuracy(null);

    const granted = await requestMicrophonePermission();
    if (!granted) {
      setError(
        'Permission micro refusée. Activez le micro dans les réglages de l’appareil.'
      );
      return;
    }

    try {
      await Voice.cancel();
      await Voice.start('de-DE');
    } catch (err) {
      setIsRecording(false);
      setIsProcessing(false);
      setError(
        err?.message ||
          'Impossible de démarrer l’enregistrement. Utilisez un development build sur appareil réel.'
      );
    }
  };

  const stopRecording = async () => {
    if (!Voice) return;

    try {
      await Voice.stop();
    } catch (err) {
      setIsRecording(false);
      setIsProcessing(false);
      setError(err?.message || 'Impossible d’arrêter l’enregistrement.');
    }
  };

  const handlePressIn = () => {
    if (!voiceAvailable || isRecording || isProcessing) return;
    startRecording();
  };

  const handlePressOut = () => {
    if (!voiceAvailable || (!isRecording && !isProcessing)) return;
    stopRecording();
  };

  const busy = isRecording || isProcessing;

  const categories = useMemo(() => {
    const cats = ['A1', 'A2', 'B1', 'B2', 'saved', 'custom_practice'];
    if (customSentence) {
      cats.push('custom');
    }
    return cats;
  }, [customSentence]);

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('speechTracker.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.tabsScroll,
            isRTL && { flexDirection: 'row-reverse' },
          ]}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            const label = cat === 'saved'
              ? t('speechTracker.savedCategory')
              : cat === 'custom'
              ? 'Temp'
              : cat === 'custom_practice'
              ? t('custom.tabLabel')
              : cat;

            return (
              <TouchableOpacity
                key={cat}
                onPress={() => handleCategoryChange(cat)}
                activeOpacity={0.8}
                style={styles.tabWrapper}
              >
                {isActive ? (
                  <LinearGradient
                    colors={['#7C3AED', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activeTab}
                  >
                    <Text style={styles.activeTabText}>{label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.inactiveTab}>
                    <Text style={styles.inactiveTabText}>{label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.mainScroll}
      >
        {loadingSaved ? (
          <View style={styles.centerWrapper}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : activeCategory === 'custom_practice' && !customPracticeActiveText ? (
          // Custom Practice Screen (List & Form)
          <View style={styles.customPracticeContainer}>
            {/* Form Card */}
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {editingTextId ? t('custom.editTitle') : t('custom.newTitle')}
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder={t('custom.titlePlaceholder')}
                placeholderTextColor="#94A3B8"
                value={customTitle}
                onChangeText={setCustomTitle}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('custom.textPlaceholder')}
                placeholderTextColor="#94A3B8"
                value={customText}
                onChangeText={setCustomText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              
              <View style={styles.formButtonsRow}>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveCustomText}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#4F46E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtnGradient}
                  >
                    <Text style={styles.saveBtnText}>
                      {editingTextId ? t('custom.update') : t('custom.save')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                {editingTextId && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleCancelEdit}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelBtnText}>{t('custom.cancel')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('custom.searchPlaceholder')}
                placeholderTextColor="#94A3B8"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            {/* List of Custom Texts */}
            {filteredTexts.length === 0 ? (
              <View style={styles.emptyCustomCard}>
                <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyText}>
                  {searchText
                    ? t('custom.emptySearch')
                    : t('custom.emptyList')}
                </Text>
              </View>
            ) : (
              filteredTexts.map((item) => {
                const previewLines = item.text
                  .split('\n')
                  .filter(line => line.trim())
                  .slice(0, 3);
                
                return (
                  <View key={item.id} style={styles.customTextCard}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.customCardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleToggleFavorite(item)}
                        style={styles.favoriteBtn}
                      >
                        <Ionicons
                          name={item.favorite ? 'star' : 'star-outline'}
                          size={22}
                          color={item.favorite ? '#F59E0B' : '#94A3B8'}
                        />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.customCardPreview} numberOfLines={3}>
                      {previewLines.join('\n')}
                    </Text>

                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.practiceActionBtn}
                        onPress={() => handlePracticeCustomText(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="play" size={16} color="#FFFFFF" />
                      <Text style={styles.practiceActionText}>{t('custom.practice')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.editActionBtn}
                        onPress={() => handleEditCustomText(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="create-outline" size={16} color="#4F46E5" />
                        <Text style={styles.editActionText}>{t('custom.edit')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteActionBtn}
                        onPress={() => handleDeleteCustomText(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={styles.deleteActionText}>{t('custom.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : !activeSentence ? (
          // Empty State
          <View style={styles.emptyCard}>
            <Ionicons name="chatbox-ellipses-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyText}>
              {activeCategory === 'saved'
                ? t('speechTracker.noSavedSentences')
                : t('speechTracker.noSentences')}
            </Text>
            {activeCategory === 'saved' && (
              <TouchableOpacity
                style={styles.goToPhrasesBtn}
                onPress={() => navigation.navigate('Sentences')}
                activeOpacity={0.8}
              >
                <Text style={styles.goToPhrasesText}>{t('sentences.title')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Main Swiper / Card
          <View style={styles.cardWrapper}>
            <View style={styles.sentenceCard}>
              {/* Top Card Info & Play Button */}
              <View style={[styles.cardTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>
                      {getLevelLabel(activeSentence.level)}
                    </Text>
                  </View>
                  {activeCategory === 'custom_practice' && (
                    <TouchableOpacity
                      onPress={() => {
                        setCustomPracticeActiveText(null);
                        setSentencesList([]);
                        setCurrentIndex(0);
                      }}
                      style={styles.backToListBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="list-outline" size={14} color="#4F46E5" style={{ marginRight: 4 }} />
                <Text style={styles.backToListText}>{t('speechTracker.backToList')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  onPress={handleListen}
                  style={[styles.audioBtn, isPlaying && styles.audioBtnActive]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
                    size={20}
                    color={isPlaying ? '#FFFFFF' : c.primary}
                  />
                </TouchableOpacity>
              </View>

              {/* Target Text display */}
              <Text style={styles.targetText}>
                {activeSentence.sentence
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((word, index, arr) => {
                    let wordColor = c.textPrimary;
                    if (accuracy !== null) {
                      const isCorrect = wordResults[index]?.correct;
                      wordColor = isCorrect ? '#10B981' : '#EF4444';
                    }
                    return (
                      <Text key={`${word}-${index}`} style={{ color: wordColor }}>
                        {word}
                        {index < arr.length - 1 ? ' ' : ''}
                      </Text>
                    );
                  })}
              </Text>

              {/* Translation section */}
              {getTranslationText(activeSentence) ? (
                <View style={styles.translationContainer}>
                  {showTranslation && (
                    <Text style={styles.translationText}>
                      {getTranslationText(activeSentence)}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={() => setShowTranslation((prev) => !prev)}
                    style={[
                      styles.toggleTranslationBtn,
                      isRTL && { flexDirection: 'row-reverse' },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showTranslation ? 'eye-off-outline' : 'eye-outline'}
                      size={16}
                      color="#64748B"
                    />
                    <Text style={styles.toggleTranslationText}>
                      {showTranslation
                        ? t('speechTracker.hideTranslation')
                        : t('speechTracker.showTranslation')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {/* Pagination Controls */}
            {sentencesList.length > 1 && (
              <View style={[styles.pagerRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity
                  onPress={handlePrev}
                  disabled={currentIndex === 0}
                  style={[styles.pagerBtn, currentIndex === 0 && styles.pagerBtnDisabled]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={20} color={currentIndex === 0 ? c.textPlaceholder : c.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShuffle}
                  style={styles.pagerBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="shuffle-outline" size={20} color={c.primary} />
                </TouchableOpacity>

                <Text style={styles.pagerIndicator}>
                  {currentIndex + 1} / {sentencesList.length}
                </Text>

                <TouchableOpacity
                  onPress={handleNext}
                  disabled={currentIndex === sentencesList.length - 1}
                  style={[
                    styles.pagerBtn,
                    currentIndex === sentencesList.length - 1 && styles.pagerBtnDisabled,
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={currentIndex === sentencesList.length - 1 ? c.textPlaceholder : c.primary}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Micro Interaction & Results */}
            <View style={styles.interactionSection}>
              {!voiceAvailable && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>{VOICE_UNAVAILABLE_MESSAGE}</Text>
                </View>
              )}

              <RecordingAnimation
                isRecording={isRecording}
                isProcessing={isProcessing}
                voiceAvailable={voiceAvailable}
                handlePressIn={handlePressIn}
                handlePressOut={handlePressOut}
                language={language}
                t={t}
              />

              {error && voiceAvailable ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Accuracy Display */}
              {accuracy !== null && (
                <View style={styles.resultsSection}>
                  <View style={styles.accuracyHeader}>
                    <Text style={styles.accuracyLabel}>{t('speechTracker.accuracy')}</Text>
                    <Text style={styles.accuracyValue}>{accuracy}%</Text>
                  </View>

                  <View style={styles.resultDetailsCard}>
                    <Text style={styles.detailTitle}>{t('speechTracker.targetWords')}</Text>
                    <View style={[styles.wordsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      {wordResults.map((item, index) => (
                        <Text
                          key={`${item.word}-${index}`}
                          style={[
                            styles.wordChip,
                            item.correct ? styles.wordCorrect : styles.wordIncorrect,
                          ]}
                        >
                          {item.word}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.detailDivider} />

                    <Text style={styles.detailTitle}>{t('speechTracker.youSaid')}</Text>
                    <Text style={styles.spokenText}>
                      "{spokenText || '—'}"
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {Platform.OS === 'ios' && (
          <Text style={styles.hint}>{t('speechTracker.iosHint')}</Text>
        )}
        {Platform.OS === 'android' && (
          <Text style={styles.hint}>{t('speechTracker.androidHint')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

function getStyles(c, isRTL, isDark) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      height: 60,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.borderLight,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
    },
    headerSpacer: {
      width: 40,
    },
    tabsContainer: {
      backgroundColor: c.card,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    tabsScroll: {
      paddingHorizontal: 16,
      gap: 8,
    },
    tabWrapper: {
      borderRadius: 20,
      overflow: 'hidden',
    },
    activeTab: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    activeTabText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    inactiveTab: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inactiveTabText: {
      color: c.textSecondary,
      fontWeight: '600',
      fontSize: 14,
    },
    mainScroll: {
      padding: 20,
      paddingBottom: 40,
    },
    centerWrapper: {
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyCard: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 16,
      elevation: 2,
      marginTop: 20,
    },
    emptyText: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 22,
      fontWeight: '500',
    },
    goToPhrasesBtn: {
      marginTop: 20,
      backgroundColor: c.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 16,
    },
    goToPhrasesText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    cardWrapper: {
      width: '100%',
    },
    sentenceCard: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 16,
      elevation: 4,
      marginBottom: 20,
    },
    cardTopRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    levelBadge: {
      backgroundColor: c.borderLight,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    levelBadgeText: {
      color: c.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    audioBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioBtnActive: {
      backgroundColor: c.primary,
    },
    targetText: {
      fontSize: 26,
      fontWeight: '800',
      color: c.textPrimary,
      textAlign: 'center',
      lineHeight: 38,
      marginBottom: 24,
    },
    translationContainer: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 16,
      alignItems: 'center',
    },
    translationText: {
      fontSize: 16,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 10,
      fontStyle: 'italic',
    },
    toggleTranslationBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    toggleTranslationText: {
      fontSize: 13,
      color: c.textSecondary,
      fontWeight: '600',
    },
    pagerRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      marginBottom: 24,
    },
    pagerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    pagerBtnDisabled: {
      backgroundColor: c.borderLight,
      borderColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
    },
    pagerIndicator: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      minWidth: 60,
      textAlign: 'center',
    },
    interactionSection: {
      alignItems: 'center',
      marginTop: 10,
    },
    warningBox: {
      backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      width: '100%',
    },
    warningText: {
      color: isDark ? '#F59E0B' : '#92400E',
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    recordButton: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.3,
      shadowRadius: 10,
      elevation: 5,
    },
    recordButtonDisabled: {
      backgroundColor: c.border,
      shadowColor: c.border,
    },
    recordButtonActive: {
      backgroundColor: '#EF4444',
      shadowColor: '#EF4444',
    },
    recordButtonPressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.9,
    },
    statusText: {
      textAlign: 'center',
      fontSize: 14,
      color: c.textSecondary,
      fontWeight: '600',
      marginBottom: 20,
    },
    errorBox: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
      borderRadius: 16,
      padding: 16,
      width: '100%',
      marginBottom: 20,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    resultsSection: {
      width: '100%',
      marginTop: 10,
    },
    accuracyHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    accuracyLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: c.textPrimary,
    },
    accuracyValue: {
      fontSize: 22,
      fontWeight: '900',
      color: '#10B981',
    },
    resultDetailsCard: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 16,
      elevation: 2,
    },
    detailTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    wordsRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    wordChip: {
      fontSize: 15,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: c.borderLight,
      color: c.textPrimary,
      overflow: 'hidden',
    },
    wordCorrect: {
      color: '#10B981',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5',
    },
    wordIncorrect: {
      color: '#EF4444',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
    },
    detailDivider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: 16,
    },
    spokenText: {
      fontSize: 16,
      color: c.textPrimary,
      fontWeight: '500',
      lineHeight: 24,
      fontStyle: 'italic',
      textAlign: isRTL ? 'right' : 'left',
    },
    hint: {
      marginTop: 30,
      fontSize: 12,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    customPracticeContainer: {
      width: '100%',
      gap: 16,
    },
    formCard: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 16,
      elevation: 4,
      marginBottom: 8,
    },
    formTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: 16,
      textAlign: isRTL ? 'right' : 'left',
    },
    input: {
      backgroundColor: c.inputBg,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 14,
      color: c.textPrimary,
      marginBottom: 12,
      fontWeight: '500',
      textAlign: isRTL ? 'right' : 'left',
    },
    textArea: {
      height: 100,
      paddingTop: 12,
    },
    formButtonsRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 12,
      marginTop: 4,
    },
    saveBtn: {
      flex: 1,
      borderRadius: 14,
      overflow: 'hidden',
    },
    saveBtnGradient: {
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    cancelBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.borderLight,
    },
    cancelBtnText: {
      color: c.textSecondary,
      fontWeight: '600',
      fontSize: 14,
    },
    searchContainer: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      height: 48,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    searchIcon: {
      marginRight: isRTL ? 0 : 10,
      marginLeft: isRTL ? 10 : 0,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: c.textPrimary,
      fontWeight: '500',
      height: '100%',
      textAlign: isRTL ? 'right' : 'left',
    },
    emptyCustomCard: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 16,
      elevation: 2,
      marginTop: 8,
    },
    customTextCard: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 16,
      elevation: 2,
    },
    cardHeaderRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    customCardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: c.textPrimary,
      flex: 1,
      marginRight: isRTL ? 0 : 10,
      marginLeft: isRTL ? 10 : 0,
      textAlign: isRTL ? 'right' : 'left',
    },
    favoriteBtn: {
      padding: 4,
    },
    customCardPreview: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
      fontStyle: 'italic',
      textAlign: isRTL ? 'right' : 'left',
    },
    cardActionsRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      alignItems: 'center',
    },
    practiceActionBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    practiceActionText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    editActionBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.borderLight,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    editActionText: {
      color: c.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    deleteActionBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      marginLeft: isRTL ? 0 : 'auto',
      marginRight: isRTL ? 'auto' : 0,
    },
    deleteActionText: {
      color: '#EF4444',
      fontSize: 12,
      fontWeight: '700',
    },
    backToListBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: c.borderLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    backToListText: {
      color: c.primary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}