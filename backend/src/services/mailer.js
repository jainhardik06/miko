import { Resend } from 'resend';

// Single Resend client instance
let resendClient;

function getClient(){
  if(!process.env.RESEND_API_KEY){
    throw new Error('RESEND_API_KEY not configured');
  }
  if(!resendClient){
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('[mail] Resend client initialized');
  }
  return resendClient;
}

/**
 * Send OTP verification email via Resend.
 * @param {string} to Recipient email
 * @param {string} otp The one-time password code
 * @returns {Promise<string|undefined>} Resend message ID
 */
export async function sendOtpEmail(to, otp){
  let from = process.env.EMAIL_FROM || 'no-reply@miko.local';
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)){
    throw new Error('Invalid recipient email');
  }
  const subject = 'Your Miko verification code';
  const minutes = Math.floor((parseInt(process.env.OTP_TTL_MS||'300000',10))/60000);
  const text = `Your verification code is ${otp}. It expires in ${minutes} minute${minutes!==1?'s':''}.`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111">\r\n  <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;">Your verification code</h2>\r\n  <p style="margin:0 0 16px;">Use the code below to continue signing in to <strong>Miko</strong>:</p>\r\n  <p style="font-size:32px;letter-spacing:4px;font-weight:700;margin:0 0 16px;">${otp}</p>\r\n  <p style="font-size:12px;color:#555;margin:0 0 24px;">This code expires in ${minutes} minute${minutes!==1?'s':''}. If you did not request it you can ignore this email.</p>\r\n  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />\r\n  <p style="font-size:11px;color:#999;margin:0;">Sent securely via Resend • Do not share this code.</p>\r\n</body></html>`;
  const client = getClient();
  let { data, error } = await client.emails.send({ from, to, subject, text, html });
  if(error){
    const domainUnverified = typeof error?.message === 'string' && /domain is not verified/i.test(error.message);
    const sandboxOk = process.env.RESEND_SANDBOX_FALLBACK === 'true';
    if(domainUnverified && sandboxOk){
      console.warn('[mail] Domain unverified. Falling back to sandbox sender onboarding@resend.dev');
      from = 'Acme <onboarding@resend.dev>';
      ({ data, error } = await client.emails.send({ from, to, subject, text, html }));
    }
  }
  if(error){
    console.error('[mail][error]', error);
    throw new Error('Failed to send verification email');
  }
  return data?.id;
}
