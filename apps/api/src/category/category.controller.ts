import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { CategoryService } from "./category.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { GetCategoriesQueryDto } from "./dto/get-categories-query.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Get()
  findAll(@Query() query: GetCategoriesQueryDto) {
    return this.categoryService.findAll(toPage(query), toLimit(query), query.businessLineId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.categoryService.remove(id);
  }
}
