import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDebugLogger } from '@/lib/debug/logger'
import type {
  UseVoiceCoachOptions,
  VoiceAnnouncement,
  VoiceCoachController,
  VoiceOption,
  VoicePreference,
  VoiceCoachPriority,
  VoiceGenderHint,
} from './types'

const DEFAULT_MIN_GAP_MS = 2200
const DEFAULT_REPEAT_GAP_MS = 7500
const AUTO_VOICE_ID = 'auto'
const FEMALE_HINTS = [
  'female',
  'woman',
  'zira',
  'samantha',
  'victoria',
  'karen',
  'moira',
  'allison',
  'ava',
  'aria',
  'serena',
  'veena',
  'heera',
]
const MALE_HINTS = [
  'male',
  'man',
  'david',
  'daniel',
  'alex',
  'tom',
  'george',
  'fred',
]

interface VoiceWindow extends Window {
  speechSynthesis: SpeechSynthesis
}

function isVoiceSupported() {
  if (typeof window === 'undefined') {
    return false
  }

  const voiceWindow = window as VoiceWindow
  return (
    typeof voiceWindow.speechSynthesis !== 'undefined' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

function getPriorityMinGap(priority: VoiceCoachPriority) {
  switch (priority) {
    case 'critical':
      return 900
    case 'high':
      return 1500
    case 'normal':
    default:
      return DEFAULT_MIN_GAP_MS
  }
}

function getVoiceSearchableValue(voice: SpeechSynthesisVoice) {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase()
}

function inferVoiceGender(voice: SpeechSynthesisVoice): VoiceGenderHint {
  const searchable = getVoiceSearchableValue(voice)

  if (FEMALE_HINTS.some((hint) => searchable.includes(hint))) {
    return 'female'
  }

  if (MALE_HINTS.some((hint) => searchable.includes(hint))) {
    return 'male'
  }

  return 'unknown'
}

function getPreferenceScore(
  voice: SpeechSynthesisVoice,
  preference: VoicePreference,
) {
  if (preference === 'neutral') {
    return 0
  }

  const genderHint = inferVoiceGender(voice)
  if (genderHint === preference) {
    return 2
  }

  if (genderHint === 'unknown') {
    return 1
  }

  return 0
}

function getLanguageScore(voice: SpeechSynthesisVoice, preferredLang: string) {
  if (voice.lang === preferredLang) {
    return 2
  }

  const prefix = preferredLang.split('-')[0]?.toLowerCase() ?? ''
  if (prefix && voice.lang.toLowerCase().startsWith(prefix)) {
    return 1
  }

  return 0
}

function sortVoices(
  voices: SpeechSynthesisVoice[],
  preferredLang: string,
  preference: VoicePreference,
) {
  return [...voices].sort((leftVoice, rightVoice) => {
    const languageScoreDelta =
      getLanguageScore(rightVoice, preferredLang) -
      getLanguageScore(leftVoice, preferredLang)
    if (languageScoreDelta !== 0) {
      return languageScoreDelta
    }

    const preferenceScoreDelta =
      getPreferenceScore(rightVoice, preference) -
      getPreferenceScore(leftVoice, preference)
    if (preferenceScoreDelta !== 0) {
      return preferenceScoreDelta
    }

    if (leftVoice.default !== rightVoice.default) {
      return leftVoice.default ? -1 : 1
    }

    return leftVoice.name.localeCompare(rightVoice.name)
  })
}

function toVoiceOption(voice: SpeechSynthesisVoice): VoiceOption {
  const genderHint = inferVoiceGender(voice)
  const genderTag =
    genderHint === 'female'
      ? 'female'
      : genderHint === 'male'
        ? 'male'
        : 'voice'

  return {
    id: voice.voiceURI,
    label: `${voice.name} (${voice.lang}, ${genderTag})`,
    lang: voice.lang,
    genderHint,
    isDefault: voice.default,
  }
}

function resolveVoice(
  synth: SpeechSynthesis,
  preferredLang: string,
  preference: VoicePreference,
  selectedVoiceId: string,
): SpeechSynthesisVoice | null {
  const voices = synth.getVoices()

  if (!voices.length) {
    return null
  }

  if (selectedVoiceId !== AUTO_VOICE_ID) {
    const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceId)
    if (selectedVoice) {
      return selectedVoice
    }
  }

  const languagePrefix = preferredLang.split('-')[0] ?? 'en'
  const exactLangVoices = voices.filter((voice) => voice.lang === preferredLang)
  const prefixLangVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(languagePrefix.toLowerCase()),
  )

  const scopedVoices =
    exactLangVoices.length > 0
      ? exactLangVoices
      : prefixLangVoices.length > 0
        ? prefixLangVoices
        : voices

  const rankedScopedVoices = sortVoices(scopedVoices, preferredLang, preference)

  if (preference !== 'neutral') {
    const hintedVoice = rankedScopedVoices.find(
      (voice) => inferVoiceGender(voice) === preference,
    )

    if (hintedVoice) {
      return hintedVoice
    }
  }

  if (rankedScopedVoices.length > 0) {
    return rankedScopedVoices[0] ?? null
  }

  if (exactLangVoices.length > 0) {
    return exactLangVoices[0] ?? null
  }

  if (prefixLangVoices.length > 0) {
    return prefixLangVoices[0] ?? null
  }

  return voices.find((voice) => voice.default) ?? voices[0] ?? null
}

