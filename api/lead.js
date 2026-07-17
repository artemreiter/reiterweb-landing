const TO = 'artem@reiterweb.com';
const FROM = 'ReiterWeb Leads <leads@crm.reiterweb.com>';
const MAX = { site: 300, email: 200, message: 4000 };

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const site = String(body.site || '').trim().slice(0, MAX.site);
  const email = String(body.email || '').trim().slice(0, MAX.email);
  const message = String(body.message || '').trim().slice(0, MAX.message);
  const honeypot = String(body.company || '').trim();

  if (honeypot) return res.status(200).json({ ok: true }); // bot: pretend success, send nothing
  if (!site) return res.status(400).json({ ok: false, error: 'Site is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Enter a valid work email' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('lead: RESEND_API_KEY is not set');
    return res.status(500).json({ ok: false, error: 'Mail service unavailable' });
  }

  const html = [
    '<h2 style="margin:0 0 12px">New audit request — reiterweb.com</h2>',
    `<p><b>Site:</b> ${esc(site)}</p>`,
    `<p><b>Email:</b> ${esc(email)}</p>`,
    message ? `<p><b>What's off:</b><br>${esc(message).replace(/\n/g, '<br>')}</p>` : '<p><i>No message left.</i></p>',
  ].join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: email,
      subject: `Audit request — ${site.replace(/^https?:\/\//, '').slice(0, 80)}`,
      html,
      text: `New audit request\nSite: ${site}\nEmail: ${email}\n\n${message || '(no message)'}`,
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('lead: resend failed', r.status, detail);
    return res.status(502).json({ ok: false, error: 'Could not send right now — email us directly' });
  }

  return res.status(200).json({ ok: true });
};
