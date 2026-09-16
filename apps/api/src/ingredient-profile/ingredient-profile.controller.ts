import { Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { GetIngredientProfilesQueryDto } from "./dto/get-ingredient-profiles-query.dto";
import { UpsertIngredientProfileDto } from "./dto/upsert-ingredient-profile.dto";
import { IngredientProfileService } from "./ingredient-profile.service";

@Controller("ingredient-profiles")
export class IngredientProfileController {
  constructor(private readonly ingredientProfileService: IngredientProfileService) {}

  @Get()
  findAll(@Query() query: GetIngredientProfilesQueryDto) {
    return this.ingredientProfileService.findAll(
      toPage(query),
      toLimit(query),
      query.businessLineId,
      query.search,
      query.categoryId,
      query.includeDeactivated === "true",
    );
  }

  @Get(":productId")
  findOne(@Param("productId") productId: string) {
    return this.ingredientProfileService.findOne(productId);
  }

  @Put(":productId")
  upsert(@Param("productId") productId: string, @Body() dto: UpsertIngredientProfileDto) {
    return this.ingredientProfileService.upsert(productId, dto);
  }
}
