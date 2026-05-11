import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import { FileService } from './file.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@ApiTags('文件存储')
@ApiBearerAuth()
@Controller('api/v1/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @ApiOperation({ summary: '上传文件' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: undefined })) // 使用内存存储，由 service 写盘
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('refType') refType: string,
    @Body('refId') refId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fileService.upload(
      file,
      refType || 'general',
      refId || 'unknown',
      user.sub,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '文件元数据' })
  findOne(@Param('id') id: string) {
    return this.fileService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: '下载文件' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { filePath, file } = await this.fileService.download(id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    res.sendFile(path.resolve(filePath));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除文件' })
  delete(@Param('id') id: string) {
    return this.fileService.delete(id);
  }
}
