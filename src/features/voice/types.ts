export type VoiceCoachPriority = 'normal' | 'high' | 'critical'
export type VoicePreference = 'female' | 'male' | 'neutral'
export type VoiceGenderHint = 'female' | 'male' | 'unknown'

export interface VoiceAnnouncement {
  id: string
  text: string
  priority?: VoiceCoachPriority
  repeatGapMs?: number
  minGapMs?: number
}

export interface UseVoiceCoachOptions {
  debug?: boolean
  defaultMuted?: boolean
  voicePreference?: VoicePreference
  defaultVoiceId?: string
  rate?: number
  pitch?: number
  volume?: number
  lang?: string
  minGapMs?: number
  repeatGapMs?: number
}

export type VoiceCoachStatus = 'unsupported' | 'ready' | 'muted'

export interface VoiceOption {
  id: string
  label: string
  lang: string
  genderHint: VoiceGenderHint
  isDefault: boolean
}

export interface VoiceCoachController {
  isSupported: boolean
  isMuted: boolean
  status: VoiceCoachStatus
  voicePreference: VoicePreference
  selectedVoiceId: string
  availableVoices: VoiceOption[]
  setSelectedVoiceId: (voiceId: string) => void
  refreshVoices: () => void
  announce: (announcement: VoiceAnnouncement) => boolean
  stop: () => void
  toggleMuted: () => void
  setMuted: (muted: boolean) => void
}
