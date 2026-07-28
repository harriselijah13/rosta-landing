const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
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
    const { email, password } = JSON.parse(event.body || '{}')

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid email address is required.' }) }
    }
    if (!password || password.length < 8) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password must be at least 8 characters.' }) }
    }

    // Rate limit: 5 attempts per IP per hour
    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'
    const rlRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/check_signup_rate_limit`, {
      method: 'POST',
      headers: {
        'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ _ip: ip, _max_attempts: 5, _window_minutes: 60 }),
    })
    const allowed = await rlRes.json().catch(() => true)
    if (!allowed) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many signup attempts. Try again later.' }) }
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabase.auth.signUp({
      email:   email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: 'https://app.onrosta.com/auth/callback' },
    })

    if (error) {
      console.error('[signup] Supabase error:', error.message)
      return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('[signup] Unexpected error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error. Please try again.' }) }
  }
}
