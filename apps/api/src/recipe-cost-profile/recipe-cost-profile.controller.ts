import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { CreateRecipeCostProfileDto } from "./dto/create-recipe-cost-profile.dto";
import { GetRecipeCostProfilesQueryDto } from "./dto/get-recipe-cost-profiles-query.dto";
import { UpdateRecipeCostProfileDto } from "./dto/update-recipe-cost-profile.dto";
import { RecipeCostProfileService } from "./recipe-cost-profile.service";

@Controller("recipe-cost-profiles")
export class RecipeCostProfileController {
  constructor(private readonly service: RecipeCostProfileService) {}

  @Post()
  create(@Body() dto: CreateRecipeCostProfileDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: GetRecipeCostProfilesQueryDto) {
    return this.service.findAll(
      toPage(query),
      toLimit(query),
      query.businessLineId,
      query.search,
      query.includeDeactivated === "true",
    );
  }

  @Get(":productId")
  findOne(@Param("productId") productId: string) {
    return this.service.findOne(productId);
  }

  @Patch(":productId")
  update(@Param("productId") productId: string, @Body() dto: UpdateRecipeCostProfileDto) {
    return this.service.update(productId, dto);
  }

  @Delete(":productId")
  remove(@Param("productId") productId: string) {
    return this.service.remove(productId);
  }

  @Get(":productId/costing")
  getCosting(@Param("productId") productId: string) {
    return this.service.computeCosting(productId);
  }

  @Get(":productId/pricing")
  getPricing(@Param("productId") productId: string) {
    return this.service.computePricing(productId);
  }
}
