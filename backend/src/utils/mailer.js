
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

// ======================================================
// IDENTIDAD VISUAL EESTFLOW
// ======================================================

const COLORS = {
  navy: "#203746",
  green: "#16845F",
  background: "#F4F6F7",
  white: "#FFFFFF",
  text: "#394650",
  muted: "#78838B",
  border: "#E1E6E9",
  codeBackground: "#F5F7F8",
};

// ======================================================
// UTILIDAD PARA CONTENIDO HTML
// ======================================================

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

// ======================================================
// ENCABEZADO EESTFLOW
// ======================================================

// Logotipo tipográfico.
// No utiliza imágenes, iconos ni archivos externos.

const buildBrandHeader = () => `
  <div style="
    font-family: Arial, Helvetica, sans-serif;
    font-size: 27px;
    line-height: 1.1;
    font-weight: 700;
    letter-spacing: -1px;
  ">
    <span style="color: ${COLORS.navy};">EEST</span><span style="color: ${COLORS.green};">Flow</span>
  </div>

  <p style="
    margin: 5px 0 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 500;
    letter-spacing: 2px;
    color: ${COLORS.muted};
  ">
    TÉCNICA DIGITAL
  </p>
`;

// ======================================================
// ESTRUCTURA GENERAL DEL EMAIL
// ======================================================

const buildEmailLayout = ({ preheader, content }) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />

  <title>EESTFlow</title>
</head>

<body style="
  margin: 0;
  padding: 0;
  background-color: ${COLORS.background};
  font-family: Arial, Helvetica, sans-serif;
  color: ${COLORS.text};
  -webkit-text-size-adjust: 100%;
">

  <!-- Texto de vista previa -->
  <div style="
    display: none;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    color: transparent;
    mso-hide: all;
  ">
    ${escapeHtml(preheader)}
  </div>

  <!-- Contenedor exterior -->
  <table
    role="presentation"
    width="100%"
    border="0"
    cellspacing="0"
    cellpadding="0"
    bgcolor="${COLORS.background}"
    style="
      width: 100%;
      background-color: ${COLORS.background};
    "
  >
    <tr>
      <td align="center" style="padding: 32px 14px;">

        <!-- Tarjeta principal -->
        <table
          role="presentation"
          width="560"
          border="0"
          cellspacing="0"
          cellpadding="0"
          bgcolor="${COLORS.white}"
          style="
            width: 100%;
            max-width: 560px;
            background-color: ${COLORS.white};
            border: 1px solid ${COLORS.border};
            border-radius: 5px;
          "
        >

          <!-- Encabezado -->
          <tr>
            <td style="
              padding: 25px 30px 22px;
            ">
              ${buildBrandHeader()}
            </td>
          </tr>

          <!-- Separador -->
          <tr>
            <td style="padding: 0 30px;">
              <div style="
                height: 1px;
                background-color: ${COLORS.border};
                font-size: 0;
                line-height: 1px;
              ">
                &nbsp;
              </div>
            </td>
          </tr>

          <!-- Contenido -->
          <tr>
            <td style="
              padding: 30px;
              font-family: Arial, Helvetica, sans-serif;
            ">
              ${content}
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

// ======================================================
// RECUPERACIÓN DE CONTRASEÑA
// ======================================================

