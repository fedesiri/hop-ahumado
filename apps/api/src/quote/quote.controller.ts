import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { GetQuotesQueryDto } from "./dto/get-quotes-query.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";
import { QuoteService } from "./quote.service";

@Controller("quotes")
export class QuoteController {
  constructor(private readonly service: QuoteService) {}

  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: GetQuotesQueryDto) {
    return this.service.findAll(toPage(query), toLimit(query), query.businessLineId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateQuoteDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
