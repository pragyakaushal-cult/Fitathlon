export type AnalysisProfile =
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'push'
  | 'pull'
  | 'core'

export function getAnalysisProfileLabel(profile: AnalysisProfile) {
  switch (profile) {
    case 'squat':
      return 'Squat scoring'
    case 'lunge':
      return 'Lunge coaching'
    case 'hinge':
      return 'Hinge coaching'
    case 'push':
      return 'Push coaching'
    case 'pull':
      return 'Pull coaching'
    case 'core':
      return 'Core coaching'
    default:
      return 'Live coaching'
  }
}
