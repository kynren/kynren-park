import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';

@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
