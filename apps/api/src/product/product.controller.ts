import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PaginationQueryDto, toLimit, toPage } from "../common/pagination";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductService } from "./product.service";

@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto, @Query("includeDeactivated") includeDeactivated?: string) {
    const include = includeDeactivated === "true";
    return this.productService.findAll(include, toPage(query), toLimit(query));
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.productService.remove(id);
  }
}
