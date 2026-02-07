const nodemailer = require('nodemailer');
const q = require('q');

const DEFAULT_BASE_URL = process.env.FRONTEND_URL|| process.env.ADMIN_DOMAIN;

class TaskEmailProvider {
  constructor() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      this.transporter = null;
    } else {
      this.transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }

  normalizeEmail(email) {
    if (!email) return '';
    return String(email).trim().toLowerCase();
  }

  sendTaskAssignmentEmail({
    toEmail,
    assigneeName,
    assignerName,
    taskName,
    projectName,
    dueDate,
    taskUrl,
    baseUrl = DEFAULT_BASE_URL,
  }) {
    const dfd = q.defer();

    const normalizedEmail = this.normalizeEmail(toEmail);

    if (!normalizedEmail) {
      dfd.reject({
        path: 'TaskEmailProvider.sendTaskAssignmentEmail',
        mes: 'Email address is required',
      });
      return dfd.promise;
    }

    if (!this.transporter) {
      dfd.reject({
        path: 'TaskEmailProvider.sendTaskAssignmentEmail',
        mes: 'Email service is not configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables.',
      });
      return dfd.promise;
    }

    const formattedDueDate = dueDate
      ? new Date(dueDate).toLocaleString()
      : 'No due date';

    const assignmentUrl = taskUrl || baseUrl;

    const mailOptions = {
      from: `"E task" <${process.env.EMAIL_USER || 'noreply@etask.com'}>`,
      to: normalizedEmail,
      subject: `${assignerName || 'Someone'} assigned a task to you on ETask`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed;">New task assignment</h2>
          <p>Hi ${assigneeName || 'there'},</p>
          <p><strong>${assignerName || 'A teammate'}</strong> just assigned you a task:</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #f9fafb;">
            <p style="margin: 0; font-size: 16px;"><strong>${taskName || 'Untitled task'}</strong></p>
            ${projectName ? `<p style="margin: 8px 0 0; color: #6b7280;">Project: ${projectName}</p>` : ''}
            <p style="margin: 8px 0 0; color: #6b7280;">Due date: ${formattedDueDate}</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${assignmentUrl}"
               style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
              View task
            </a>
          </div>
          <p style="color: #6b7280; font-size: 12px;">Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${assignmentUrl}</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Thank you for using ETask.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">© ${new Date().getFullYear()} ETask</p>
        </div>
      `,
    };

    this.transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('TaskAssignmentEmail: Failed to send email:', error);
        let errorMessage = 'Failed to send task assignment email';
        if (error.code === 'EAUTH') {
          errorMessage = 'Email authentication failed. Please check EMAIL_USER and EMAIL_PASSWORD configuration.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        dfd.reject({
          path: 'TaskEmailProvider.sendTaskAssignmentEmail',
          mes: errorMessage,
        });
      } else {
        dfd.resolve({ success: true, messageId: info.messageId });
      }
    });

    return dfd.promise;
  }

  /**
   * Send email notifying a user that they were mentioned in a comment.
   * @param {Object} payload
   * @param {string} payload.toEmail
   * @param {string} payload.mentionerName
   * @param {string} payload.mentionedName
   * @param {string} payload.taskName
   * @param {string} [payload.projectName]
   * @param {string} [payload.commentSnippet]
   * @param {string} [payload.taskUrl]
   * @param {string} [payload.baseUrl]
   */
  sendMentionEmail({
    toEmail,
    mentionerName,
    mentionedName,
    taskName,
    projectName,
    commentSnippet,
    taskUrl,
    baseUrl = DEFAULT_BASE_URL,
  }) {
    const dfd = q.defer();
    const normalizedEmail = this.normalizeEmail(toEmail);

    if (!normalizedEmail) {
      dfd.reject({
        path: 'TaskEmailProvider.sendMentionEmail',
        mes: 'Email address is required',
      });
      return dfd.promise;
    }

    if (!this.transporter) {
      dfd.reject({
        path: 'TaskEmailProvider.sendMentionEmail',
        mes: 'Email service is not configured. Please set EMAIL_USER and EMAIL_PASSWORD environment variables.',
      });
      return dfd.promise;
    }

    const mentionUrl = taskUrl || baseUrl;
    const safeSnippet = (commentSnippet || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const mailOptions = {
      from: `"E task" <${process.env.EMAIL_USER || 'noreply@etask.com'}>`,
      to: normalizedEmail,
      subject: `${mentionerName || 'A teammate'} mentioned you on ETask`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed;">You were mentioned in a comment</h2>
          <p>Hi ${mentionedName || 'there'},</p>
          <p><strong>${mentionerName || 'A teammate'}</strong> mentioned you in a comment${projectName ? ` on project <strong>${projectName}</strong>` : ''}:</p>
          <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #f9fafb; color: #374151;">
            ${safeSnippet ? `<p style="margin: 0; white-space: pre-line;">${safeSnippet}</p>` : '<p style="margin: 0;">(No additional comment text)</p>'}
          </div>
          <div style="margin-top: 16px;">
            <p style="margin: 0; color: #6b7280;">Task: <strong>${taskName || 'Untitled task'}</strong></p>
            ${projectName ? `<p style="margin: 4px 0 0; color: #6b7280;">Project: <strong>${projectName}</strong></p>` : ''}
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${mentionUrl}"
               style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
              View comment
            </a>
          </div>
          <p style="color: #6b7280; font-size: 12px;">Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${mentionUrl}</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Thank you for using ETask.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">© ${new Date().getFullYear()} ETask</p>
        </div>
      `,
    };

    this.transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('TaskMentionEmail: Failed to send email:', error);
        let errorMessage = 'Failed to send mention email';
        if (error.code === 'EAUTH') {
          errorMessage = 'Email authentication failed. Please check EMAIL_USER and EMAIL_PASSWORD configuration.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        dfd.reject({
          path: 'TaskEmailProvider.sendMentionEmail',
          mes: errorMessage,
        });
      } else {
        dfd.resolve({ success: true, messageId: info.messageId });
      }
    });

    return dfd.promise;
  }
}

exports.TaskEmailProvider = new TaskEmailProvider();























