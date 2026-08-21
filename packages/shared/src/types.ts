export enum FeatureCategory {
  DEVELOPER = 'developer',
  PRODUCTIVITY = 'productivity',
  TEXT = 'text',
  FINANCE = 'finance',
  DESIGN = 'design',
  MATH_SCIENCE = 'math_science',
  RANDOM_FUN = 'random_fun',
  FILE_UTILITIES = 'file_utilities',
}

export enum FeatureStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface Feature {
  id: number
  name: string
  slug: string
  category: FeatureCategory
  description: string
  status: FeatureStatus
  builtOnDay?: number
  builtAt?: string
}

export interface DailyBuildResult {
  day: number
  featureId: number
  featureName: string
  status: 'success' | 'failed' | 'skipped'
  attempts: number
  tokensUsed: number
  duration: number
  error?: string
  commitSha?: string
  timestamp: string
}

export interface ProjectStatus {
  currentDay: number
  totalFeatures: number
  completedFeatures: number
  failedAttempts: number
  lastBuildDate: string | null
  lastBuildStatus: 'success' | 'failed' | 'skipped' | null
  startDate: string | null
  features: Feature[]
}
