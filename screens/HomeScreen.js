import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadLastOpenedStory, loadAllStoryProgress } from '../features/stories/services/StoryInteractionService';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  loadProgress,
  updateStreak,
  xpInCurrentLevel,
  xpForNextLevel,
} from '../utils/progress';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;
  const now    = new Date();
  const days   = t('days');
  const months = t('months');
  const day    = Array.isArray(days)   ? days[now.getDay()]    : '';
  const month  = Array.isArray(months) ? months[now.getMonth()] : '';
  const dateStr = isRTL
    ? `${now.getDate()} ${month} · ${day}`
    : `${day} · ${month} ${now.getDate()}`;

  const hour     = now.getHours();
  const greetKey = hour < 12 ? 'greeting.morning' : hour < 17 ? 'greeting.afternoon' : 'greeting.evening';

  const styles = useMemo(() => StyleSheet.create({
    row:          { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
    date:         { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginBottom: 4 },
    greeting:     { fontSize: 26, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },
    avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: c.borderLight, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    avatarLetter: { fontSize: 18, fontWeight: '800', color: c.primary },
  }), [c, isRTL]);

  return (
    <View style={styles.row}>
      <View>
        <Text style={[styles.date, isRTL && { textAlign: 'right' }]}>{dateStr}</Text>
        <Text style={[styles.greeting, isRTL && { textAlign: 'right' }]}>{t(greetKey)}</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>L</Text>
      </View>
    </View>
  );
}

// ─── HeroCard ─────────────────────────────────────────────────────────────────

