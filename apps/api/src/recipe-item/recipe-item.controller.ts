import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PaginationQueryDto, toLimit, toPage } from "../common/pagination";
import { CreateRecipeItemDto } from "./dto/create-recipe-item.dto";
import { UpdateRecipeItemDto } from "./dto/update-recipe-item.dto";
import { RecipeItemService } from "./recipe-item.service";

@Controller("recipe-items")
export class RecipeItemController {
  constructor(private readonly recipeItemService: RecipeItemService) {}

  @Post()
  create(@Body() dto: CreateRecipeItemDto) {
    return this.recipeItemService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto, @Query("productId") productId?: string) {
    return this.recipeItemService.findAll(toPage(query), toLimit(query), productId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.recipeItemService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateRecipeItemDto) {
    return this.recipeItemService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.recipeItemService.remove(id);
  }
}
