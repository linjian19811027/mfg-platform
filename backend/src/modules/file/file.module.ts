import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SysFile } from './entities/sys-file.entity.js';
import { FileService } from './file.service.js';
import { FileController } from './file.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SysFile]),
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
