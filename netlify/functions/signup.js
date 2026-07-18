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
