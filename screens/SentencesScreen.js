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
import { CATEGORY_COLORS, FILTER_OPTIONS } from '../constants/categoryColors';
import { GradientFAB } from '../components/ui';
import AddSentenceModal from '../components/AddSentenceModal';
import { speakGerman, stopSpeech } from '../utils/speech';

const STORAGE_KEY = 'sentences';

export default function SentencesScreen() {
  const [sentences, setSentences] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  const loadSentences = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      setSentences(stored ? JSON.parse(stored) : []);
    } catch {
      setSentences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadSentences();
    return () => { stopSpeech(); setPlayingId(null); };
  }, [loadSentences]));

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

  const handleSentenceSaved = (newSentence) => {
    setSentences((prev) => [newSentence, ...prev]);
    setModalVisible(false);
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete sentence',
      'Remove this sentence from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = sentences.filter((s) => s.id !== item.id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setSentences(updated);
            } catch {
              Alert.alert('Error', 'Could not delete the sentence. Please try again.');
            }
          },
        },
      ]
    );
  };

  const filteredSentences = sentences.filter((s) => {
    const matchesFilter = activeFilter === 'All' || s.category === activeFilter;
    const q = search.trim().toLowerCase();
    return matchesFilter && (!q || s.sentence.toLowerCase().includes(q) || s.translation.toLowerCase().includes(q));
  });

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Gradient banner */}
      <LinearGradient
        colors={['#EC4899', '#8B5CF6', '#6366F1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerEyebrow}>PRACTICE PHRASES</Text>
          <Text style={styles.bannerTitle}>Sentences</Text>
          <Text style={styles.bannerSubtitle}>
            {sentences.length > 0
              ? `${sentences.length} sentence${sentences.length === 1 ? '' : 's'} saved`
              : 'Learn German in context'}
          </Text>
        </View>
        <Text style={styles.bannerEmoji}>💬</Text>
      </LinearGradient>

      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sentences or translations…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
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
          const colors = opt !== 'All' ? CATEGORY_COLORS[opt] : null;
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
          <Text style={styles.emptyIcon}>{isSearching ? '🔍' : '💬'}</Text>
        </View>
        <Text style={styles.emptyTitle}>
          {isSearching ? 'No sentences found' : 'No sentences yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isSearching
            ? 'Try a different search or filter'
            : 'Tap + to save your first sentence'}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const colors = item.category ? CATEGORY_COLORS[item.category] : null;
    const isPlaying = playingId === item.id;
    return (
      <View style={styles.card}>
        {/* Top row: category badge + delete */}
        <View style={styles.cardTopRow}>
          {colors ? (
            <View style={[styles.categoryBadge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.categoryBadgeText, { color: colors.text }]}>
                {item.category}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={18} color="#F87171" />
          </TouchableOpacity>
        </View>

        {/* German sentence */}
        <Text style={styles.germanText}>{item.sentence}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Translation */}
        <Text style={styles.translationText}>{item.translation}</Text>

        {/* Action row */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.listenBtn, isPlaying && styles.listenBtnActive]}
            onPress={() => handleSpeak(item.id, item.sentence)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={14}
              color={isPlaying ? '#FFFFFF' : '#8B5CF6'}
            />
            <Text style={[styles.listenText, isPlaying && styles.listenTextActive]}>
              {isPlaying ? 'Playing…' : 'Listen'}
            </Text>
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
          <ActivityIndicator size="large" color="#EC4899" />
        </View>
      ) : (
        <FlatList
          data={filteredSentences}
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

      <AddSentenceModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={handleSentenceSaved}
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

  /* Sentence card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  germanText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    lineHeight: 25,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  translationText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 14,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F3FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listenBtnActive: {
    backgroundColor: '#8B5CF6',
  },
  listenText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  listenTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#FDF2F8',
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
