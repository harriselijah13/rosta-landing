exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  try {
    const { fullName, email, url, whatBuilding } = JSON.parse(event.body || '{}');

    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Valid email required.' }) };
    }

    const nameParts = (fullName || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ');

    const loopsPayload = {
      email,
      firstName,
      lastName,
      userGroup:  'invite-request',
      source:     'landing-page',
      subscribed: true,
    };

    // Optional fields — only sent when present (must be defined as custom props in Loops)
    if (url)          loopsPayload.url          = url;
    if (whatBuilding) loopsPayload.whatBuilding = whatBuilding;

    const response = await fetch('https://app.loops.so/api/v1/contacts/create', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
      },
      body: JSON.stringify(loopsPayload),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    const msg = (data.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('exists')) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, existing: true }) };
    }

    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify({ message: data.message || 'Error submitting request.' }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Server error.', error: err.message }),
    };
  }
};
