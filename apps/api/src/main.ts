import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://toolbox365-web.vercel.app',
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  })

  const port = process.env.PORT || 3001
  await app.listen(port)
  console.log(`API running on http://localhost:${port}`)
}

bootstrap()
