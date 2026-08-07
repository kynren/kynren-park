import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

/** Thin SMTP mailer. No-ops (with a warning) when SMTP env isn't configured. */
@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  private transporter: Transporter | null = null;

  get configured() {
    return !!process.env.SMTP_HOST;
  }

  private get tx(): Transporter | null {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    return this.transporter;
  }

  /** Health probe: verifies the SMTP connection for the status page. */
  async verify(): Promise<{ ok: boolean; detail: string }> {
    const tx = this.tx;
    if (!tx) return { ok: false, detail: 'SMTP not configured — email disabled.' };
    try {
      await tx.verify();
      return { ok: true, detail: 'SMTP connection verified.' };
    } catch (e) {
      return { ok: false, detail: `SMTP error: ${(e as Error).message}` };
    }
  }

  async send(to: string, subject: string, html: string): Promise<{ sent: boolean }> {
    const tx = this.tx;
    if (!tx) {
      this.logger.warn(`SMTP not configured — email to ${to} ("${subject}") not sent.`);
      return { sent: false };
    }
    const from = process.env.SMTP_FROM || 'Kynren <no-reply@kynren.com>';
    try {
      await tx.sendMail({ from, to, subject, html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
      return { sent: true };
    } catch (e) {
      this.logger.error(`Failed to send email to ${to}: ${(e as Error).message}`);
      return { sent: false };
    }
  }
}
