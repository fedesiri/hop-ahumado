import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PriceListTemplate, Prisma } from "@prisma/client";
import { firebaseAdmin } from "../auth/firebase-admin";
import { PrismaService } from "../prisma/prisma.service";
import { UpdatePriceListTemplateDto } from "./dto/update-price-list-template.dto";

const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function bucket() {
  const name = process.env.FIREBASE_STORAGE_BUCKET;
  if (!name) throw new BadRequestException("Falta configurar FIREBASE_STORAGE_BUCKET en el servidor");
  return firebaseAdmin.storage().bucket(name);
}

export type PriceListTemplateResponse = Omit<PriceListTemplate, "imagePath" | "slots"> & { slots: unknown };

function toResponse(t: PriceListTemplate): PriceListTemplateResponse {
  const { imagePath: _imagePath, ...rest } = t;
  return rest;
}

@Injectable()
export class PriceListTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(businessLineId: string): Promise<PriceListTemplateResponse[]> {
    const rows = await this.prisma.priceListTemplate.findMany({
      where: { businessLineId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toResponse);
  }

  async create(
    file: { buffer: Buffer; mimetype: string } | undefined,
    body: { name?: string; businessLineId?: string; imageWidth?: string; imageHeight?: string },
  ): Promise<PriceListTemplateResponse> {
    if (!file) throw new BadRequestException("Falta la imagen");
    if (!MIME_TYPES.includes(file.mimetype)) throw new BadRequestException("La imagen debe ser JPG, PNG o WEBP");
    const name = body.name?.trim();
    if (!name) throw new BadRequestException("Falta el nombre");
    const width = Number(body.imageWidth);
    const height = Number(body.imageHeight);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new BadRequestException("Dimensiones de imagen inválidas");
    }
    const line = body.businessLineId
      ? await this.prisma.businessLine.findUnique({ where: { id: body.businessLineId }, select: { id: true } })
      : null;
    if (!line) throw new BadRequestException("Línea de negocio inválida");

    const path = `price-list-templates/${line.id}/${randomUUID()}.${EXTENSIONS[file.mimetype]}`;
    await bucket().file(path).save(file.buffer, { contentType: file.mimetype, resumable: false });
    const row = await this.prisma.priceListTemplate.create({
      data: { businessLineId: line.id, name, imagePath: path, imageWidth: width, imageHeight: height },
    });
    return toResponse(row);
  }

  async update(id: string, dto: UpdatePriceListTemplateDto): Promise<PriceListTemplateResponse> {
    await this.getOrThrow(id);
    const row = await this.prisma.priceListTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim() || undefined,
        slots: dto.slots ? (dto.slots as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
    return toResponse(row);
  }

  async getImage(id: string): Promise<{ buffer: Buffer; contentType: string }> {
    const row = await this.getOrThrow(id);
    const file = bucket().file(row.imagePath);
    const [[buffer], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
    return { buffer, contentType: String(meta.contentType ?? "image/jpeg") };
  }

  async remove(id: string): Promise<{ id: string }> {
    const row = await this.getOrThrow(id);
    await this.prisma.priceListTemplate.delete({ where: { id } });
    try {
      await bucket().file(row.imagePath).delete({ ignoreNotFound: true });
    } catch {
      // Un archivo huérfano no debe romper el borrado.
    }
    return { id };
  }

  private async getOrThrow(id: string): Promise<PriceListTemplate> {
    const row = await this.prisma.priceListTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`No existe la plantilla "${id}"`);
    return row;
  }
}
