import * as Speech from 'expo-speech';

/**
 * Speak text in German. Stops any in-progress speech first.
 * @param {string} text - Text to pronounce
 * @param {object} callbacks - { onStart, onDone, onError }
 */
export function speakGerman(text, { onStart, onDone, onError } = {}) {
  Speech.stop();
  Speech.speak(text, {
    language: 'de-DE',
    pitch: 1.0,
    rate: 0.9,
    onStart,
    onDone,
    onStopped: onDone,
    onError,
  });
}

export function stopSpeech() {
  Speech.stop();
}
