import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';

export interface EmailContext {
  [key: string]: string | number | boolean | undefined;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly smtpUser: string;
  private readonly smtpHost: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>('FORPSI_SMTP_USER');
    const smtpPassword = this.configService.get<string>('FORPSI_SMTP_PASSWORD');

    if (!smtpUser || !smtpPassword) {
      throw new Error('FORPSI_SMTP_USER and FORPSI_SMTP_PASSWORD are required');
    }

    this.smtpUser = smtpUser;
    this.smtpHost =
      this.configService.get<string>('SMTP_HOST') ?? 'smtp.forpsi.com';
    this.fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') ?? '01 Webs';

    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      connectionTimeout: 30_000,
      greetingTimeout: 15_000,
      dnsTimeout: 5_000,
      socketTimeout: 120_000,
    });
  }

  onModuleInit(): void {
    this.logger.log(`Email service initialized with host: ${this.smtpHost}`);
  }

  private compileTemplate(templateName: string, context: EmailContext): string {
    const templatePath = path.join(
      process.cwd(),
      'src',
      'email',
      'templates',
      `${templateName}.hbs`,
    );
    try {
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      return template(context);
    } catch (error) {
      this.logger.error(`Error reading template file: ${templatePath}`, error);
      throw new Error('Failed to compile email template');
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    templateName: string,
    context: EmailContext,
  ): Promise<void> {
    try {
      const html = this.compileTemplate(templateName, context);

      await this.transporter.sendMail({
        from: `${this.fromName} <${this.smtpUser}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error('Error sending email', error);
      throw new Error('Failed to send email');
    }
  }
}
