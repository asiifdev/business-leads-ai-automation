import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { CLOUD_HOST, type CloudHost } from "./entitlements/cloud-host";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.setGlobalPrefix("api");
  // Routes from the commercial package (checkout, payment webhooks, billing admin), if one is installed.
  const cloud = app.get<CloudHost>(CLOUD_HOST);
  if (cloud.router) app.use("/api/billing", cloud.router);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  // Browser origins allowed to call the API: a comma-separated list in CORS_ORIGINS, otherwise the app URL, otherwise local dev.
  const origins = (process.env.CORS_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  app.enableCors({ origin: origins });

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
