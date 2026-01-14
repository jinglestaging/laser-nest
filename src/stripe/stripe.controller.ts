import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    if (!req.rawBody) {
      throw new BadRequestException('Missing request body');
    }

    try {
      await this.stripeService.handleWebhookEvent(req.rawBody, signature);
      res.status(200).send();
    } catch (err: unknown) {
      const errorMessage = (err as Error).message;
      throw new BadRequestException(`Webhook Error: ${errorMessage}`);
    }
  }
}
