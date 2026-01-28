import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnchorbrowserService } from './anchorbrowser.service';

@Module({
  imports: [ConfigModule],
  providers: [AnchorbrowserService],
  exports: [AnchorbrowserService],
})
export class AnchorbrowserModule {}
