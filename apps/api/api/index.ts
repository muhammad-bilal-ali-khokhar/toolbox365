import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import { ExpressAdapter } from '@nestjs/platform-express'
import express from 'express'

const server = express()
let app: Awaited<ReturnType<typeof NestFactory.create>>

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, new ExpressAdapter(server))
    app.enableCors({
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    })
    await app.init()
  }
  return server
}

export default async function handler(req: express.Request, res: express.Response) {
  const srv = await bootstrap()
  srv(req, res)
}
