/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import B2 from 'backblaze-b2';
import { UploadedFile } from '@01ai/api-types';

export interface B2UploadResponse {
  fileId: string;
  fileName: string;
  contentLength: number;
  contentSha1: string;
  contentType: string;
  fileInfo: Record<string, any>;
  bucketId: string;
  accountId: string;
  action: string;
  uploadTimestamp: number;
  url: string;
}

@Injectable()
export class UploadService {
  constructor(
    @Inject('BACKBLAZE_B2') private readonly b2: B2,
    private readonly configService: ConfigService,
  ) {}

  async uploadImage(
    file: UploadedFile,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { resource_type: 'image' },
          (e: UploadApiErrorResponse, result: UploadApiResponse) => {
            if (!e) {
              resolve(result);
            } else {
              reject(new Error(e.message));
            }
          },
        )
        .end(file.buffer);
    });
  }

  async uploadFileToB2(
    file: UploadedFile,
    userId?: string,
  ): Promise<B2UploadResponse> {
    try {
      await this.b2.authorize();

      // Get upload URL
      const { data: uploadData } = await this.b2.getUploadUrl({
        bucketId: this.configService.get('B2_BUCKET_ID'),
      });

      // Generate unique filename
      const timestamp = Date.now();
      const extension = file.originalname.split('.').pop();
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;

      // Upload file
      const uploadResponse = await this.b2.uploadFile({
        uploadUrl: uploadData.uploadUrl,
        uploadAuthToken: uploadData.authorizationToken,
        fileName: fileName,
        data: file.buffer,
        contentLength: file.size,
        contentType: file.mimetype,
        info: {
          nodeenvironment: this.configService.get('NODE_ENV'),
          userid: userId || 'anonymous',
          originalname: file.originalname,
        },
      });

      const bucketName = this.configService.get('B2_BUCKET_NAME');
      const url = `https://${bucketName}.s3.us-east-005.backblazeb2.com/${fileName}`;

      return {
        fileId: uploadResponse.data.fileId,
        fileName: uploadResponse.data.fileName,
        contentLength: uploadResponse.data.contentLength,
        contentSha1: uploadResponse.data.contentSha1,
        contentType: uploadResponse.data.contentType,
        fileInfo: uploadResponse.data.fileInfo,
        bucketId: uploadResponse.data.bucketId,
        accountId: uploadResponse.data.accountId,
        action: uploadResponse.data.action,
        uploadTimestamp: uploadResponse.data.uploadTimestamp,
        url,
      };
    } catch (error) {
      throw new Error(`Failed to upload to B2: ${error.message}`);
    }
  }
}
