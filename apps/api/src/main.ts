import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors({ origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000" });

  const config = new DocumentBuilder()
    .setTitle("Prospex API")
    .setDescription("AI-powered GTM automation platform API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Prospex API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
