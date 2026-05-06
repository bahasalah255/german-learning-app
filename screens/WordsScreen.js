import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ARTICLE_COLORS, FILTER_OPTIONS } from '../constants/articleColors';
import { GradientFAB } from '../components/ui';
import AddWordModal from '../components/AddWordModal';
import { speakGerman, stopSpeech } from '../utils/speech';

const STORAGE_KEY = 'words';

export default function WordsScreen() {
  const [words, setWords] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  const loadWords = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setWords(stored ? JSON.parse(stored) : []);
    } catch {
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadWords();
    return () => { stopSpeech(); setPlayingId(null); };
  }, [loadWords]));

  const handleSpeak = (id, text) => {
    if (playingId === id) {
      stopSpeech();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    speakGerman(text, {
      onDone: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const handleWordSaved = (newWord) => {
    setWords((prev) => [newWord, ...prev]);
    setModalVisible(false);
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete word',
      `Remove "${item.word}" from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = words.filter((w) => w.id !== item.id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setWords(updated);
            } catch {
              Alert.alert('Error', 'Could not delete the word. Please try again.');
            }
          },
        },
      ]
    );
  };

  const filteredWords = words.filter((w) => {
    const matchesFilter = activeFilter === 'All' || w.article === activeFilter;
    const q = search.trim().toLowerCase();
    return matchesFilter && (!q || w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q));
  });

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Gradient banner */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerEyebrow}>YOUR VOCABULARY</Text>
          <Text style={styles.bannerTitle}>Words</Text>
          <Text style={styles.bannerSubtitle}>
            {words.length > 0
              ? `${words.length} word${words.length === 1 ? '' : 's'} saved`
              : 'Build your vocabulary'}
          </Text>
        </View>
        <Text style={styles.bannerEmoji}>📚</Text>
      </LinearGradient>

      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search words or translations…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = opt === activeFilter;
          const colors = opt !== 'All' ? ARTICLE_COLORS[opt] : null;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.filterChip,
                isActive && (colors ? { backgroundColor: colors.bg } : styles.filterChipActiveAll),
              ]}
              onPress={() => setActiveFilter(opt)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && (colors ? { color: colors.text } : styles.filterChipTextAll),
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    const isSearching = search.trim() || activeFilter !== 'All';
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Text style={styles.emptyIcon}>{isSearching ? '🔍' : '📚'}</Text>
        </View>
        <Text style={styles.emptyTitle}>
          {isSearching ? 'No words found' : 'No words yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching
            ? 'Try a different search or filter'
            : 'Tap + to add your first word'}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const colors = ARTICLE_COLORS[item.article] || ARTICLE_COLORS.der;
    const isPlaying = playingId === item.id;
    return (
      <View style={styles.wordCard}>
        {/* Article badge */}
        <View style={[styles.articleBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.articleText, { color: colors.text }]}>{item.article}</Text>
        </View>

        {/* Word + translation */}
        <View style={styles.wordInfo}>
          <Text style={styles.wordText}>{item.word}</Text>
          <Text style={styles.translationText}>{item.translation}</Text>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.listenIconBtn, isPlaying && styles.listenIconBtnActive]}
            onPress={() => handleSpeak(item.id, `${item.article} ${item.word}`)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={20}
              color={isPlaying ? '#FFFFFF' : '#8B5CF6'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={18} color="#F87171" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={filteredWords}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      <GradientFAB onPress={() => setModalVisible(true)} />

      <AddWordModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={handleWordSaved}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },

  /* Banner */
  listHeader: {
    paddingTop: 20,
    marginBottom: 4,
  },
  banner: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flex: 1,
  },
  bannerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },
  bannerEmoji: {
    fontSize: 52,
    marginLeft: 12,
  },

  /* Search */
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
    padding: 0,
  },

  /* Filters */
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterChipActiveAll: {
    backgroundColor: '#EEF2FF',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  filterChipTextAll: {
    color: '#4F46E5',
  },

  /* Word card */
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  articleBadge: {
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
    minWidth: 52,
    alignItems: 'center',
  },
  articleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  wordInfo: {
    flex: 1,
  },
  wordText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 3,
  },
  translationText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 4,
  },
  listenIconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  listenIconBtnActive: {
    backgroundColor: '#8B5CF6',
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 21,
  },
});
