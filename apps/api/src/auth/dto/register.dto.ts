import { IsEmail, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiProperty() @IsString() workspaceName: string;
}
