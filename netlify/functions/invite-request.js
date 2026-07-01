const { createClient } = require('@supabase/supabase-js')

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

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error. Please try again.' }) }
  }
}
