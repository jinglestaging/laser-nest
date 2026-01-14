import { ConfigService } from '@nestjs/config';
import B2 from 'backblaze-b2';

export const BackblazeB2Provider = {
  provide: 'BACKBLAZE_B2',
  useFactory: (configService: ConfigService) => {
    return new B2({
      applicationKeyId: configService.get<string>('B2_ACCOUNT_ID'),
      applicationKey: configService.get<string>('B2_MASTER_KEY'),
      axios: {
        timeout: 30000,
      },
      retry: {
        retries: 5,
      },
    });
  },
  inject: [ConfigService],
};
