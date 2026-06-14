import nodemailer from 'nodemailer';

function readPort(value: string | undefined, fallback: number) {
  const port = Number(value);
  return Number.isFinite(port) ? port : fallback;
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: readPort(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

export async function sendShowcaseLeadEmail(params: {
  to: string;
  siteSlug: string;
  formTitle: string;
  fields: Array<{ label: string; value: string }>;
}) {
  const transport = getTransport();
  if (!transport) throw new Error('SMTP is not configured');

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const subject = `Новая заявка с сайта ${params.siteSlug}`;
  const lines = params.fields.map((field) => `${field.label}: ${field.value}`);
  const text = [
    `Сайт: ${params.siteSlug}`,
    `Форма: ${params.formTitle || 'Форма обратной связи'}`,
    '',
    ...lines,
  ].join('\n');

  await transport.sendMail({
    from,
    to: params.to,
    subject,
    text,
  });
}
