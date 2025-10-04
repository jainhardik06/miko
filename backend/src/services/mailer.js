import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let transporter; let resendClient; let modeLogged=false;

function logModeOnce(msg){ if(!modeLogged){ console.log(msg); modeLogged=true; } }

function getResend(){
  if(!resendClient && process.env.RESEND_API_KEY){
    resendClient = new Resend(process.env.RESEND_API_KEY);
    logModeOnce('[mail] Using Resend API');
  }
  return resendClient;
}

export function getMailer(){
  if(!process.env.RESEND_API_KEY){
    if(!transporter){
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT||'587',10),
        secure: false,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });
      logModeOnce('[mail] Using SMTP transport (fallback)');
    }
    return transporter;
  }
  return null; // Resend path
}

export async function sendOtpEmail(to, otp){
  const from = process.env.EMAIL_FROM || 'no-reply@miko.local';
  const subject = 'Your Miko verification code';
  const text = `Your verification code is ${otp}. It expires in 5 minutes.`;
  const html = `<p>Your verification code is <b style="font-size:18px;">${otp}</b>.</p><p>This code expires in 5 minutes.</p>`;
  const resend = getResend();
  if(resend){
    const { data, error } = await resend.emails.send({ from, to, subject, text, html });
    if(error) throw error;
    return data?.id;
  }
  const info = await getMailer().sendMail({ from, to, subject, text, html });
  return info.messageId;
}
