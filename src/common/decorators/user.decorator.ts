import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface RequestWithUser {
  user?: SupabaseUser;
}

export const GetUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SupabaseUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('User not found in request');
    }
    return request.user;
  },
);
