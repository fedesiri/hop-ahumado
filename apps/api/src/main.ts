import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import "./load-env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Cloud Run inyecta PORT (8080). Si viene vacío o NaN, en producción usamos 8080; en local 3001.
  const rawPort = process.env.PORT?.trim();
  const fallback = process.env.NODE_ENV === "production" ? "8080" : "3001";
  const port = Number.parseInt(rawPort && rawPort.length > 0 ? rawPort : fallback, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`PORT inválido: ${JSON.stringify(process.env.PORT)}`);
  }
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });
  await app.listen(port, "0.0.0.0");
  console.log(`API listening on 0.0.0.0:${port}`);
}
bootstrap();
