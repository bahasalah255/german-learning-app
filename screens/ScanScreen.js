import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const HISTORY_KEY  = 'scan_history';
const MAX_HISTORY  = 20;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CAMERA_SIZE  = SCREEN_WIDTH - 40;

const BARCODE_TYPES = [
  'qr', 'pdf417', 'aztec', 'ean13', 'ean8',
  'upc_a', 'upc_e', 'code39', 'code93', 'code128',
  'codabar', 'itf14', 'datamatrix',
];

function getTypeConfig(isDark) {
  return {
    url:   { icon: 'globe-outline',          color: '#2563EB', bg: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' },
    email: { icon: 'mail-outline',           color: '#EC4899', bg: isDark ? 'rgba(236, 72, 153, 0.15)' : '#FDF2F8' },
    phone: { icon: 'call-outline',           color: '#10B981', bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' },
    wifi:  { icon: 'wifi-outline',           color: '#8B5CF6', bg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF' },
    text:  { icon: 'document-text-outline',  color: '#64748B', bg: isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9' },
  };
}

function detectType(data) {
  if (/^https?:\/\//i.test(data))   return 'url';
  if (/^mailto:/i.test(data))        return 'email';
  if (/^tel:/i.test(data))           return 'phone';
  if (/^WIFI:/i.test(data))          return 'wifi';
  return 'text';
}

function parseWifi(data) {
  const ssid     = (data.match(/S:([^;]+)/) || [])[1] || '';
  const password = (data.match(/P:([^;]+)/) || [])[1] || '';
  const type     = (data.match(/T:([^;]+)/) || [])[1] || 'WPA';
  return { ssid, password, type };
}

function cleanDisplay(data, contentType) {
  if (contentType === 'email') return data.replace(/^mailto:/i, '');
  if (contentType === 'phone') return data.replace(/^tel:/i, '');
  if (contentType === 'wifi')  return parseWifi(data).ssid;
  return data;
}

function timeAgo(ts, t) {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return t('scan.justNow');
  if (mins < 60) return t('scan.minsAgo').replace('{n}', mins);
  if (hours < 24) return t('scan.hoursAgo').replace('{n}', hours);
  return t('scan.daysAgo').replace('{n}', days);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function ScanScreen() {
  const { t, isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;
  const styles = React.useMemo(() => getStyles(c, isRTL, isDark), [c, isRTL, isDark]);
  const typeConfig = React.useMemo(() => getTypeConfig(isDark), [isDark]);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing,        setFacing]        = useState('back');
  const [flashEnabled,  setFlashEnabled]  = useState(false);
  const [scanned,       setScanned]       = useState(false);
  const [result,        setResult]        = useState(null);
  const [sheetVisible,  setSheetVisible]  = useState(false);
  const [history,       setHistory]       = useState([]);
  const [pwVisible,     setPwVisible]     = useState(false);

  const scannedRef   = useRef(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim    = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      setHistory(stored ? JSON.parse(stored) : []);
    } catch {
      setHistory([]);
    }
  };

  const saveToHistory = async (entry) => {
    try {
      const stored   = await AsyncStorage.getItem(HISTORY_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      const updated  = [entry, ...existing].slice(0, MAX_HISTORY);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      setHistory(updated);
    } catch {}
  };

  const deleteHistoryItem = async (id) => {
    const updated = history.filter(h => h.id !== id);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setHistory(updated);
  };

  const openSheet = () => {
    setSheetVisible(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 600,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSheetVisible(false);
      setResult(null);
      setScanned(false);
      scannedRef.current = false;
      setPwVisible(false);
    });
  };

  const handleScan = useCallback(async ({ type: barcodeType, data }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanned(true);

    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    const contentType = detectType(data);
    const entry = { id: generateId(), data, contentType, scannedAt: Date.now() };
    await saveToHistory(entry);
    setResult(entry);
    openSheet();
  }, []);

  const handleHistoryTap = (item) => {
    setResult(item);
    setScanned(true);
    scannedRef.current = true;
    setPwVisible(false);
    openSheet();
  };

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, CAMERA_SIZE - 4],
  });

  const recentHistory = history.slice(0, 5);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />
        <View style={styles.permissionScreen}>
          <Ionicons name="camera-off-outline" size={64} color={c.textMuted} />
          <Text style={styles.permTitle}>{t('scan.permTitle')}</Text>
          <Text style={styles.permSubtitle}>
            {t('scan.permSubtitle')}
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            activeOpacity={0.88}
            style={styles.permBtnTouch}
          >
            <LinearGradient
              colors={['#2563EB', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.permBtnGradient}
            >
              <Text style={styles.permBtnLabel}>{t('scan.permBtn')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={c.statusBar} translucent={false} backgroundColor={c.statusBarBg} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!sheetVisible}
      >
        <View style={[styles.header, isRTL && { alignItems: 'flex-end' }]}>
          <Text style={[styles.title, isRTL && { textAlign: 'right' }]}>{t('scan.title')}</Text>
          <Text style={[styles.subtitle, isRTL && { textAlign: 'right' }]}>{t('scan.subtitle')}</Text>
        </View>

        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flashEnabled ? 'torch' : 'off'}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />

          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.scanFrame}>
                <View style={[styles.bracket, styles.bracketTL]} />
                <View style={[styles.bracket, styles.bracketTR]} />
                <View style={[styles.bracket, styles.bracketBL]} />
                <View style={[styles.bracket, styles.bracketBR]} />

                <Animated.View
                  style={[
                    styles.scanLineWrap,
                    { transform: [{ translateY: scanLineTranslate }] },
                  ]}
                >
                  <LinearGradient
                    colors={['transparent', '#2563EB', '#3B82F6', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.scanLineGradient}
                  />
                </Animated.View>
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom} />
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setFlashEnabled(v => !v)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={flashEnabled ? 'flash' : 'flash-off-outline'}
              size={20}
              color={c.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
            activeOpacity={0.75}
          >
            <Ionicons name="camera-reverse-outline" size={20} color={c.textPrimary} />
          </TouchableOpacity>
        </View>

        {recentHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.historySectionTitle, isRTL && { textAlign: 'right' }]}>
              {t('scan.recentScans')}
            </Text>
            {recentHistory.map((item) => {
              const cfg = typeConfig[item.contentType] || typeConfig.text;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.historyCard, isRTL && { flexDirection: 'row-reverse' }]}
                  onPress={() => handleHistoryTap(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.historyIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                  </View>
                  <View style={[styles.historyInfo, isRTL && { alignItems: 'flex-end' }]}>
                    <Text style={[styles.historyData, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                      {cleanDisplay(item.data, item.contentType)}
                    </Text>
                    <Text style={styles.historyTime}>{timeAgo(item.scannedAt, t)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteHistoryItem(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={16} color={c.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {recentHistory.length === 0 && (
          <View style={styles.historyEmpty}>
            <Text style={styles.historyEmptyText}>{t('scan.noScans')}</Text>
          </View>
        )}
      </ScrollView>

      {sheetVisible && (
        <>
          <TouchableOpacity
            style={styles.backdrop}
            onPress={closeSheet}
            activeOpacity={1}
          />
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
          >
            <View style={styles.sheetHandle} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
            >
              {result && <ResultContent
                result={result}
                pwVisible={pwVisible}
                setPwVisible={setPwVisible}
                onClose={closeSheet}
                typeConfig={typeConfig}
              />}
            </ScrollView>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

function ResultContent({ result, pwVisible, setPwVisible, onClose, typeConfig }) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;
  const { t, isRTL } = useLanguage();
  const rs = React.useMemo(() => getRs(c, isRTL, isDark), [c, isRTL, isDark]);
  const { data, contentType } = result;
  const cfg = typeConfig[contentType] || typeConfig.text;
  const wifi = contentType === 'wifi' ? parseWifi(data) : null;

  const cleanEmail  = data.replace(/^mailto:/i, '');
  const cleanPhone  = data.replace(/^tel:/i, '');

  const copy = async (text) => {
    await Clipboard.setStringAsync(text);
  };

  const openLink = (url) => {
    Linking.openURL(url).catch(() => {});
  };

  const getLabel = (type) => {
    switch (type) {
      case 'url':   return t('scan.webDetected');
      case 'email': return t('scan.emailAddress');
      case 'phone': return t('scan.phoneNumber');
      case 'wifi':  return t('scan.wifiNetwork');
      default:      return t('scan.textContent');
    }
  };

  return (
    <>
      <View style={[rs.typeRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[rs.iconCircle, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={24} color={cfg.color} />
        </View>
        <Text style={rs.typeLabel}>{getLabel(contentType)}</Text>
      </View>

      {contentType === 'url' && (
        <>
          <Text style={[rs.dataText, isRTL && { textAlign: 'right' }]} numberOfLines={3}>{data}</Text>
          <GradBtn label={t('scan.openBrowser')}  onPress={() => openLink(data)} />
          <MutedBtn label={t('scan.copyLink')} icon="copy-outline" onPress={() => copy(data)} />
        </>
      )}

      {contentType === 'email' && (
        <>
          <Text style={[rs.dataText, isRTL && { textAlign: 'right' }]}>{cleanEmail}</Text>
          <GradBtn label={t('scan.openMail')}  onPress={() => openLink(data)} />
          <MutedBtn label={t('scan.copyEmail')} icon="copy-outline" onPress={() => copy(cleanEmail)} />
        </>
      )}

      {contentType === 'phone' && (
        <>
          <Text style={[rs.dataText, isRTL && { textAlign: 'right' }]}>{cleanPhone}</Text>
          <GradBtn label={t('scan.callNumber')} onPress={() => openLink(data)} />
          <MutedBtn label={t('scan.copyNumber')} icon="copy-outline" onPress={() => copy(cleanPhone)} />
        </>
      )}

      {contentType === 'wifi' && wifi && (
        <>
          <View style={rs.wifiBlock}>
            <View style={[rs.wifiRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={rs.wifiLabel}>{t('scan.network')}</Text>
              <Text style={rs.wifiValue}>{wifi.ssid}</Text>
            </View>
            <View style={rs.wifiDivider} />
            <View style={[rs.wifiRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={rs.wifiLabel}>{t('scan.password')}</Text>
              <View style={[rs.wifiPwRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={rs.wifiValue}>
                  {pwVisible ? wifi.password : '••••••••'}
                </Text>
                <TouchableOpacity
                  onPress={() => setPwVisible(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={pwVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={c.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <GradBtn label={t('scan.copyPassword')} onPress={() => copy(wifi.password)} />
        </>
      )}

      {contentType === 'text' && (
        <>
          <View style={rs.textBox}>
            <Text style={[rs.textBoxContent, isRTL && { textAlign: 'right' }]} selectable>{data}</Text>
          </View>
          <GradBtn label={t('scan.copyText')} onPress={() => copy(data)} />
          <MutedBtn
            label={t('scan.searchGoogle')}
            icon="search-outline"
            onPress={() => openLink(`https://www.google.com/search?q=${encodeURIComponent(data)}`)}
          />
        </>
      )}

      <TouchableOpacity style={rs.scanAgainBtn} onPress={onClose} activeOpacity={0.7}>
        <Text style={rs.scanAgainText}>{t('scan.scanAgain')}</Text>
      </TouchableOpacity>
    </>
  );
}

function GradBtn({ label, onPress }) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;
  const { isRTL } = useLanguage();
  const rs = React.useMemo(() => getRs(c, isRTL, isDark), [c, isRTL, isDark]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={rs.gradTouch}>
      <LinearGradient
        colors={['#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={rs.gradBtn}
      >
        <Text style={rs.gradBtnLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function MutedBtn({ label, icon, onPress }) {
  const { isRTL } = useLanguage();
  const { theme, isDark } = useTheme();
  const c = theme.colors;
  const rs = React.useMemo(() => getRs(c, isRTL, isDark), [c, isRTL, isDark]);
  return (
    <TouchableOpacity style={[rs.mutedBtn, isRTL && { flexDirection: 'row-reverse' }]} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon} size={16} color={c.textPrimary} />
      <Text style={rs.mutedBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStyles(c, isRTL, isDark) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },

    header: { paddingTop: 20, marginBottom: 20 },
    title:  { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 4, letterSpacing: -0.3 },
    subtitle: { fontSize: 13, color: c.textSecondary },

    cameraContainer: {
      width: CAMERA_SIZE,
      height: CAMERA_SIZE,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: '#0F172A',
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.35 : 0.18,
      shadowRadius: 16,
      elevation: 8,
      alignSelf: 'center',
    },

    overlayTop:    { backgroundColor: 'rgba(0,0,0,0.45)', height: 60 },
    overlayMiddle: { flex: 1, flexDirection: 'row' },
    overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    overlayBottom: { backgroundColor: 'rgba(0,0,0,0.45)', height: 60 },

    scanFrame: { flex: 3 },

    bracket: {
      position: 'absolute',
      width: 36,
      height: 36,
      borderColor: '#FFFFFF',
    },
    bracketTL: { top: 0,  left: 0,  borderTopWidth: 3,    borderLeftWidth: 3,  borderTopLeftRadius: 8  },
    bracketTR: { top: 0,  right: 0, borderTopWidth: 3,    borderRightWidth: 3, borderTopRightRadius: 8 },
    bracketBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 8  },
    bracketBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },

    scanLineWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 2,
    },
    scanLineGradient: { flex: 1, height: 2 },

    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginTop: 20,
      marginBottom: 28,
    },
    controlBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 6,
      elevation: 3,
    },

    historySection: { marginTop: 4 },
    historySectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: 12,
    },
    historyCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      gap: 12,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.15 : 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    historyIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    historyInfo: { flex: 1 },
    historyData: { fontSize: 14, fontWeight: '700', color: c.textPrimary, marginBottom: 2 },
    historyTime: { fontSize: 11, color: c.textSecondary, fontWeight: '500' },

    historyEmpty: { alignItems: 'center', paddingVertical: 20 },
    historyEmptyText: { fontSize: 14, color: c.textSecondary },

    permissionScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    permTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: c.textPrimary,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    permSubtitle: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 32,
    },
    permBtnTouch:    { borderRadius: 20, overflow: 'hidden', width: '100%' },
    permBtnGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
    permBtnLabel:    { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

    backdrop: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: c.overlay,
    },

    sheet: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      backgroundColor: c.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 12,
      paddingHorizontal: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 28,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0.35 : 0.12,
      shadowRadius: 16,
      elevation: 20,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 20,
    },
    sheetScroll: { paddingBottom: 8 },
  });
}

function getRs(c, isRTL, isDark) {
  return StyleSheet.create({
    typeRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeLabel: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      color: c.textSecondary,
      textTransform: 'uppercase',
    },
    dataText: {
      fontSize: 15,
      color: c.textPrimary,
      lineHeight: 22,
      marginBottom: 20,
      fontWeight: '500',
    },

    wifiBlock: {
      backgroundColor: c.cardAlt,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    wifiRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    wifiDivider: { height: 1, backgroundColor: c.border, marginVertical: 8 },
    wifiLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
    wifiValue: { fontSize: 14, color: c.textPrimary, fontWeight: '700' },
    wifiPwRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },

    textBox: {
      backgroundColor: c.cardAlt,
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: c.border,
    },
    textBoxContent: { fontSize: 14, color: c.textPrimary, lineHeight: 21 },

    gradTouch: { borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
    gradBtn: { height: 50, alignItems: 'center', justifyContent: 'center' },
    gradBtnLabel: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

    mutedBtn: {
      height: 50,
      borderRadius: 16,
      backgroundColor: c.cardAlt,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 10,
    },
    mutedBtnLabel: { fontSize: 15, color: c.textPrimary, fontWeight: '700', marginHorizontal: 4 },

    scanAgainBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    scanAgainText: {
      fontSize: 14,
      color: c.textSecondary,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
  });
}