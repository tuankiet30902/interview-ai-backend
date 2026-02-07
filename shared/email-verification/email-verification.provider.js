const nodemailer = require('nodemailer');
const q = require('q');

class EmailVerificationProvider {
    constructor() {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            this.transporter = null;
        } else {
            this.transporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE || 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            });
        }

        this.verificationCodes = new Map();
    }

    generateCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    normalizeEmail(email) {
        if (!email) return '';
        return String(email).trim().toLowerCase();
    }

    normalizeCode(code) {
        if (!code) return '';
        return String(code).trim();
    }

    sendVerificationCode(email, name = 'User') {
        const dfd = q.defer();

        const normalizedEmail = this.normalizeEmail(email);

        if (!normalizedEmail) {
            dfd.reject({
                path: "EmailVerification.sendCode",
                mes: "Email address is required"
            });
            return dfd.promise;
        }

        if (!this.transporter) {
            dfd.reject({
                path: "EmailVerification.sendCode",
                mes: "Email service is not configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables."
            });
            return dfd.promise;
        }

        const code = this.generateCode();

        this.verificationCodes.set(normalizedEmail, {
            code: code,
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        const mailOptions = {
            from: `"E task" <${process.env.EMAIL_USER || 'noreply@etask.com'}>`,
            to: normalizedEmail,
            subject: 'ETask Email Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc2626;">ETask Email Verification</h2>
                    <p>Hello ${name},</p>
                    <p>Your verification code is:</p>
                    <div style="background: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <h1 style="color: #dc2626; font-size: 32px; margin: 0; letter-spacing: 8px;">${code}</h1>
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">© ETask - Task Management System</p>
                </div>
            `
        };

        this.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Email verification: Failed to send email:', error);

                let errorMessage = "Failed to send verification email";
                if (error.code === 'EAUTH' && error.responseCode === 534) {
                    errorMessage = "Email service requires App Password. Please configure EMAIL_PASSWORD with a Gmail App Password.";
                } else if (error.code === 'EAUTH' && error.responseCode === 535) {
                    errorMessage = "Invalid email credentials. Please check: 1) EMAIL_PASSWORD must be a 16-character App Password (no spaces), 2) App Password is correct, 3) 2-Step Verification is enabled.";
                } else if (error.code === 'EAUTH') {
                    errorMessage = "Email authentication failed. Please check EMAIL_USER and EMAIL_PASSWORD configuration.";
                } else if (error.message) {
                    errorMessage = error.message;
                }

                dfd.reject({
                    path: "EmailVerification.sendCode",
                    mes: errorMessage
                });
            } else {
                dfd.resolve(code);
            }
        });

        return dfd.promise;
    }

    verifyCode(email, code) {
        const dfd = q.defer();

        const normalizedEmail = this.normalizeEmail(email);
        const normalizedCode = this.normalizeCode(code);

        if (!normalizedEmail) {
            dfd.reject({
                path: "EmailVerification.verifyCode",
                mes: "Email address is required"
            });
            return dfd.promise;
        }

        if (!normalizedCode || normalizedCode.length !== 4) {
            dfd.reject({
                path: "EmailVerification.verifyCode",
                mes: "Verification code must be 4 digits"
            });
            return dfd.promise;
        }

        const stored = this.verificationCodes.get(normalizedEmail);

        if (!stored) {
            dfd.reject({
                path: "EmailVerification.verifyCode",
                mes: "No verification code found for this email. Please request a new code."
            });
            return dfd.promise;
        }

        if (Date.now() > stored.expiresAt) {
            this.verificationCodes.delete(normalizedEmail);
            dfd.reject({
                path: "EmailVerification.verifyCode",
                mes: "Verification code has expired. Please request a new code."
            });
            return dfd.promise;
        }

        const normalizedStoredCode = this.normalizeCode(stored.code);

        if (normalizedStoredCode !== normalizedCode) {
            dfd.reject({
                path: "EmailVerification.verifyCode",
                mes: "Invalid verification code. Please check and try again."
            });
            return dfd.promise;
        }

        this.verificationCodes.delete(normalizedEmail);
        dfd.resolve(true);

        return dfd.promise;
    }

    cleanupExpiredCodes() {
        const now = Date.now();
        for (const [email, data] of this.verificationCodes.entries()) {
            if (now > data.expiresAt) {
                this.verificationCodes.delete(email);
            }
        }
    }
}

module.exports = new EmailVerificationProvider();
