import { IsString, IsOptional, IsInt, Min, Max, IsBoolean, IsDateString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateCrmDto {
  @ApiProperty({
    enum: ["new", "contacted", "replied", "meeting", "proposal", "won", "lost"],
    required: false,
  })
  @IsString() @IsOptional()
  crmStatus?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(4000) crmNotes?: string;

  @ApiProperty({ required: false, description: "Deal value in the workspace currency (whole units)" })
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000_000) dealValue?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) lostReason?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsDateString() followUpDate?: string;

  @ApiProperty({ required: false, description: "Owner has handled the latest reply" })
  @IsOptional() @IsBoolean() needsReply?: boolean;
}
