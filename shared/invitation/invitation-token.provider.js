const crypto = require('crypto');
const q = require('q');
const { MongoDBProvider } = require('../mongodb/db.provider');

class InvitationTokenProvider {
    constructor() {
        // ✅ FIX: Store invitation tokens in database instead of memory
        // This fixes the issue where tokens are lost on server restart or in multi-instance environments
        this.collection = 'invitation';
        this.dbname_prefix = ''; // Use empty prefix for global invitations (not tenant-specific)
    }

    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    createInvitation(type, resourceId, email, inviterUsername, role = 'member', dbname_prefix = '') {
        const dfd = q.defer();

        if (!type || !resourceId || !email || !inviterUsername) {
            dfd.reject({
                path: "InvitationToken.createInvitation.InvalidParams",
                mes: "Type, resourceId, email, and inviterUsername are required"
            });
            return dfd.promise;
        }

        const token = this.generateToken();
        const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

        const invitation = {
            token: token,
            type: type, // 'space' or 'tenant'
            resourceId: resourceId,
            email: email.toLowerCase().trim(),
            inviterUsername: inviterUsername,
            role: role,
            dbname_prefix: dbname_prefix, // ✅ Lưu dbname_prefix để dùng sau
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: expiresAt
        };

        // ✅ FIX: Save to database instead of memory
        MongoDBProvider.insertMain(
            this.dbname_prefix,
            this.collection,
            'system',
            invitation,
            {}
        ).then(function (result) {
            // Cleanup expired invitations periodically (background task)
            // Don't wait for cleanup to complete
            dfd.resolve(invitation);
        }, function (err) {
            console.error('[InvitationTokenProvider.createInvitation] Error saving invitation to database:', err);
            dfd.reject({
                path: "InvitationToken.createInvitation.DatabaseError",
                mes: "Failed to save invitation"
            });
        });

        return dfd.promise;
    }

    getInvitation(token) {
        const dfd = q.defer();

        if (!token) {
            dfd.reject({
                path: "InvitationToken.getInvitation.InvalidToken",
                mes: "Token is required"
            });
            return dfd.promise;
        }

        // ✅ FIX: Load from database instead of memory
        MongoDBProvider.getOneMain(
            this.dbname_prefix,
            this.collection,
            { token: { $eq: token } }
        ).then(function (invitation) {
            if (!invitation) {
                dfd.reject({
                    path: "InvitationToken.getInvitation.InvitationNotFound",
                    mes: "Invitation not found or expired"
                });
                return;
            }

            // Check expiration
            if (Date.now() > invitation.expiresAt) {
                // Delete expired invitation (background task, don't wait)
                const self = this;
                MongoDBProvider.deleteMain(
                    self.dbname_prefix,
                    self.collection,
                    'system',
                    { token: { $eq: token } },
                    {}
                ).catch(function (err) {
                    console.warn('[InvitationTokenProvider.getInvitation] Failed to delete expired invitation:', err);
                });

                dfd.reject({
                    path: "InvitationToken.getInvitation.InvitationExpired",
                    mes: "Invitation has expired"
                });
                return;
            }

            // Check status
            if (invitation.status !== 'pending') {
                dfd.reject({
                    path: "InvitationToken.getInvitation.InvitationAlreadyUsed",
                    mes: "Invitation has already been used"
                });
                return;
            }

            dfd.resolve(invitation);
        }, function (err) {
            console.error('[InvitationTokenProvider.getInvitation] Error loading invitation from database:', err);
            dfd.reject({
                path: "InvitationToken.getInvitation.InvitationNotFound",
                mes: "Invitation not found or expired"
            });
        });

        return dfd.promise;
    }

    // ✅ Get invitation without status check (for displaying invitation details)
    // This allows getInvitationDetails to show invitation info even if it's already been accepted
    getInvitationWithoutStatusCheck(token) {
        const dfd = q.defer();

        if (!token) {
            dfd.reject({
                path: "InvitationToken.getInvitationWithoutStatusCheck.InvalidToken",
                mes: "Token is required"
            });
            return dfd.promise;
        }

        // Load from database without checking status
        MongoDBProvider.getOneMain(
            this.dbname_prefix,
            this.collection,
            { token: { $eq: token } }
        ).then(function (invitation) {
            if (!invitation) {
                dfd.reject({
                    path: "InvitationToken.getInvitationWithoutStatusCheck.InvitationNotFound",
                    mes: "Invitation not found or expired"
                });
                return;
            }

            // Only check expiration, not status
            if (Date.now() > invitation.expiresAt) {
                dfd.reject({
                    path: "InvitationToken.getInvitationWithoutStatusCheck.InvitationExpired",
                    mes: "Invitation has expired"
                });
                return;
            }

            dfd.resolve(invitation);
        }, function (err) {
            console.error('[InvitationTokenProvider.getInvitationWithoutStatusCheck] Error loading invitation from database:', err);
            dfd.reject({
                path: "InvitationToken.getInvitationWithoutStatusCheck.InvitationNotFound",
                mes: "Invitation not found or expired"
            });
        });

        return dfd.promise;
    }

    markInvitationAsAccepted(token) {
        // ✅ FIX: Update in database instead of memory
        const updateData = {
            status: 'accepted',
            acceptedAt: Date.now()
        };
        return MongoDBProvider.updateMain(
            this.dbname_prefix,
            this.collection,
            'system',
            { token: { $eq: token } },
            { $set: updateData },
            {}
        ).catch(function (err) {
            console.error('[InvitationTokenProvider.markInvitationAsAccepted] Error updating invitation:', err);
        });
    }

    markInvitationAsRejected(token) {
        // ✅ FIX: Update in database instead of memory
        const updateData = {
            status: 'rejected',
            rejectedAt: Date.now()
        };
        return MongoDBProvider.updateMain(
            this.dbname_prefix,
            this.collection,
            'system',
            { token: { $eq: token } },
            { $set: updateData },
            {}
        ).catch(function (err) {
            console.error('[InvitationTokenProvider.markInvitationAsRejected] Error updating invitation:', err);
        });
    }

    cleanupExpiredInvitations() {
        // ✅ FIX: Cleanup from database (background task, don't wait)
        const now = Date.now();
        MongoDBProvider.deleteMain(
            this.dbname_prefix,
            this.collection,
            'system',
            { expiresAt: { $lt: now } },
            {}
        ).catch(function (err) {
            console.warn('[InvitationTokenProvider.cleanupExpiredInvitations] Error cleaning up expired invitations:', err);
        });
    }

    // Get invitation by email and resourceId (for checking if user already has pending invitation)
    findPendingInvitationByEmailAndResource(type, resourceId, email) {
        const dfd = q.defer();
        const normalizedEmail = email.toLowerCase().trim();
        const now = Date.now();

        // ✅ FIX: Query from database instead of memory
        MongoDBProvider.loadMain(
            this.dbname_prefix,
            this.collection,
            {
                type: { $eq: type },
                resourceId: { $eq: resourceId },
                email: { $eq: normalizedEmail },
                status: { $eq: 'pending' },
                expiresAt: { $gt: now }
            },
            1,
            0
        ).then(function (invitations) {
            if (invitations && invitations.length > 0) {
                dfd.resolve(invitations[0]);
            } else {
                dfd.resolve(null);
            }
        }, function (err) {
            console.error('[InvitationTokenProvider.findPendingInvitationByEmailAndResource] Error querying invitations:', err);
            dfd.resolve(null); // Return null on error (don't block invitation creation)
        });

        return dfd.promise;
    }
}

module.exports = new InvitationTokenProvider();





























