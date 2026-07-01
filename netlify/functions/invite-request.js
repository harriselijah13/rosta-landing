const https = require('https')
const { createClient } = require('@supabase/supabase-js')

async function notifyHarris({ full_name, email, url, what_building, city, knows_member, member_name }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notify] RESEND_API_KEY not set — skipping notification')
    return
  }

  const knowsLine =
    knows_member === true
      ? member_name ? `Yes: ${member_name}` : 'Yes'
      : knows_member === false ? 'No'
      : 'Not shared'

  const sans = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  const serif = "'Fraunces',Georgia,'Times New Roman',serif"

  const row = (label, value) =>
    `<tr>
      <td style="font-size:13px;color:#6B7280;padding:4px 16px 4px 0;white-space:nowrap;vertical-align:top;font-family:${sans};">${label}</td>
      <td style="font-size:13px;color:#0F1B3C;padding:4px 0;font-family:${sans};">${value}</td>
    </tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700&family=Plus+Jakarta+Sans:wght@400;600&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#F5F2EE;">
  <div style="font-family:${sans};max-width:480px;margin:0 auto;padding:48px 24px;background:#F5F2EE;">
    <p style="font-size:22px;font-weight:700;color:#0F1B3C;margin:0 0 4px;font-family:${serif};">ROSTA<span style="color:#C8F53C;">.</span></p>
    <hr style="border:none;border-top:1px solid #E5E1DB;margin:20px 0 32px;"/>
    <h1 style="font-size:20px;color:#0F1B3C;margin:0 0 12px;font-weight:700;font-family:${serif};">New invite request</h1>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px;font-family:${sans};">${full_name} just requested an invite to ROSTA.</p>
    <table style="border-collapse:collapse;margin:0 0 24px;">
      ${row('Email', email)}
      ${row('City', city || 'not shared')}
      ${row('URL', url || 'not shared')}
      ${row('Knows a member', knowsLine)}
    </table>
    <p style="font-size:13px;color:#6B7280;margin:0 0 8px;font-family:${sans};">What they&rsquo;re building:</p>
    <blockquote style="border-left:3px solid #C8F53C;margin:0 0 28px;padding:10px 14px;background:#fff;border-radius:0 8px 8px 0;color:#0F1B3C;font-size:14px;line-height:1.55;font-family:${sans};">&ldquo;${what_building}&rdquo;</blockquote>
    <a href="https://app.onrosta.com/admin/invite-requests" style="display:inline-block;background:#0F1B3C;color:#ffffff;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:600;font-size:14px;font-family:${sans};">Review request</a>
    <p style="color:#6B7280;font-size:12px;margin-top:32px;font-family:${sans};">ROSTA Admin &middot; onrosta.com</p>
  </div>
</body>
</html>`

  await new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: 'ROSTA <hello@onrosta.com>',
      to: ['harris@onrosta.com'],
      subject: `New ROSTA invite request from ${full_name}`,
      html,
    })
    const req = https.request(
      {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data)
          else reject(new Error(`Resend ${res.statusCode}: ${data}`))
        })
      },
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const {
      full_name,
      email,
      url,
      what_building,
      city,
      knows_member,
      member_name,
    } = JSON.parse(event.body || '{}')

    // Validate required fields
    if (!full_name || !full_name.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Full name is required.' }) }
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid email is required.' }) }
    }
    if (!what_building || !what_building.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please tell us what you are building.' }) }
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabase.from('invite_requests').insert({
      full_name:    full_name.trim(),
      email:        email.trim().toLowerCase(),
      url:          url ? url.trim() : null,
      what_building: what_building.trim(),
      city:         city ? city.trim() : null,
      knows_member: knows_member === true || knows_member === 'true' ? true
                  : knows_member === false || knows_member === 'false' ? false
                  : null,
      member_name:  member_name ? member_name.trim() : null,
    })

    if (error) {
      console.error('Supabase insert error:', error)
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not save your request. Please try again.' }) }
    }

    // Notify Harris — awaited so the process doesn't exit before fetch completes.
    // Error is caught so a Resend failure never affects the 200 response.
    try {
      await notifyHarris({
        full_name:    full_name.trim(),
        email:        email.trim().toLowerCase(),
        url:          url ? url.trim() : null,
        what_building: what_building.trim(),
        city:         city ? city.trim() : null,
        knows_member: knows_member === true || knows_member === 'true' ? true
                    : knows_member === false || knows_member === 'false' ? false
                    : null,
        member_name:  member_name ? member_name.trim() : null,
      })
    } catch (notifyErr) {
      console.error('[notify] Resend error:', notifyErr.message)
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error. Please try again.', _debug: err && err.message }) }
  }
}
