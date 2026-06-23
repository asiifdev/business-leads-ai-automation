import { IsString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateCrmDto {
  @ApiProperty({
    enum: ["new", "contacted", "replied", "meeting", "proposal", "won", "lost"],
    required: false,
  })
  @IsString() @IsOptional()
  crmStatus?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() crmNotes?: string;
}
