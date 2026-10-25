import { IsString, IsArray, IsOptional, IsInt, IsIn, ArrayMinSize, ArrayUnique, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { IsLanguage } from "../../common/language-validator";
import { IsCountryCode } from "../../common/country-validator";
import { SOURCE_IDS } from "../../common/lead-sources";

export class CreateCampaignDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() industry: string;
  @ApiProperty() @IsString() location: string;
  @ApiProperty({ required: false, default: "ID", description: "ISO 3166-1 alpha-2 country code; one campaign searches one country" })
  @IsOptional() @IsCountryCode() country?: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) searchQueries: string[];
  @ApiProperty({ required: false, enum: SOURCE_IDS, isArray: true, default: ["google_maps"], description: "Where to look for leads, in order; later sources fill what earlier ones left of maxResults" })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsIn(SOURCE_IDS, { each: true }) sources?: string[];
  @ApiProperty() @IsString() yourService: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(2000) maxResults?: number;
  @ApiProperty({ default: "balanced" }) @IsOptional() @IsString() contentStyle?: string;
  @ApiProperty({ required: false, description: "Language the outreach is written in: \"indonesian\", \"english\" or a two-letter language code. Defaults to the country's main language." })
  @IsOptional() @IsLanguage() language?: string;
}
