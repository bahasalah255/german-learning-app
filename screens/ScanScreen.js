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

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_KEY  = 'scan_history';
const MAX_HISTORY  = 20;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CAMERA_SIZE  = SCREEN_WIDTH - 40;

const BARCODE_TYPES = [
  'qr', 'pdf417', 'aztec', 'ean13', 'ean8',
  'upc_a', 'upc_e', 'code39', 'code93', 'code128',
  'codabar', 'itf14', 'datamatrix',
];

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  url:   { icon: 'globe-outline',          color: '#4A8FE8', bg: '#DBEAFE', label: 'WEBSITE DETECTED'   },
  email: { icon: 'mail-outline',           color: '#E8706A', bg: '#FCE7F3', label: 'EMAIL ADDRESS'       },
  phone: { icon: 'call-outline',           color: '#4DBFA0', bg: '#D1FAE5', label: 'PHONE NUMBER'        },
  wifi:  { icon: 'wifi-outline',           color: '#7B61FF', bg: '#EDE9FE', label: 'WI-FI NETWORK'       },
  text:  { icon: 'document-text-outline',  color: '#9090A0', bg: '#F3F4F6', label: 'TEXT CONTENT'        },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function timeAgo(ts) {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScanScreen() {
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

  // ── Scanning line animation ────────────────────────────────────────────────
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

  // ── Load history on tab focus ──────────────────────────────────────────────
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

  // ── Sheet animation ────────────────────────────────────────────────────────
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

  // ── Scan handler ──────────────────────────────────────────────────────────
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, CAMERA_SIZE - 4],
  });

  const recentHistory = history.slice(0, 5);

  // ── Permission loading ─────────────────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#EEEEFF" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7B61FF" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" translucent={false} backgroundColor="#EEEEFF" />
        <View style={styles.permissionScreen}>
          <Ionicons name="camera-off-outline" size={64} color="#9090A0" />
          <Text style={styles.permTitle}>Camera access required</Text>
          <Text style={styles.permSubtitle}>
            Allow camera access to scan QR codes and barcodes
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            activeOpacity={0.88}
            style={styles.permBtnTouch}
          >
            <LinearGradient
              colors={['#7B61FF', '#C850C0', '#FF6B9D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.permBtnGradient}
            >
              <Text style={styles.permBtnLabel}>Allow Camera Access</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main screen ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" translucent={false} backgroundColor="#EEEEFF" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!sheetVisible}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Scan</Text>
          <Text style={styles.subtitle}>Point camera at any QR code or barcode</Text>
        </View>

        {/* Camera container */}
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flashEnabled ? 'torch' : 'off'}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />

          {/* Overlay */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Dim corners */}
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.scanFrame}>
                {/* Corner brackets */}
                <View style={[styles.bracket, styles.bracketTL]} />
                <View style={[styles.bracket, styles.bracketTR]} />
                <View style={[styles.bracket, styles.bracketBL]} />
                <View style={[styles.bracket, styles.bracketBR]} />

                {/* Animated scan line */}
                <Animated.View
                  style={[
                    styles.scanLineWrap,
                    { transform: [{ translateY: scanLineTranslate }] },
                  ]}
                >
                  <LinearGradient
                    colors={['transparent', '#7B61FF', '#C850C0', '#FF6B9D', 'transparent']}
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

        {/* Camera controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setFlashEnabled(v => !v)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={flashEnabled ? 'flash' : 'flash-off-outline'}
              size={20}
              color="#1A1A2E"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
            activeOpacity={0.75}
          >
            <Ionicons name="camera-reverse-outline" size={20} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        {/* Scan history */}
        {recentHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>Recent scans</Text>
            {recentHistory.map((item) => {
              const cfg = TYPE_CONFIG[item.contentType] || TYPE_CONFIG.text;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  onPress={() => handleHistoryTap(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.historyIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyData} numberOfLines={1}>
                      {cleanDisplay(item.data, item.contentType)}
                    </Text>
                    <Text style={styles.historyTime}>{timeAgo(item.scannedAt)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteHistoryItem(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={16} color="#F87171" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {recentHistory.length === 0 && (
          <View style={styles.historyEmpty}>
            <Text style={styles.historyEmptyText}>No scans yet</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom sheet ── */}
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
              />}
            </ScrollView>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Result sheet content ─────────────────────────────────────────────────────

function ResultContent({ result, pwVisible, setPwVisible, onClose }) {
  const { data, contentType } = result;
  const cfg = TYPE_CONFIG[contentType] || TYPE_CONFIG.text;
  const wifi = contentType === 'wifi' ? parseWifi(data) : null;

  const cleanEmail  = data.replace(/^mailto:/i, '');
  const cleanPhone  = data.replace(/^tel:/i, '');

  const copy = async (text) => {
    await Clipboard.setStringAsync(text);
  };

  const openLink = (url) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <>
      {/* Type badge row */}
      <View style={rs.typeRow}>
        <View style={[rs.iconCircle, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={24} color={cfg.color} />
        </View>
        <Text style={rs.typeLabel}>{cfg.label}</Text>
      </View>

      {/* ── URL ── */}
      {contentType === 'url' && (
        <>
          <Text style={rs.dataText} numberOfLines={3}>{data}</Text>
          <GradBtn label="Open in Browser"  onPress={() => openLink(data)} />
          <MutedBtn label="Copy Link" icon="copy-outline" onPress={() => copy(data)} />
        </>
      )}

      {/* ── Email ── */}
      {contentType === 'email' && (
        <>
          <Text style={rs.dataText}>{cleanEmail}</Text>
          <GradBtn label="Open Mail App"  onPress={() => openLink(data)} />
          <MutedBtn label="Copy Email" icon="copy-outline" onPress={() => copy(cleanEmail)} />
        </>
      )}

      {/* ── Phone ── */}
      {contentType === 'phone' && (
        <>
          <Text style={rs.dataText}>{cleanPhone}</Text>
          <GradBtn label="Call Number" onPress={() => openLink(data)} />
          <MutedBtn label="Copy Number" icon="copy-outline" onPress={() => copy(cleanPhone)} />
        </>
      )}

      {/* ── WiFi ── */}
      {contentType === 'wifi' && wifi && (
        <>
          <View style={rs.wifiBlock}>
            <View style={rs.wifiRow}>
              <Text style={rs.wifiLabel}>Network</Text>
              <Text style={rs.wifiValue}>{wifi.ssid}</Text>
            </View>
            <View style={rs.wifiDivider} />
            <View style={rs.wifiRow}>
              <Text style={rs.wifiLabel}>Password</Text>
              <View style={rs.wifiPwRow}>
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
                    color="#9090A0"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <GradBtn label="Copy Password" onPress={() => copy(wifi.password)} />
        </>
      )}

      {/* ── Text ── */}
      {contentType === 'text' && (
        <>
          <View style={rs.textBox}>
            <Text style={rs.textBoxContent} selectable>{data}</Text>
          </View>
          <GradBtn label="Copy Text" onPress={() => copy(data)} />
          <MutedBtn
            label="Search on Google"
            icon="search-outline"
            onPress={() => openLink(`https://www.google.com/search?q=${encodeURIComponent(data)}`)}
          />
        </>
      )}

      {/* Scan again */}
      <TouchableOpacity style={rs.scanAgainBtn} onPress={onClose} activeOpacity={0.7}>
        <Text style={rs.scanAgainText}>Scan again</Text>
      </TouchableOpacity>
    </>
  );
}

function GradBtn({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={rs.gradTouch}>
      <LinearGradient
        colors={['#7B61FF', '#C850C0', '#FF6B9D']}
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
  return (
    <TouchableOpacity style={rs.mutedBtn} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon} size={16} color="#1A1A2E" />
      <Text style={rs.mutedBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEEEFF' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  /* Header */
  header: { paddingTop: 24, marginBottom: 20 },
  title:  { fontSize: 30, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#9090A0' },

  /* Camera */
  cameraContainer: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    alignSelf: 'center',
  },

  /* Overlay dim areas */
  overlayTop:    { backgroundColor: 'rgba(0,0,0,0.45)', height: 60 },
  overlayMiddle: { flex: 1, flexDirection: 'row' },
  overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  overlayBottom: { backgroundColor: 'rgba(0,0,0,0.45)', height: 60 },

  /* Scan frame (transparent middle) */
  scanFrame: { flex: 3 },

  /* Corner brackets */
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

  /* Scan line */
  scanLineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
  },
  scanLineGradient: { flex: 1, height: 2 },

  /* Controls */
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 20,
    marginBottom: 28,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  /* History */
  historySection: { marginTop: 4 },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyInfo: { flex: 1 },
  historyData: { fontSize: 14, fontWeight: '500', color: '#1A1A2E', marginBottom: 2 },
  historyTime: { fontSize: 11, color: '#9090A0' },

  historyEmpty: { alignItems: 'center', paddingVertical: 20 },
  historyEmptyText: { fontSize: 14, color: '#9090A0' },

  /* Permission screen */
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permSubtitle: {
    fontSize: 14,
    color: '#9090A0',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
  },
  permBtnTouch:    { borderRadius: 50, overflow: 'hidden', width: '100%' },
  permBtnGradient: { height: 52, alignItems: 'center', justifyContent: 'center' },
  permBtnLabel:    { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  /* Backdrop */
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  /* Bottom sheet */
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E8',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetScroll: { paddingBottom: 8 },
});

// ─── Result sheet styles ──────────────────────────────────────────────────────

const rs = StyleSheet.create({
  typeRow: {
    flexDirection: 'row',
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
    fontWeight: '600',
    letterSpacing: 1,
    color: '#9090A0',
  },
  dataText: {
    fontSize: 15,
    color: '#1A1A2E',
    lineHeight: 22,
    marginBottom: 20,
  },

  /* WiFi block */
  wifiBlock: {
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  wifiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  wifiDivider: { height: 1, backgroundColor: '#EEEEFF', marginVertical: 8 },
  wifiLabel: { fontSize: 13, color: '#9090A0', fontWeight: '500' },
  wifiValue: { fontSize: 14, color: '#1A1A2E', fontWeight: '600' },
  wifiPwRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  /* Text box */
  textBox: {
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    maxHeight: 120,
  },
  textBoxContent: { fontSize: 14, color: '#1A1A2E', lineHeight: 21 },

  /* Gradient button */
  gradTouch: { borderRadius: 50, overflow: 'hidden', marginBottom: 10 },
  gradBtn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  gradBtnLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  /* Muted button */
  mutedBtn: {
    height: 52,
    borderRadius: 50,
    backgroundColor: '#F0F0F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  mutedBtnLabel: { fontSize: 15, color: '#1A1A2E', fontWeight: '500' },

  /* Scan again */
  scanAgainBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  scanAgainText: {
    fontSize: 14,
    color: '#9090A0',
    textDecorationLine: 'underline',
  },
});
