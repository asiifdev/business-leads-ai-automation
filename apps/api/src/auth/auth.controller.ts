import { Controller, Post, Get, Body, Headers, UnauthorizedException, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@ApiTags("Auth")
@Throttle({ default: { ttl: 60000, limit: 10 } })
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

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Logout — clears session on client side" })
  logout() {
    // JWT is stateless. Client must delete the token from storage.
    // For server-side session invalidation, implement a token blocklist with Redis.
    return;
  }
}
