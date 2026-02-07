const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
} = process.env;

// Validate required environment variables
if (!GOOGLE_CLIENT_ID) {
    console.warn('WARNING: GOOGLE_CLIENT_ID is not set in environment variables. Google OAuth will not work.');
}

if (!GOOGLE_CLIENT_SECRET) {
    console.warn('WARNING: GOOGLE_CLIENT_SECRET is not set in environment variables. Google OAuth will not work.');
}

var obj = {
    clientId: GOOGLE_CLIENT_ID || '',
    clientSecret: GOOGLE_CLIENT_SECRET || '',
    redirectUri: GOOGLE_REDIRECT_URI || (process.env.NODE_ENV === 'production' 
        ? 'https://your-domain.com/auth/google/callback'
        : 'http://localhost:3005/auth/google/callback'),
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' '),
};

module.exports = obj;

