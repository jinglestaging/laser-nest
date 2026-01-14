import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User as SupabaseUser } from '@supabase/supabase-js';

export const GetUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<any>();
    return request.user as SupabaseUser;
  },
);
