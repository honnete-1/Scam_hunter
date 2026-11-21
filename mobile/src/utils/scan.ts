import type { CheckType } from '../types/api';

// Decides what a scanned QR code contains, so it can be sent to the right check.
// Only sorts the content; the backend still validates and analyses it.
export function classifyScannedCode(raw: string): { type: CheckType; content: string } {
  const data = raw.trim();

  // tel:+250788123456
  if (/^tel:/i.test(data)) return { type: 'PHONE', content: data.replace(/^tel:/i, '') };

  // SMSTO:0788123456:message text (a QR that pre-fills an SMS) -> check the message text.
  const sms = data.match(/^smsto?:([^:]*):?(.*)$/i);
  if (sms) return sms[2] ? { type: 'MESSAGE', content: sms[2] } : { type: 'PHONE', content: sms[1] };

  // A link, with or without http(s)://, and no spaces.
  if (/^(https?:\/\/|www\.)\S+$/i.test(data) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(data)) {
    return { type: 'URL', content: data };
  }

  // Mostly digits: a phone number written on a poster or a payment QR.
  if (/^\+?[\d\s().-]{7,20}$/.test(data)) return { type: 'PHONE', content: data };

  return { type: 'MESSAGE', content: data };
}
