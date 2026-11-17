import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeechRecognition {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface UseSpeechDictationReturn {
  isSupported: boolean;
  isListening: boolean;
  speechError: string | null;
  toggleListening: () => void;
  stopListening: () => void;
}

/**
 * Hook de saisie vocale native (SpeechRecognition / webkitSpeechRecognition)
 * configuré en langue `fr-BE` pour dicter les débriefings terrain à chaud.
 */
export function useSpeechDictation(
  onTranscriptChunk: (transcript: string) => void
): UseSpeechDictationReturn {
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const getConstructor = (): SpeechRecognitionConstructor | null => {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as WindowWithSpeechRecognition;
    return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
  };

  const isSupported = Boolean(getConstructor());

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignorer si déjà arrêté
      }
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    setSpeechError(null);
    if (isListening) {
      stopListening();
      return;
    }

    const Ctor = getConstructor();
    if (!Ctor) {
      setSpeechError(
        "La reconnaissance vocale (SpeechRecognition) n'est pas disponible sur ce navigateur."
      );
      return;
    }

    const instance = new Ctor();
    instance.lang = 'fr-BE';
    instance.continuous = false;
    instance.interimResults = false;

    instance.onresult = (event: SpeechRecognitionEventLike) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res && res[0]) {
          text += res[0].transcript;
        }
      }
      if (text.trim()) {
        onTranscriptChunk(text.trim());
      }
    };

    instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
      setSpeechError(`Dictée vocale interrompue (${event.error}).`);
      setIsListening(false);
    };

    instance.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = instance;
    try {
      instance.start();
      setIsListening(true);
    } catch {
      setSpeechError('Impossible de démarrer le microphone.');
      setIsListening(false);
    }
  }, [isListening, onTranscriptChunk, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Nettoyage silencieux
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    speechError,
    toggleListening,
    stopListening,
  };
}
