import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { HybridAuthGuard } from './guards/hybrid-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard, HybridAuthGuard],
  exports: [JwtAuthGuard, RolesGuard, HybridAuthGuard],
})
export class AuthModule {}
