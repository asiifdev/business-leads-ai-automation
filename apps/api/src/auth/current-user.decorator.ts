import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.user?.sub;
  },
);
