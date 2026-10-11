import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { CurrentUserId } from "../auth/current-user.decorator";
import { EntitlementsService } from "./entitlements.service";

@ApiTags("Entitlements")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("entitlements")
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  list(@WorkspaceId() ws: string, @CurrentUserId() userId: string) {
    return this.entitlements.list(ws, userId);
  }
}
