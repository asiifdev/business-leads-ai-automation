import { IsString, IsArray, IsOptional, IsInt, IsIn, ArrayMinSize, ArrayUnique, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { SOURCE_IDS } from "../../common/lead-sources";

export class CreateCampaignDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() industry: string;
  @ApiProperty() @IsString() location: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) searchQueries: string[];
  @ApiProperty({ required: false, enum: SOURCE_IDS, isArray: true, default: ["google_maps"], description: "Where to look for leads, in order; later sources fill what earlier ones left of maxResults" })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsIn(SOURCE_IDS, { each: true }) sources?: string[];
  @ApiProperty() @IsString() yourService: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(2000) maxResults?: number;
  @ApiProperty({ default: "balanced" }) @IsOptional() @IsString() contentStyle?: string;
  @ApiProperty({ default: "indonesian" }) @IsOptional() @IsString() language?: string;
}
