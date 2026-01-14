import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.forpsi.com',
      port: 465,
      secure: true,
      auth: {
        user: this.configService.get<string>('FORPSI_SMTP_USER'),
        pass: this.configService.get<string>('FORPSI_SMTP_PASSWORD'),
      },
      connectionTimeout: 30_000,
      greetingTimeout: 15_000,
      dnsTimeout: 5_000,
      socketTimeout: 120_000,
    });
  }

  private compileTemplate(templateName: string, context: any): string {
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
      console.error(`Error reading template file: ${templatePath}`, error);
      throw new Error('Failed to compile email template');
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    templateName: string,
    context: any,
  ): Promise<void> {
    try {
      const html = this.compileTemplate(templateName, context);

      // Send the email
      await this.transporter.sendMail({
        from: `01 Webs <${this.configService.get<string>('FORPSI_SMTP_USER')}>`,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }
}
