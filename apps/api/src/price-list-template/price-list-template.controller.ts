import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsUUID } from "class-validator";
import type { Response } from "express";
import { UpdatePriceListTemplateDto } from "./dto/update-price-list-template.dto";
import { PriceListTemplateService } from "./price-list-template.service";

class ListQueryDto {
  @IsUUID("4")
  businessLineId: string;
}

@Controller("price-list-templates")
export class PriceListTemplateController {
  constructor(private readonly service: PriceListTemplateService) {}

  @Get()
  findAll(@Query() query: ListQueryDto) {
    return this.service.findAll(query.businessLineId);
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 12 * 1024 * 1024 } }))
  create(
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Body() body: { name?: string; businessLineId?: string; imageWidth?: string; imageHeight?: string; priceList?: string },
  ) {
    return this.service.create(file, body);
  }

  @Patch(":id")
  update(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: UpdatePriceListTemplateDto) {
    return this.service.update(id, dto);
  }

  @Get(":id/image")
  async image(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Res() res: Response) {
    const { buffer, contentType } = await this.service.getImage(id);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buffer);
  }

  @Delete(":id")
  remove(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.service.remove(id);
  }
}
