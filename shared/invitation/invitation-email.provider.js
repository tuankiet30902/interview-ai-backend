const nodemailer = require('nodemailer');
const q = require('q');
const BASE_FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3005';

class InvitationEmailProvider {
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
    }

    normalizeEmail(email) {
        if (!email) return '';
        return String(email).trim().toLowerCase();
    }

    sendSpaceInvitation(email, inviterName, spaceName, invitationToken, baseUrl = BASE_FRONTEND_URL) {
        const dfd = q.defer();

        // If email transporter is not configured, skip sending email but don't fail
        if (!this.transporter) {
            console.warn("Email transporter not configured. Skipping invitation email.");
            dfd.resolve({ success: true, skipped: true, message: "Email not configured" });
            return dfd.promise;
        }

        const normalizedEmail = this.normalizeEmail(email);

        if (!normalizedEmail) {
            dfd.reject({
                path: "InvitationEmail.sendSpaceInvitation",
                mes: "Email address is required"
            });
            return dfd.promise;
        }

        const acceptUrl = `${baseUrl}/accept-invitation?token=${invitationToken}&type=space`;

        const mailOptions = {
            from: `"E task" <${process.env.EMAIL_USER || 'noreply@etask.com'}>`,
            to: normalizedEmail,
            subject: `${inviterName} invited you to join "${spaceName}" on ETask`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #dc2626;">You've been invited!</h2>
                    <p>Hello,</p>
                    <p><strong>${inviterName}</strong> has invited you to join the space <strong>"${spaceName}"</strong> on ETask.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${acceptUrl}"
                           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            Accept Invitation
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
                    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${acceptUrl}</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">If you didn't expect this invitation, you can safely ignore this email.</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">© ETask - Task Management System</p>
                </div>
            `
        };

        this.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Invitation email: Failed to send email:', error);
                let errorMessage = "Failed to send invitation email";
                if (error.code === 'EAUTH') {
                    errorMessage = "Email authentication failed. Please check EMAIL_USER and EMAIL_PASSWORD configuration.";
                } else if (error.message) {
                    errorMessage = error.message;
                }
                dfd.reject({
                    path: "InvitationEmail.sendSpaceInvitation",
                    mes: errorMessage
                });
            } else {
                console.log('Invitation email sent:', info.response);
                dfd.resolve({ success: true, messageId: info.messageId });
            }
        });

        return dfd.promise;
    }

    sendProjectInvitation(email, inviterName, projectName, spaceName, invitationToken, baseUrl = (process.env.ADMIN_DOMAIN || 'http://localhost:3005'), taskId = null, taskName = null) {
        const dfd = q.defer();

        const normalizedEmail = this.normalizeEmail(email);

        if (!normalizedEmail) {
            dfd.reject({
                path: "InvitationEmail.sendProjectInvitation",
                mes: "Email address is required"
            });
            return dfd.promise;
        }

        if (!this.transporter) {
            dfd.reject({
                path: "InvitationEmail.sendProjectInvitation",
                mes: "Email service is not configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables."
            });
            return dfd.promise;
        }

        const acceptUrl = `${baseUrl}/accept-invitation?token=${invitationToken}&type=project`;

        // ✅ Nếu có taskId (có hoặc không có taskName), thay đổi nội dung email cho phù hợp
        const hasTaskAssignment = taskId; // Chỉ cần taskId là đủ
        
        let subject, heading, bodyText, buttonText;
        
        if (hasTaskAssignment) {
            // ✅ Email khi mời vào project VÀ giao task
            if (taskName) {
                // Có cả taskId và taskName: hiển thị tên task
                subject = `${inviterName} invited you to join "${projectName}" and assigned you a task on ETask`;
                heading = "You've been invited and assigned a task!";
                bodyText = `<strong>${inviterName}</strong> has invited you to join the project <strong>"${projectName}"</strong>${spaceName ? ` in space "${spaceName}"` : ''} and assigned you the task <strong>"${taskName}"</strong> on ETask.`;
            } else {
                // Chỉ có taskId, không có taskName: vẫn hiển thị "invited and assigned a task"
                subject = `${inviterName} invited you to join "${projectName}" and assigned you a task on ETask`;
                heading = "You've been invited and assigned a task!";
                bodyText = `<strong>${inviterName}</strong> has invited you to join the project <strong>"${projectName}"</strong>${spaceName ? ` in space "${spaceName}"` : ''} and assigned you a task on ETask.`;
            }
            buttonText = "Accept Invitation & View Task";
        } else {
            // ✅ Email khi chỉ invite vào project (không có task assignment)
            subject = `${inviterName} invited you to join "${projectName}" on ETask`;
            heading = "You've been invited!";
            bodyText = `<strong>${inviterName}</strong> has invited you to join the project <strong>"${projectName}"</strong>${spaceName ? ` in space "${spaceName}"` : ''} on ETask.`;
            buttonText = "Accept Invitation";
        }

        const mailOptions = {
            from: `"E task" <${process.env.EMAIL_USER || 'noreply@etask.com'}>`,
            to: normalizedEmail,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #dc2626;">${heading}</h2>
                    <p>Hello,</p>
                    <p>${bodyText}</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${acceptUrl}"
                           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            ${buttonText}
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
                    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${acceptUrl}</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">If you didn't expect this invitation, you can safely ignore this email.</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">© ETask - Task Management System</p>
                </div>
            `
        };

        this.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Invitation email: Failed to send email:', error);
                let errorMessage = "Failed to send invitation email";
                if (error.code === 'EAUTH') {
                    errorMessage = "Email authentication failed. Please check EMAIL_USER and EMAIL_PASSWORD configuration.";
                } else if (error.message) {
                    errorMessage = error.message;
                }
                dfd.reject({
                    path: "InvitationEmail.sendProjectInvitation",
                    mes: errorMessage
                });
            } else {
                console.log('Invitation email sent:', info.response);
                dfd.resolve({ success: true, messageId: info.messageId });
            }
        });

        return dfd.promise;
    }

    sendTenantInvitation(email, inviterName, tenantName, invitationToken, baseUrl = (process.env.ADMIN_DOMAIN || 'http://localhost:3005')) {
        const dfd = q.defer();

        const normalizedEmail = this.normalizeEmail(email);

        if (!normalizedEmail) {
            dfd.reject({
                path: "InvitationEmail.sendTenantInvitation",
                mes: "Email address is required"
            });
            return dfd.promise;
        }

        if (!this.transporter) {
            dfd.reject({
                path: "InvitationEmail.sendTenantInvitation",
                mes: "Email service is not configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables."
            });
            return dfd.promise;
        }

        const acceptUrl = `${baseUrl}/accept-invitation?token=${invitationToken}&type=tenant`;

        const mailOptions = {
            from: `"E task" <${process.env.EMAIL_USER || 'noreply@etask.com'}>`,
            to: normalizedEmail,
            subject: `${inviterName} invited you to join "${tenantName}" on ETask`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #dc2626;">You've been invited!</h2>
                    <p>Hello,</p>
                    <p><strong>${inviterName}</strong> has invited you to join the tenant <strong>"${tenantName}"</strong> on ETask.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${acceptUrl}"
                           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            Accept Invitation
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
                    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${acceptUrl}</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">If you didn't expect this invitation, you can safely ignore this email.</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">© ETask - Task Management System</p>
                </div>
            `
        };

        this.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Invitation email: Failed to send email:', error);
                let errorMessage = "Failed to send invitation email";
                if (error.code === 'EAUTH') {
                    errorMessage = "Email authentication failed. Please check EMAIL_USER and EMAIL_PASSWORD configuration.";
                } else if (error.message) {
                    errorMessage = error.message;
                }
                dfd.reject({
                    path: "InvitationEmail.sendTenantInvitation",
                    mes: errorMessage
                });
            } else {
                console.log('Invitation email sent:', info.response);
                dfd.resolve({ success: true, messageId: info.messageId });
            }
        });

        return dfd.promise;
    }
}

module.exports = new InvitationEmailProvider();


