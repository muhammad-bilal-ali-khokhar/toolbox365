import { describe, it, expect } from 'vitest'
import { FeatureCategory, FeatureStatus } from '../types'

describe('shared types', () => {
  it('FeatureCategory has correct values', () => {
    expect(FeatureCategory.DEVELOPER).toBe('developer')
    expect(FeatureCategory.PRODUCTIVITY).toBe('productivity')
    expect(FeatureCategory.TEXT).toBe('text')
    expect(FeatureCategory.FINANCE).toBe('finance')
    expect(FeatureCategory.DESIGN).toBe('design')
  })

  it('FeatureStatus has correct values', () => {
    expect(FeatureStatus.PENDING).toBe('pending')
    expect(FeatureStatus.COMPLETED).toBe('completed')
    expect(FeatureStatus.FAILED).toBe('failed')
    expect(FeatureStatus.SKIPPED).toBe('skipped')
  })
})
