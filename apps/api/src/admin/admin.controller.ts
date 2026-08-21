import { Controller, Get, Post, Headers, UnauthorizedException } from '@nestjs/common'
import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private auth(headers: Record<string, string>) {
    const password = process.env.ADMIN_PASSWORD || 'admin123'
    if (headers['x-admin-password'] !== password) {
      throw new UnauthorizedException('Invalid admin password')
    }
  }

  @Get('status')
  getStatus(@Headers() headers: Record<string, string>) {
    this.auth(headers)
    return this.adminService.getFullStatus()
  }

  @Post('start')
  start(@Headers() headers: Record<string, string>) {
    this.auth(headers)
    return this.adminService.start()
  }

  @Post('stop')
  stop(@Headers() headers: Record<string, string>) {
    this.auth(headers)
    return this.adminService.stop()
  }

  @Post('deploy/web')
  deployWeb(@Headers() headers: Record<string, string>) {
    this.auth(headers)
    return this.adminService.deployWeb()
  }

  @Post('deploy/api')
  deployApi(@Headers() headers: Record<string, string>) {
    this.auth(headers)
    return this.adminService.deployApi()
  }
}
