import nodemailer from "nodemailer";
import dotenv from "dotenv";
import ejs from "ejs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Send professional email using EJS template
 * @param {Object} options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - EJS template file name
 * @param {Object} options.data - Data to inject into template
 */
const sendEmail = async ({ email, subject, template, data }) => {
  try {
    if (!template) {
      throw new Error("Email template is not defined.");
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const templatePath = path.join(__dirname, "../Mails", template);
    const html = await ejs.renderFile(templatePath, data);

    const mailOptions = {
      from: process.env.SMTP_MAIL,
      to: email,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", email);
    return info;
  } catch (error) {
    console.error("Failed to send email:", error.message);
    // Do not throw database errors to client
  }
};

export default sendEmail;
