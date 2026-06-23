import { IsString, IsArray, IsOptional, IsInt, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCampaignDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() industry: string;
  @ApiProperty() @IsString() location: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) searchQueries: string[];
  @ApiProperty() @IsString() yourService: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) maxResults?: number;
  @ApiProperty({ default: "balanced" }) @IsOptional() @IsString() contentStyle?: string;
  @ApiProperty({ default: "indonesian" }) @IsOptional() @IsString() language?: string;
}
