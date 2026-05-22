import {
  Controller,
  Post,
  Get,
  Put,
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

  @Get(':id/preview')
  @ApiOperation({ summary: '预览文件（内嵌显示）' })
  async preview(@Param('id') id: string, @Res() res: Response) {
    const { filePath, file } = await this.fileService.download(id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.sendFile(path.resolve(filePath));
  }

  @Get(':id/content')
  @ApiOperation({ summary: '读取文本文件内容' })
  async readContent(@Param('id') id: string) {
    return this.fileService.readTextContent(id);
  }

  @Put(':id/content')
  @ApiOperation({ summary: '保存文本文件编辑' })
  async saveContent(
    @Param('id') id: string,
    @Body() body: { content: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fileService.saveTextContent(id, body.content, user.sub);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: '获取文件版本历史' })
  async getVersions(@Param('id') id: string) {
    return this.fileService.getVersions(id);
  }
}
