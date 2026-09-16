import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateRecipeCostProfileDto } from "./create-recipe-cost-profile.dto";

export class UpdateRecipeCostProfileDto extends PartialType(OmitType(CreateRecipeCostProfileDto, ["productId"])) {}
