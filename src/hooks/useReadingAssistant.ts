import { useState, useCallback, useEffect, useRef } from 'react';

export type SpeechSpeed = 'slow' | 'normal' | 'fast';

const SPEED_RATES: Record<SpeechSpeed, number> = {
  slow: 0.6,
  normal: 0.9,
  fast: 1.3,
};

const VOICE_STORAGE_KEY = 'readingAssistant_voiceName';
const SPEED_STORAGE_KEY = 'readingAssistant_speed';

export function useReadingAssistant() {
  const [enabled, setEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speed, setSpeed] = useState<SpeechSpeed>(() => {
    const saved = localStorage.getItem(SPEED_STORAGE_KEY);
    return (saved as SpeechSpeed) || 'normal';
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load voices (they load async in many browsers)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        // Restore saved voice preference
        const savedName = localStorage.getItem(VOICE_STORAGE_KEY);
        if (savedName) {
          const match = voices.find(v => v.name === savedName);
          if (match) setSelectedVoice(match);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Persist speed
  useEffect(() => {
    localStorage.setItem(SPEED_STORAGE_KEY, speed);
  }, [speed]);

  // Persist selected voice name
  useEffect(() => {
    if (selectedVoice) {
      localStorage.setItem(VOICE_STORAGE_KEY, selectedVoice.name);
    }
  }, [selectedVoice]);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = SPEED_RATES[speed];
    utterance.pitch = 1;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [speed, selectedVoice]);

  const stop = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      if (prev) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
      }
      return !prev;
    });
  }, []);

  const previewVoice = useCallback((voice: SpeechSynthesisVoice, previewSpeed?: SpeechSpeed) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Welcome to your exam. Good luck!');
    utterance.voice = voice;
    utterance.rate = SPEED_RATES[previewSpeed || speed];
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [speed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    enabled,
    isSpeaking,
    speed,
    setSpeed,
    speak,
    stop,
    toggle,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    previewVoice,
  };
}
