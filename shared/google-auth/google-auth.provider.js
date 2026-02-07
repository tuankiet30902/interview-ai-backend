const googleAuthConst = require('./google-auth.const');
const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const path = require('path');

class GoogleAuthProvider {
    constructor() {
        this.clientId = googleAuthConst.clientId;
        this.clientSecret = googleAuthConst.clientSecret;
        this.redirectUri = googleAuthConst.redirectUri;
        this.authUrl = googleAuthConst.authUrl;
        this.tokenUrl = googleAuthConst.tokenUrl;
        this.userInfoUrl = googleAuthConst.userInfoUrl;
        this.scope = googleAuthConst.scope;
    }

    /**
     * Generate Google OAuth authorization URL
     * @returns {string} Authorization URL
     */
    getAuthUrl() {
        try {
            if (!this.clientId || this.clientId === '') {
                throw new Error('Google Client ID is not configured. Please set GOOGLE_CLIENT_ID environment variable.');
            }
            if (!this.clientSecret || this.clientSecret === '') {
                throw new Error('Google Client Secret is not configured. Please set GOOGLE_CLIENT_SECRET environment variable.');
            }
            if (!this.redirectUri || this.redirectUri === '') {
                throw new Error('Google Redirect URI is not configured. Please set GOOGLE_REDIRECT_URI environment variable.');
            }

            const params = {
                client_id: this.clientId,
                redirect_uri: this.redirectUri,
                response_type: 'code',
                scope: this.scope,
                access_type: 'offline',
                prompt: 'consent',
            };

            const queryString = qs.stringify(params);
            const authUrl = `${this.authUrl}?${queryString}`;

            return authUrl;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Exchange authorization code for access token
     * @param {string} code - Authorization code from Google
     * @returns {Promise<Object>} Token response with access_token, refresh_token, etc.
     */
    async getTokenFromCode(code) {
        try {
            // Validate configuration
            if (!this.clientId || this.clientId === '') {
                throw new Error('Google Client ID is not configured. Please set GOOGLE_CLIENT_ID environment variable.');
            }
            if (!this.clientSecret || this.clientSecret === '') {
                throw new Error('Google Client Secret is not configured. Please set GOOGLE_CLIENT_SECRET environment variable.');
            }
            if (!this.redirectUri || this.redirectUri === '') {
                throw new Error('Google Redirect URI is not configured. Please set GOOGLE_REDIRECT_URI environment variable.');
            }
            if (!code || code === '') {
                throw new Error('Authorization code is required.');
            }

            const params = {
                code: code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri,
                grant_type: 'authorization_code',
            };

            const response = await axios.post(this.tokenUrl, qs.stringify(params), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 30000, // 30 seconds timeout
            });

            if (response.data.error) {
                const errorMsg = response.data.error_description || response.data.error;
                if (response.data.error === 'invalid_grant') {
                    throw new Error('Invalid authorization code. The code may have expired or already been used. Please try logging in again.');
                }
                throw new Error(errorMsg);
            }

            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('Request to Google OAuth timed out. Please try again.');
            }
            throw error;
        }
    }

    /**
     * Get user information from Google using access token
     * @param {string} accessToken - Google access token
     * @returns {Promise<Object>} User information (id, email, name, picture, etc.)
     */
    async getUserInfo(accessToken) {
        try {
            const response = await axios.get(this.userInfoUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            return {
                id: response.data.id,
                email: response.data.email,
                name: response.data.name,
                picture: response.data.picture,
                verified_email: response.data.verified_email,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Complete Google OAuth flow: get token and user info
     * @param {string} code - Authorization code from Google
     * @returns {Promise<Object>} User information and tokens
     */
    async authenticate(code) {
        try {
            // Step 1: Exchange code for token
            const tokenData = await this.getTokenFromCode(code);

            // Step 2: Get user info using access token
            const userInfo = await this.getUserInfo(tokenData.access_token);

            return {
                user: userInfo,
                tokens: {
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_in: tokenData.expires_in,
                    token_type: tokenData.token_type,
                },
            };
        } catch (error) {
            console.error('Error in Google authentication:', error);

            // Log detailed error to file for debugging
            try {
                const logPath = path.join(process.cwd(), 'google_auth_error.log');
                const timestamp = new Date().toISOString();
                let errorDetails = error.message;

                if (error.response && error.response.data) {
                    errorDetails = `Status: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`;
                } else if (error.code) {
                    errorDetails = `Code: ${error.code} - ${error.message}`;
                }

                fs.appendFileSync(logPath, `[${timestamp}] ${errorDetails}\n`);
            } catch (logErr) {
                console.error('Failed to write to log file:', logErr);
            }

            throw error;
        }
    }
}

exports.GoogleAuthProvider = new GoogleAuthProvider();

