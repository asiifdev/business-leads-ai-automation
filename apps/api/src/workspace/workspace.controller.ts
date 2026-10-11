import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { WorkspaceService } from "./workspace.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { CurrentUserId } from "../auth/current-user.decorator";
import { IsString, MaxLength, MinLength } from "class-validator";

class CreateWorkspaceDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
}
class SwitchWorkspaceDto {
  @IsString() @MinLength(1) @MaxLength(64) workspaceId!: string;
}

@ApiTags("Workspace")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("workspace")
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  @ApiOperation({ summary: "Get the current workspace" })
  getWorkspace(@WorkspaceId() workspaceId: string) {
    return this.workspaceService.getWorkspace(workspaceId);
  }

  @Get("mine")
  @ApiOperation({ summary: "Every workspace (business) this login belongs to" })
  mine(@CurrentUserId() userId: string, @WorkspaceId() workspaceId: string) {
    return this.workspaceService.listMine(userId, workspaceId);
  }

  @Post()
  @ApiOperation({ summary: "Create another workspace for this login and switch to it" })
  create(@CurrentUserId() userId: string, @Body() body: CreateWorkspaceDto) {
    return this.workspaceService.create(userId, body.name);
  }

  @Post("switch")
  @ApiOperation({ summary: "Switch to another workspace this login belongs to; returns a new token" })
  switchTo(@CurrentUserId() userId: string, @Body() body: SwitchWorkspaceDto) {
    return this.workspaceService.switchTo(userId, body.workspaceId);
  }

  @Patch()
  @ApiOperation({ summary: "Update workspace name/slug (owner/admin only)" })
  updateWorkspace(
    @WorkspaceId() workspaceId: string,
    @CurrentUserId() requesterId: string,
    @Body() body: { name?: string; slug?: string },
  ) {
    return this.workspaceService.updateWorkspace(workspaceId, body, requesterId);
  }

  @Get("members")
  @ApiOperation({ summary: "List workspace members" })
  getMembers(@WorkspaceId() workspaceId: string) {
    return this.workspaceService.getMembers(workspaceId);
  }

  @Post("members")
  @ApiOperation({ summary: "Invite a user to the workspace by email (owner/admin only)" })
  inviteMember(
    @WorkspaceId() workspaceId: string,
    @CurrentUserId() requesterId: string,
    @Body() body: { email: string; role?: string },
  ) {
    return this.workspaceService.inviteMember(workspaceId, body.email, body.role ?? "member", requesterId);
  }

  @Patch("members/:id")
  @ApiOperation({ summary: "Update member role (owner/admin only)" })
  updateRole(
    @WorkspaceId() workspaceId: string,
    @CurrentUserId() requesterId: string,
    @Param("id") memberId: string,
    @Body() body: { role: string },
  ) {
    return this.workspaceService.updateMemberRole(workspaceId, memberId, body.role, requesterId);
  }

  @Delete("members/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a member from the workspace (owner/admin only)" })
  removeMember(
    @WorkspaceId() workspaceId: string,
    @CurrentUserId() requesterId: string,
    @Param("id") memberId: string,
  ) {
    return this.workspaceService.removeMember(workspaceId, memberId, requesterId);
  }
}