function HeroCard({ streak, onPress }) {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  return (
    <LinearGradient
      colors={theme.colors.primary === '#818CF8' ? ['#4338CA', '#6D28D9', '#DB2777'] : ['#6366F1', '#8B5CF6', '#EC4899']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={hero.card}
    >
      <View style={[hero.topRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={hero.streakPill}>
          <Ionicons name="flame" size={13} color="#FFFFFF" />
          <Text style={hero.streakPillText}> {t('home.streakDays', { n: streak })}</Text>
        </View>
        <Ionicons name="trophy" size={28} color="rgba(255,255,255,0.9)" />
      </View>

      <Text style={[hero.eyebrow,  isRTL && { textAlign: 'right' }]}>{t('home.letLearnToday')}</Text>
      <Text style={[hero.title,    isRTL && { textAlign: 'right' }]}>{t('home.buildStreak')}</Text>
      <Text style={[hero.subtitle, isRTL && { textAlign: 'right' }]}>{t('home.keepGoing')}</Text>

      <TouchableOpacity
        style={[hero.button, isRTL && { alignSelf: 'flex-end', flexDirection: 'row-reverse' }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={hero.buttonText}>{t('home.startNow')}</Text>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const hero = StyleSheet.create({
  card:           { borderRadius: 24, padding: 22, marginBottom: 18 },
  topRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  streakPill:     { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' },
  streakPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  eyebrow:        { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 6 },
  title:          { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 6, letterSpacing: -0.3 },
  subtitle:       { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 20, lineHeight: 20 },
  button:         { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonText:     { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

// ─── StatsRow ─────────────────────────────────────────────────────────────────

function StatsRow({ streak, xp, level }) {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;
  const currentXP = xpInCurrentLevel(xp, level);
  const needed    = xpForNextLevel();
  const pct       = Math.min(currentXP / needed, 1);

  const styles = useMemo(() => StyleSheet.create({
    row:        { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginBottom: 18 },
    card:       { flex: 1, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: theme.dark ? 0.3 : 0.06, shadowRadius: 8, elevation: 2 },
    streakCard: { backgroundColor: theme.dark ? c.card : '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
    xpCard:     { backgroundColor: c.card },
    icon:       { marginBottom: 6 },
    label:      { fontSize: 10, fontWeight: '700', color: c.textSecondary, letterSpacing: 1.2, marginBottom: 2 },
    value:      { fontSize: 30, fontWeight: '800', color: c.textPrimary, lineHeight: 34 },
    unit:       { fontSize: 12, color: c.textSecondary, fontWeight: '600' },
    xpTop:      { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
    levelPill:  { backgroundColor: c.borderLight, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
    levelText:  { fontSize: 12, fontWeight: '800', color: c.primary },
    barTrack:   { height: 6, backgroundColor: c.borderLight, borderRadius: 3, overflow: 'hidden', marginTop: 8, marginBottom: 4 },
    barFill:    { height: '100%', backgroundColor: c.primary, borderRadius: 3 },
    xpSub:      { fontSize: 10, color: c.textMuted, fontWeight: '500' },
  }), [c, isRTL, theme.dark]);

  return (
    <View style={styles.row}>
      <View style={[styles.card, styles.streakCard]}>
        <Ionicons name="flame" size={24} color="#F97316" style={styles.icon} />
        <Text style={styles.label}>{t('home.streak')}</Text>
        <Text style={styles.value}>{streak}</Text>
        <Text style={styles.unit}>{t('home.days')}</Text>
      </View>

      <View style={[styles.card, styles.xpCard]}>
        <View style={styles.xpTop}>
          <Ionicons name="star" size={24} color="#F59E0B" style={styles.icon} />
          <View style={styles.levelPill}>
            <Text style={styles.levelText}>{t('home.level', { n: level })}</Text>
          </View>
        </View>
        <Text style={[styles.label, isRTL && { textAlign: 'right' }]}>{t('home.xp')}</Text>
        <Text style={[styles.value, isRTL && { textAlign: 'right' }]}>{xp}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
        </View>
        <Text style={[styles.xpSub, isRTL && { textAlign: 'right' }]}>
          {t('home.toLevelUp', { cur: currentXP, max: needed })}
        </Text>
      </View>
    </View>
  );
}

// ─── WordCard ─────────────────────────────────────────────────────────────────

function WordCard({ wordData }) {
  const { t, isRTL } = useLanguage();
  const { article = 'die', word = 'Sonne', translation = 'the sun' } = wordData ?? {};

  return (
    <LinearGradient
      colors={['#F43F5E', '#EC4899', '#A855F7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={wc.card}
    >
      <Text style={[wc.sectionLabel, isRTL && { textAlign: 'right' }]}>{t('home.wordOfTheDay')}</Text>

      <View style={[wc.wordRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={wc.articleBadge}>
          <Text style={wc.articleText}>{article}</Text>
        </View>
        <Text style={wc.word}>{word}</Text>
      </View>

      <Text style={[wc.translation, isRTL && { textAlign: 'right' }]}>{translation}</Text>

      <View style={[wc.actions, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity style={wc.actionBtn} activeOpacity={0.8}>
          <Ionicons name="volume-medium-outline" size={15} color="#FFFFFF" />
          <Text style={wc.actionBtnText}>{t('common.listen')}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const wc = StyleSheet.create({
  card:          { borderRadius: 24, padding: 22, marginBottom: 18 },
  sectionLabel:  { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 14 },
  wordRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  articleBadge:  { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.25)' },
  articleText:   { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  word:          { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  translation:   { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  actions:       { flexDirection: 'row', gap: 10 },
  actionBtn:     { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

// ─── Buttons ──────────────────────────────────────────────────────────────────

function QuizButton({ onPress }) {
  const { t, isRTL } = useLanguage();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={qb.wrapper}>
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[qb.gradient, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <Text style={qb.text}>{t('home.startQuiz')}</Text>
        <View style={qb.xpPill}>
          <Text style={qb.xpText}>{t('home.xpPill')}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ScanButton({ onPress }) {
  const { t, isRTL } = useLanguage();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={sb.wrapper}>
      <LinearGradient
        colors={['#7B61FF', '#C850C0', '#FF6B9D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[sb.gradient, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
        <Text style={sb.text}>{t('home.scanQR')}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const qb = StyleSheet.create({
  wrapper:  { borderRadius: 18, overflow: 'hidden', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 16 },
  gradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  text:     { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  xpPill:   { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  xpText:   { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

const sb = StyleSheet.create({
  wrapper:  { borderRadius: 18, overflow: 'hidden', shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 32 },
  gradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  text:     { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
});

function LearnGermanCard({ onPress }) {
  const { t, isRTL } = useLanguage();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={lg.wrapper}>
      <LinearGradient
        colors={['#0F172A', '#1D4ED8', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[lg.card, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <View style={lg.iconWrap}>
          <Ionicons name="logo-youtube" size={26} color="#FFFFFF" />
        </View>

        <View style={lg.content}>
          <Text style={lg.title}>{t('home.learnGerman')}</Text>
          <Text style={lg.subtitle}>{t('home.learnGermanSubtitle')}</Text>
        </View>

        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="rgba(255,255,255,0.9)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

function StoriesCard({ onPress }) {
  const { t, isRTL } = useLanguage();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={storiesCard.wrapper}>
      <LinearGradient
        colors={['#4338CA', '#7C3AED', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[storiesCard.card, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <View style={storiesCard.iconWrap}>
          <Ionicons name="library-outline" size={26} color="#FFFFFF" />
        </View>

        <View style={storiesCard.content}>
          <Text style={storiesCard.eyebrow}>{t('stories.entryEyebrow')}</Text>
          <Text style={storiesCard.title}>{t('stories.entryTitle')}</Text>
          <Text style={storiesCard.subtitle}>{t('stories.entrySubtitle')}</Text>
        </View>

        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="rgba(255,255,255,0.9)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

function ContinueReadingCard({ storyId, storyTitle, percentage, onPress }) {
  const completed = percentage >= 100;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={cr.wrapper}>
      <LinearGradient
        colors={completed ? ['#059669', '#10B981'] : ['#1E3A5F', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cr.card}
      >
        <View style={cr.leftCol}>
          <Text style={cr.eyebrow}>
            {completed ? '✅ COMPLETED' : '📖 CONTINUE READING'}
          </Text>
          <Text style={cr.title} numberOfLines={1}>{storyTitle}</Text>
          <View style={cr.barTrack}>
            <View style={[cr.barFill, { width: `${Math.min(percentage, 100)}%` }]} />
          </View>
          <Text style={cr.pctText}>{Math.round(percentage)}% read</Text>
        </View>
        <Ionicons name="arrow-forward-circle" size={32} color="rgba(255,255,255,0.85)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const cr = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  leftCol: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.4,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  barTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 5,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },
  pctText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
  },
});

const storiesCard = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 5,
    marginBottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  content: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.4,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
});

function SpeechPracticeCard({ onPress }) {
  const { t, isRTL } = useLanguage();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={sp.wrapper}>
      <LinearGradient
        colors={['#7C3AED', '#6C63FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[sp.card, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <Ionicons name="mic" size={26} color="#FFFFFF" />
        <View style={sp.content}>
          <Text style={[sp.title, isRTL && { textAlign: 'right' }]}>{t('home.speechPractice')}</Text>
          <Text style={[sp.subtitle, isRTL && { textAlign: 'right' }]}>{t('home.speechPracticeSub')}</Text>
        </View>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="rgba(255,255,255,0.9)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const sp = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  content: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
});

const lg = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 5,
    marginBottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  content: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 18,
  },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const c = theme.colors;

  const [streak,          setStreak]          = useState(0);
  const [xp,              setXp]              = useState(0);
  const [level,           setLevel]           = useState(1);
  const [wordOfDay,       setWordOfDay]       = useState(null);
  const [continueReading, setContinueReading] = useState(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { streakCount }            = await updateStreak();
        const { xp: savedXP, level: lv } = await loadProgress();
        setStreak(streakCount);
        setXp(savedXP);
        setLevel(lv);
        const raw   = await AsyncStorage.getItem('words');
        const words = raw ? JSON.parse(raw) : [];
        if (words.length > 0) setWordOfDay(words[0]);

        // Load Continue Reading data
        const lastStory = await loadLastOpenedStory();
        if (lastStory?.storyId) {
          const allProgress = await loadAllStoryProgress();
          const prog = allProgress.find((p) => p.storyId === lastStory.storyId);
          setContinueReading({
            storyId: lastStory.storyId,
            storyTitle: lastStory.storyTitle || 'Story',
            percentage: prog?.percentage ?? 0,
          });
        } else {
          setContinueReading(null);
        }
      })();
    }, [])
  );

  const containerStyle = useMemo(() => ({
    flex: 1,
    backgroundColor: c.background,
  }), [c.background]);

  return (
    <SafeAreaView style={containerStyle} edges={['top']}>
      <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header />
        <HeroCard streak={streak} onPress={() => navigation.navigate('Quiz')} />
        <StatsRow streak={streak} xp={xp} level={level} />
        <WordCard wordData={wordOfDay} />
        {continueReading ? (
          <ContinueReadingCard
            storyId={continueReading.storyId}
            storyTitle={continueReading.storyTitle}
            percentage={continueReading.percentage}
            onPress={() =>
              navigation.navigate('Stories', {
                screen: 'StoryReader',
                params: { storyId: continueReading.storyId },
              })
            }
          />
        ) : null}
        <StoriesCard onPress={() => navigation.navigate('Stories')} />
        <QuizButton onPress={() => navigation.navigate('Quiz')} />
        <ScanButton onPress={() => navigation.navigate('Scan')} />
        <LearnGermanCard onPress={() => navigation.navigate('LearnGerman')} />
        <SpeechPracticeCard onPress={() => navigation.navigate('SpeechPractice')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:    { padding: 20, paddingTop: 16, paddingBottom: 24 },
});
