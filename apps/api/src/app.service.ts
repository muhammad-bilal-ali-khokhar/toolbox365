import { Injectable } from '@nestjs/common'
import { readFileSync } from 'fs'
import { join } from 'path'

@Injectable()
export class AppService {
  getStatus() {
    try {
      const progressPath = join(process.cwd(), '../../features/progress.json')
      const progress = JSON.parse(readFileSync(progressPath, 'utf-8'))
      return {
        day: progress.currentDay,
        featuresBuilt: progress.completedFeatures,
        status: progress.currentDay === 0 ? 'not_started' : 'in_progress',
        lastBuildDate: progress.lastBuildDate,
        totalFeatures: progress.totalFeatures,
      }
    } catch {
      return {
        day: 0,
        featuresBuilt: 0,
        status: 'not_started',
        lastBuildDate: null,
        totalFeatures: 365,
      }
    }
  }
}
