import { Controller, Post, Get, Body, Headers, UnauthorizedException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwt: JwtService,
  ) {}

  @Post("register")
  @ApiOperation({ summary: "Register new user + workspace" })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Login with email + password" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user info" })
  async me(@Headers("authorization") auth: string) {
    if (!auth?.startsWith("Bearer ")) throw new UnauthorizedException();
    const token = auth.slice(7);
    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      return this.authService.me(payload.sub);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
