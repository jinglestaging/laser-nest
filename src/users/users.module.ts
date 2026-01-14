import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EmailModule } from 'src/email/email.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [EmailModule, SupabaseModule, CommonModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
