import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = HttpStatus.BAD_REQUEST;

    let message: string;

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size exceeds the maximum limit of 50MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Only one file is allowed per upload.';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields in the request.';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name is too long.';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value is too long.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name for file upload.';
        break;
      case 'MISSING_FIELD_NAME':
        message = 'Missing field name for file upload.';
        break;
      default:
        message = exception.message || 'File upload error occurred.';
    }

    response.status(status).json({
      success: false,
      message,
      error: 'MulterError',

      code: exception.code,
    });
  }
}