export const buildResetCodeEmail = (code) => ({
  subject: "Código para restablecer tu contraseña",

  text: `Tu código para restablecer la contraseña es: ${code}. Vence en 10 minutos.`,

  html: buildEmailLayout({
    preheader:
      "Tu código para restablecer la contraseña. Válido durante 10 minutos.",

    content: `
      <!-- Categoría -->
      <p style="
        margin: 0 0 10px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1px;
        color: ${COLORS.green};
      ">
        SEGURIDAD DE LA CUENTA
      </p>

      <!-- Título -->
      <h1 style="
        margin: 0 0 14px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 23px;
        line-height: 1.35;
        font-weight: 700;
        color: ${COLORS.navy};
      ">
        Recuperar contraseña
      </h1>

      <!-- Descripción -->
      <p style="
        margin: 0 0 25px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: ${COLORS.text};
      ">
        Recibimos una solicitud para restablecer la contraseña
        asociada a tu cuenta de EESTFlow.
        Utilizá el siguiente código para continuar con el proceso.
      </p>

      <!-- Código de recuperación -->
      <table
        role="presentation"
        width="100%"
        border="0"
        cellspacing="0"
        cellpadding="0"
        bgcolor="${COLORS.codeBackground}"
        style="
          width: 100%;
          background-color: ${COLORS.codeBackground};
          border: 1px solid ${COLORS.border};
          border-radius: 4px;
        "
      >
        <tr>
          <td
            align="center"
            style="padding: 22px 12px;"
          >

            <p style="
              margin: 0 0 12px;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 10px;
              font-weight: 600;
              letter-spacing: 1px;
              color: ${COLORS.muted};
            ">
              CÓDIGO DE VERIFICACIÓN
            </p>

            <!--
              El código se mantiene como texto plano,
              sin espacios adicionales ni caracteres decorativos.
              Puede seleccionarse y copiarse directamente.
            -->
            <p
              style="
                margin: 0;
                font-family: 'Courier New', Courier, monospace;
                font-size: 30px;
                line-height: 1.4;
                font-weight: bold;
                letter-spacing: 5px;
                color: ${COLORS.navy};
                word-break: break-all;
                user-select: all;
                -webkit-user-select: all;
              "
            >
              ${escapeHtml(code)}
            </p>

            <p style="
              margin: 12px 0 0;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11px;
              color: ${COLORS.muted};
            ">
              Seleccioná el código para copiarlo.
            </p>

          </td>
        </tr>
      </table>

      <!-- Información de vencimiento -->
      <table
        role="presentation"
        width="100%"
        border="0"
        cellspacing="0"
        cellpadding="0"
        style="margin-top: 22px;"
      >
        <tr>
          <td style="
            padding: 13px 15px;
            background-color: #F8F9FA;
            border: 1px solid ${COLORS.border};
            border-radius: 4px;
          ">
            <p style="
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13px;
              line-height: 1.7;
              color: ${COLORS.text};
            ">
              <strong style="color: ${COLORS.navy};">
                Validez del código:
              </strong>
              10 minutos desde su emisión.
            </p>
          </td>
        </tr>
      </table>

      <!-- Aviso de seguridad -->
      <p style="
        margin: 24px 0 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 1.7;
        color: ${COLORS.muted};
      ">
        Si no solicitaste restablecer tu contraseña,
        podés ignorar este correo. Tu cuenta no sufrirá
        ningún cambio.
      </p>
    `,
  }),
});

// ======================================================
// NOTIFICACIÓN DE CONTRASEÑA ACTUALIZADA
// ======================================================

export const buildPasswordChangedEmail = () => ({
  subject: "Tu contraseña fue cambiada",

  text: "La contraseña de tu cuenta fue cambiada. Si no fuiste vos, comunicate con un administrador.",

  html: buildEmailLayout({
    preheader:
      "La contraseña de tu cuenta fue actualizada correctamente.",

    content: `
      <!-- Categoría -->
      <p style="
        margin: 0 0 10px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1px;
        color: ${COLORS.green};
      ">
        SEGURIDAD DE LA CUENTA
      </p>

      <!-- Título -->
      <h1 style="
        margin: 0 0 14px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 23px;
        line-height: 1.35;
        font-weight: 700;
        color: ${COLORS.navy};
      ">
        Contraseña actualizada
      </h1>

      <!-- Descripción -->
      <p style="
        margin: 0 0 24px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: ${COLORS.text};
      ">
        La contraseña asociada a tu cuenta de EESTFlow
        fue cambiada correctamente.
      </p>

      <!-- Confirmación -->
      <table
        role="presentation"
        width="100%"
        border="0"
        cellspacing="0"
        cellpadding="0"
        bgcolor="${COLORS.codeBackground}"
        style="
          width: 100%;
          background-color: ${COLORS.codeBackground};
          border: 1px solid ${COLORS.border};
          border-radius: 4px;
        "
      >
        <tr>
          <td style="padding: 17px 18px;">

            <p style="
              margin: 0 0 6px;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13px;
              font-weight: 600;
              color: ${COLORS.navy};
            ">
              Cambio realizado correctamente
            </p>

            <p style="
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13px;
              line-height: 1.7;
              color: ${COLORS.text};
            ">
              Tu nueva contraseña ya se encuentra activa.
              No necesitás realizar ninguna otra acción.
            </p>

          </td>
        </tr>
      </table>

      <!-- Aviso de seguridad -->
      <p style="
        margin: 24px 0 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 1.7;
        color: ${COLORS.muted};
      ">
        <strong style="color: ${COLORS.navy};">
          ¿No realizaste este cambio?
        </strong>
        Si no fuiste vos, comunicate con un administrador
        del sistema para revisar la seguridad de tu cuenta.
      </p>
    `,
  }),
});
