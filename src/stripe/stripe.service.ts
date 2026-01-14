import Stripe from 'stripe';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.stripe = new Stripe(
      configService.get<string>('STRIPE_SECRET_KEY') || '',
      {
        apiVersion: '2025-12-15.clover',
      },
    );
  }

  getStripe() {
    return this.stripe;
  }

  constructEvent(payload: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.configService.get<string>('STRIPE_SECRET_WEBHOOK') || '',
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    const event = this.constructEvent(rawBody, signature);

    switch (event.type) {
      case 'checkout.session.completed':
        ///
        break;
      // Add more event handlers as needed
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }
}