export function useVoiceCoach(
  options: UseVoiceCoachOptions = {},
): VoiceCoachController {
  const {
    debug = false,
    defaultMuted = false,
    voicePreference = 'female',
    defaultVoiceId = AUTO_VOICE_ID,
    rate = 1.03,
    pitch = 1,
    volume = 1,
    lang = 'en-US',
    minGapMs = DEFAULT_MIN_GAP_MS,
    repeatGapMs = DEFAULT_REPEAT_GAP_MS,
  } = options

  const isSupported = isVoiceSupported()
  const [isMuted, setIsMutedState] = useState(defaultMuted)
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([])
  const [selectedVoiceId, setSelectedVoiceIdState] = useState(defaultVoiceId)
  const lastAnnouncementAtRef = useRef(0)
  const announcementHistoryRef = useRef<Map<string, number>>(new Map())
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const logDebug = useMemo(() => createDebugLogger('voice-coach', debug), [debug])

  const refreshVoices = useCallback(() => {
    if (!isSupported) {
      return
    }

    const synth = window.speechSynthesis
    const rawVoices = synth.getVoices()
    const sortedVoices = sortVoices(rawVoices, lang, voicePreference)
    setAvailableVoices(sortedVoices.map(toVoiceOption))
    voiceRef.current = resolveVoice(synth, lang, voicePreference, selectedVoiceId)
  }, [isSupported, lang, selectedVoiceId, voicePreference])

  useEffect(() => {
    if (!isSupported) {
      return
    }

    const synth = window.speechSynthesis
    const syncVoice = () => {
      refreshVoices()
    }

    syncVoice()
    synth.addEventListener('voiceschanged', syncVoice)

    return () => {
      synth.removeEventListener('voiceschanged', syncVoice)
      synth.cancel()
    }
  }, [isSupported, refreshVoices])

  const stop = useCallback(() => {
    if (!isSupported) {
      return
    }

    window.speechSynthesis.cancel()
  }, [isSupported])

  const setSelectedVoiceId = useCallback(
    (voiceId: string) => {
      setSelectedVoiceIdState(voiceId || AUTO_VOICE_ID)
      stop()
    },
    [stop],
  )

  const setMuted = useCallback(
    (nextMuted: boolean) => {
      setIsMutedState(nextMuted)

      if (nextMuted) {
        stop()
      }
    },
    [stop],
  )

  const toggleMuted = useCallback(() => {
    setIsMutedState((currentMuted) => {
      const nextMuted = !currentMuted

      if (nextMuted) {
        stop()
      }

      return nextMuted
    })
  }, [stop])

  const announce = useCallback(
    (announcement: VoiceAnnouncement) => {
      if (!isSupported || isMuted) {
        return false
      }

      const text = announcement.text.trim()
      if (!text) {
        return false
      }

      const now = performance.now()
      const priority = announcement.priority ?? 'normal'
      const resolvedMinGapMs =
        announcement.minGapMs ?? Math.min(minGapMs, getPriorityMinGap(priority))
      const resolvedRepeatGapMs = announcement.repeatGapMs ?? repeatGapMs
      const lastGlobalAnnouncementAt = lastAnnouncementAtRef.current
      const lastAnnouncementForId =
        announcementHistoryRef.current.get(announcement.id) ?? 0

      if (now - lastGlobalAnnouncementAt < resolvedMinGapMs) {
        return false
      }

      if (now - lastAnnouncementForId < resolvedRepeatGapMs) {
        return false
      }

      const synth = window.speechSynthesis
      if (priority === 'critical' && (synth.speaking || synth.pending)) {
        synth.cancel()
      } else if (synth.speaking || synth.pending) {
        return false
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = rate
      utterance.pitch = pitch
      utterance.volume = volume

      if (voiceRef.current) {
        utterance.voice = voiceRef.current
      }

      synth.speak(utterance)
      lastAnnouncementAtRef.current = now
      announcementHistoryRef.current.set(announcement.id, now)

      logDebug('announcement_spoken', {
        id: announcement.id,
        priority,
        text,
      })

      return true
    },
    [isSupported, isMuted, lang, logDebug, minGapMs, pitch, rate, repeatGapMs, volume],
  )

  return useMemo(
    () => ({
      isSupported,
      isMuted,
      status: !isSupported ? 'unsupported' : isMuted ? 'muted' : 'ready',
      voicePreference,
      selectedVoiceId,
      availableVoices,
      setSelectedVoiceId,
      refreshVoices,
      announce,
      stop,
      toggleMuted,
      setMuted,
    }),
    [
      announce,
      availableVoices,
      isMuted,
      isSupported,
      refreshVoices,
      selectedVoiceId,
      setMuted,
      setSelectedVoiceId,
      stop,
      toggleMuted,
      voicePreference,
    ],
  )
}
