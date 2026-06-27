import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { Logger } from "nestjs-pino";

type LoggedPrismaClient = PrismaClient<{
  log: [
    { emit: "event"; level: "error" },
    { emit: "event"; level: "warn" },
    { emit: "event"; level: "query" },
  ];
}>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly logger: Logger) {
    super({
      log: [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "query" },
      ],
      transactionOptions: { maxWait: 10000, timeout: 30000 },
    } as Prisma.PrismaClientOptions);
  }

  async onModuleInit() {
    const client = this as unknown as LoggedPrismaClient;

    client.$on("error", (e) => {
      this.logger.error({ target: e.target, message: e.message }, "Prisma error");
    });

    client.$on("warn", (e) => {
      this.logger.warn({ target: e.target, message: e.message }, "Prisma warning");
    });

    if (process.env.LOG_LATENCY === "true") {
      client.$on("query", (e) => {
        this.logger.log({ duration: e.duration, query: e.query }, "Prisma query");
      });
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
