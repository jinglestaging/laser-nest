import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  UseGuards,
  Req,
  UseFilters,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../upload/upload.service';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';
import { MulterExceptionFilter } from './multer-exception.filter';
import { UploadedFile as UploadedFileMulter } from '@01ai/api-types';

const imageFileFilter = {
  limits: {
    fieldNameSize: 300,
    files: 1,
    fileSize: 15 * 1024 * 1024, // 15MB
  },
  fileFilter: (
    req: Request,
    file: UploadedFileMulter,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ): void => {
    if (file.mimetype.match(/\/(webp|gif|jpg|jpeg|png)$/)) {
      cb(null, true);
    } else {
      cb(
        new HttpException(
          'The only supported file formats are JPEG, PNG, WEBP, and GIF.',
          HttpStatus.BAD_REQUEST,
        ),
        false,
      );
    }
  },
};

const fileFilter = {
  limits: {
    fieldNameSize: 300,
    files: 1,
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (
    req: Request,
    file: UploadedFileMulter,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    // Add zero-byte check in filter
    if (file.size === 0) {
      cb(
        new HttpException(
          'File is empty. Please upload a non-empty file.',
          HttpStatus.BAD_REQUEST,
        ),
        false,
      );
    } else {
      cb(null, true);
    }
  },
};

@Controller('upload')
@UseFilters(MulterExceptionFilter)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('image', imageFileFilter))
  async uploadImage(@UploadedFile() file: UploadedFileMulter) {
    if (!file) {
      throw new HttpException(
        { message: 'Please select an image file to upload.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.uploadService.uploadImage(file);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      throw new HttpException(
        { message: errorMessage || 'Image upload failed' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('file')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('file', fileFilter))
  async uploadFileToB2(
    @UploadedFile() file: UploadedFileMulter,
    @GetUser() user,
    @Req() req: Request,
  ) {
    req.setTimeout(5 * 60 * 1000);

    if (!file) {
      throw new HttpException(
        {
          message:
            'Please select a file to upload. Only one file is allowed per request.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.uploadService.uploadFileToB2(file, user.id);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      const errorName =
        error && typeof error === 'object' && 'name' in error
          ? (error as { name?: string }).name
          : undefined;
      throw new HttpException(
        {
          message: errorMessage || 'Upload failed',
          error: errorName || 'UploadError',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
