import { describe, it, expect } from 'vitest'
import { AppService } from '../app.service'

describe('AppService', () => {
  it('getStatus returns default not_started state', () => {
    const service = new AppService()
    const status = service.getStatus()
    expect(status.status).toBe('not_started')
    expect(status.day).toBe(0)
    expect(status.featuresBuilt).toBe(0)
    expect(status.totalFeatures).toBe(365)
  })
})
