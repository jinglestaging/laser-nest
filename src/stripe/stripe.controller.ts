import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  RawBodyRequest,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(private readonly stripeService: StripeService) {}

  @Post('webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ): void {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    if (!req.rawBody) {
      throw new BadRequestException('Missing request body');
    }

    try {
      this.stripeService.handleWebhookEvent(req.rawBody, signature);
      res.status(200).send();
    } catch (err: unknown) {
      if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
        this.logger.warn('Invalid Stripe signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook error: ${errorMessage}`);
      throw new BadRequestException(`Webhook Error: ${errorMessage}`);
    }
  }
}
