import nodemailer from "nodemailer";
import ApiError from "./apiError.js";

// Reutiliza un único transporter mientras el proceso viva. Se construye de forma perezosa para no fallar al importar el módulo si falta configuración.
let transporter;

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
      typeof process.env.SMTP_SECURE === "string"
        ? process.env.SMTP_SECURE === "true"
        : port === 465;

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  return transporter;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  // Sin SMTP configurado no se puede enviar. En producción es un error de configuración; en desarrollo/test se registra para no romper el flujo local.
  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(500, "Email service is not configured");
    }
    console.warn(`[mailer] SMTP no configurado; email a ${to} no enviado.`);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Error sending email");
  }
};

export const buildResetCodeEmail = (code) => ({
  subject: "Código para restablecer tu contraseña",
  text: `Tu código para restablecer la contraseña es: ${code}. Vence en 10 minutos.`,
  html: `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">Recuperar contraseña</h2>
      <p style="margin: 0 0 16px;">Usá este código para restablecer tu contraseña:</p>
      <p style="margin: 0 0 16px;">
        <code style="display: inline-block; font-size: 30px; font-weight: bold; letter-spacing: 8px; padding: 8px 16px; background: #f3f4f6; border-radius: 6px;">${code}</code>
      </p>
      <p style="margin: 0; color: #6b7280;">El código vence en 10 minutos. Si no lo pediste, ignorá este mensaje.</p>
    </div>
  `,
});
