import Stripe from 'stripe';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });

    const webhookSecret = this.configService.get<string>(
      'STRIPE_SECRET_WEBHOOK',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_SECRET_WEBHOOK is required');
    }
    this.webhookSecret = webhookSecret;
  }

  onModuleInit(): void {
    this.logger.log('Stripe service initialized');
  }

  getStripe(): Stripe {
    return this.stripe;
  }

  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }

  handleWebhookEvent(rawBody: Buffer, signature: string): void {
    const event = this.constructEvent(rawBody, signature);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        this.logger.log(`Checkout completed for session: ${session.id}`);
        break;
      }
      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }
  }
}
