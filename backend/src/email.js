import { query } from './db.js';

const RESEND_URL = 'https://api.resend.com/emails';
const configured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function providerSend({ to, subject, html, text }) {
  if (!configured()) return { skipped: true };
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return { id: data.id || null };
      lastError = new Error(data.message || `Email provider returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await sleep(400 * (attempt + 1));
  }
  throw lastError;
}

export async function sendTransactional({ eventKey, to, type, subject, html, text }) {
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) return { skipped: true, reason: 'invalid-recipient' };
  const inserted = await query(`INSERT INTO email_notifications (event_key,recipient_email,notification_type,subject) VALUES ($1,$2,$3,$4) ON CONFLICT (event_key) DO NOTHING RETURNING id`, [eventKey, to, type, subject]);
  if (!inserted.rows[0]) return { skipped: true, reason: 'already-processed' };
  const id = inserted.rows[0].id;
  if (!configured()) {
    await query(`UPDATE email_notifications SET status='skipped', error_message=$2 WHERE id=$1`, [id, 'Email provider is not configured.']);
    return { skipped: true, reason: 'not-configured' };
  }
  try {
    const result = await providerSend({ to, subject, html, text });
    await query(`UPDATE email_notifications SET status='sent', provider_id=$2, sent_at=NOW() WHERE id=$1`, [id, result.id]);
    return { sent: true, providerId: result.id };
  } catch (error) {
    await query(`UPDATE email_notifications SET status='failed', error_message=$2 WHERE id=$1`, [id, String(error?.message || error).slice(0, 1000)]);
    return { sent: false, error: String(error?.message || error) };
  }
}

export function shipmentStatusEmail({ trackingNumber, recipientName, status, location, note }) {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title = status.replaceAll('_', ' ');
  return {
    subject: `Starling Courier update — ${trackingNumber}`,
    text: `Hello ${recipientName || 'Customer'},\n\nYour shipment ${trackingNumber} is now ${title}.${location ? ` Location: ${location}.` : ''}${note ? ` Note: ${note}` : ''}\n\nStarling Courier Service`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Shipment update</h2><p>Hello ${safe(recipientName || 'Customer')},</p><p>Your shipment <strong>${safe(trackingNumber)}</strong> is now <strong>${safe(title)}</strong>.</p>${location ? `<p><strong>Location:</strong> ${safe(location)}</p>` : ''}${note ? `<p><strong>Note:</strong> ${safe(note)}</p>` : ''}<p>Starling Courier Service</p></div>`
  };
}
