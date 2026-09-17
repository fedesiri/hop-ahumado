import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateQuoteDto } from "./create-quote.dto";

export class UpdateQuoteDto extends PartialType(OmitType(CreateQuoteDto, ["businessLineId"])) {}
