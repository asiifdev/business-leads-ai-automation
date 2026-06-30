import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  async health() {
    const start = Date.now();
    let db: "ok" | "error" = "ok";
    let dbLatency: number | null = null;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
    } catch {
      db = "error";
    }

    const status = db === "ok" ? "ok" : "degraded";

    return {
      status,
      timestamp: new Date().toISOString(),
      service: "prospex-api",
      uptime: Math.floor(process.uptime()),
      db,
      ...(dbLatency !== null && { dbLatencyMs: dbLatency }),
    };
  }
}
