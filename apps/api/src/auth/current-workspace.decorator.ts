import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const WorkspaceId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.user?.workspaceId ?? "default-workspace";
  },
);
