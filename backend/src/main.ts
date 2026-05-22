import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter.js';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor.js';
import { RequestLogInterceptor } from './shared/interceptors/request-log.interceptor.js';
import { requestIdMiddleware } from './shared/middleware/request-id.middleware.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 全局中间件：requestId
  app.use(requestIdMiddleware);

  // 安全响应头（helmet）
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Swagger UI 需要 inline script
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false, // 避免影响 Swagger UI
    }),
  );

  // 全局过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 全局拦截器
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new RequestLogInterceptor(),
  );

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('制造业八大核心系统平台 API')
    .setDescription('PLM/SCM/ERP/APS/MES/WMS/QMS/EAM 统一接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      required: false,
      name: 'X-Tenant-ID',
      description: '租户ID（登录后自动从JWT获取，此处可手动覆盖）',
    })
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: '/swagger/json',
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
