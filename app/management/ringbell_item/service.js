const { MongoDBProvider } = require('../../../shared/mongodb/db.provider');
const q = require('q');
const { SocketProvider } = require('./../../../shared/socket/provider');

const NOTIFICATION_MESSAGES = {
    'task_assigned': {
        title: 'Task Assigned',
        getBody: (params) => `You have been assigned to task: ${params.taskName || params.title || params.task_name || 'a task'}`
    },
    'task_invited': {
        title: 'Task Assignment Invitation',
        getBody: (params) => `${params.assignedBy || params.invitedBy || params.addedBy || 'Someone'} assigned you to task "${params.taskName || params.title || 'a task'}" in project "${params.projectName || params.project_name || 'a project'}"`
    },
    'task_assignment_accepted': {
        title: 'Task Assignment Accepted',
        getBody: (params) => `${params.acceptedBy || params.userName || 'Someone'} has accepted task assignment: "${params.taskName || params.title || 'a task'}" in project "${params.projectName || params.project_name || 'a project'}"`
    },
    'task_updated': {
        title: 'Task Updated',
        getBody: (params) => `Task "${params.taskName || params.title || params.task_name || ''}" has been updated`
    },
    'task_commented': {
        title: 'New Comment',
        getBody: (params) => `${params.from_user || params.fromUser || 'Someone'} commented on task: ${params.taskName || params.title || params.task_name || ''}`
    },
    'task_completed': {
        title: 'Task Completed',
        getBody: (params) => `Task "${params.taskName || params.title || params.task_name || ''}" has been marked as complete`
    },
    'task_due_soon': {
        title: 'Task Due Soon',
        getBody: (params) => `Task "${params.taskName || params.title || params.task_name || ''}" is due soon`
    },
    'space_invited': {
        title: 'Space Invitation',
        getBody: (params) => `${params.invitedBy || params.inviterName || params.addedBy || 'Someone'} invited you to space: ${params.spaceName || params.space_name || params.title || 'a space'}`
    },
    'space_invitation_accepted': {
        title: 'Space Invitation Accepted',
        getBody: (params) => `${params.acceptedBy || params.userName || 'Someone'} has joined space: ${params.spaceName || params.space_name || params.title || 'a space'}`
    },
    'space_removed': {
        title: 'Removed from Space',
        getBody: (params) => `You have been removed from space: ${params.spaceName || params.space_name || params.title || 'a space'}`
    },
    'space_member_added': {
        title: 'Added to Space',
        getBody: (params) => `${params.addedBy || 'Someone'} added you to space: ${params.spaceName || params.space_name || params.title || 'a space'}`
    },
    'project_invited': {
        title: 'Project Invitation',
        getBody: (params) => `${params.invitedBy || params.addedBy || 'Someone'} invited you to project: ${params.projectName || params.project_name || params.title || 'a project'}`
    },
    'project_member_added': {
        title: 'Added to Project',
        getBody: (params) => `${params.addedBy || 'Someone'} added you to project: ${params.projectName || params.project_name || params.title || 'a project'}`
    },
    'project_invitation_accepted': {
        title: 'Invitation Accepted',
        getBody: (params) => `${params.acceptedBy || params.userName || 'Someone'} has joined project: ${params.projectName || params.project_name || params.title || 'a project'}`
    },
    'mention': {
        title: 'Mentioned',
        getBody: (params) => `${params.from_user || params.fromUser || 'Someone'} mentioned you in ${params.taskName || params.title || 'a comment'}`
    },
    'tenant_invited': {
        title: 'Workspace Invitation',
        getBody: (params) => `You have been invited to workspace: ${params.tenantName || 'a workspace'}`
    },
    'default': {
        title: 'E Task',
        getBody: (params) => params.message || 'You have a new notification'
    }
};

class RingBellItemService {
    constructor() { }

    loadList(dbname_prefix, username, filter, top, offset) {
        return MongoDBProvider.loadMain(dbname_prefix,
            "ringbell_item",
            filter,
            top, offset,
            { seen: 1, notify_time: -1 },
            {
                _id: true, key_map: true, params: true,
                seen: { $elemMatch: { $eq: username } }, action: true, notify_time: true
            });
    }

    countList(dbname_prefix, username) {
        return MongoDBProvider.countMain(dbname_prefix,
            "ringbell_item",
            {
                $and: [{
                    to_username: { $eq: username }
                }, {
                    seen: { $nin: [username] }
                }]
            });
    }

    countAll(dbname_prefix, filter) {
        return MongoDBProvider.countMain(dbname_prefix,
            "ringbell_item",
            filter);
    }

    // ✅ Check if duplicate notification exists (same action, same user, same project/space within time window)
    // ✅ Only check for UNREAD notifications within a short time window (5 minutes) to avoid blocking legitimate re-adds
    checkDuplicateNotification(dbname_prefix, action, params, to_username, timeWindowMs = 300000) {
        // timeWindowMs: default 5 minutes (300000ms) - chỉ check notification gần đây và chưa đọc
        const dfd = q.defer();
        const toUsernameArray = Array.isArray(to_username) ? to_username : (to_username ? [to_username] : []);
        
        if (!toUsernameArray.length || !params) {
            dfd.resolve(false); // No duplicate if no target user or params
            return dfd.promise;
        }

        // Build filter to check for duplicate
        const filter = {
            action: action,
            to_username: { $in: toUsernameArray }
        };

        // For project_member_added: check by projectId
        if (action === 'project_member_added' && params.projectId) {
            filter['params.projectId'] = params.projectId;
        }
        // For space_member_added: check by spaceId
        else if (action === 'space_member_added' && params.spaceId) {
            filter['params.spaceId'] = params.spaceId;
        }

        // ✅ Check within time window (recent notifications only - 5 minutes)
        const timeThreshold = Date.now() - timeWindowMs;
        filter.notify_time = { $gte: timeThreshold };

        // ✅ Only check UNREAD notifications (not seen by the user) to avoid blocking legitimate re-adds
        // If user has already seen the notification, it's likely from a previous add/remove cycle
        for (let i = 0; i < toUsernameArray.length; i++) {
            const targetUsername = toUsernameArray[i];
            if (targetUsername) {
                filter.seen = { $nin: [targetUsername] }; // Only check notifications not seen by this user
                break; // Only need to check for one user
            }
        }

        MongoDBProvider.loadMain(
            dbname_prefix,
            "ringbell_item",
            filter,
            1, // top: 1
            0  // offset: 0
        ).then(function (existingNotifications) {
            const hasDuplicate = existingNotifications && existingNotifications.length > 0;
            if (hasDuplicate) {
                console.log(`[RingBellItemService] ⚠️ Duplicate UNREAD notification found for action ${action} within ${timeWindowMs/1000/60} minutes, skipping insert`);
            }
            dfd.resolve(hasDuplicate);
        }, function (err) {
            console.error('[RingBellItemService] Error checking duplicate notification:', err);
            // On error, allow insert (don't block)
            dfd.resolve(false);
        });

        return dfd.promise;
    }

    insert(dbname_prefix, username, action, params, to_username, seen, from_action, notify_time, to_students = []) {
        let dfd = q.defer();
        const self = this;

        // Ensure seen is an array
        const seenArray = Array.isArray(seen) ? seen : (seen ? [seen] : []);
        // Ensure to_username is an array
        const toUsernameArray = Array.isArray(to_username) ? to_username : (to_username ? [to_username] : []);

        console.log(`[RingBellItemService.insert] Starting insert for action ${action}, to_username:`, toUsernameArray);
        MongoDBProvider.insertMain(dbname_prefix, "ringbell_item", username,
            { action, params, to_username: toUsernameArray, seen: seenArray, from_action, notify_time, to_students })
            .then(function(result) {
                console.log(`[RingBellItemService.insert] ✅ MongoDB insert successful for action ${action}`);
                // Send notifications to users via socket
                for (let i = 0; i < toUsernameArray.length; i++) {
                    const targetUsername = toUsernameArray[i];
                    if (targetUsername && seenArray.indexOf(targetUsername) === -1) {
                        try {
                            console.log(`[RingBellItemService.insert] Emitting socket notification to ${targetUsername} for action ${action}`);
                            SocketProvider.IOEmitToRoom(targetUsername, "new_ringbell_item", {
                                username, action, params, to_username: toUsernameArray, seen: seenArray, from_action, notify_time, to_students
                            });
                            console.log(`[RingBellItemService] ✅ Sent notification to ${targetUsername} for action ${action}`);
                        } catch (socketError) {
                            console.error(`[RingBellItemService] ❌ Failed to emit socket notification to ${targetUsername}:`, socketError);
                        }
                    } else {
                        console.warn(`[RingBellItemService.insert] Skipping ${targetUsername} - already seen or invalid`);
                    }
                }
                dfd.resolve(result);
            },function(err){
                console.error('[RingBellItemService] ❌ Failed to insert ringbell item:', err);
                console.error('[RingBellItemService] ❌ Error details:', err?.mes || err?.message || err);
                dfd.reject(err);
            })
        return dfd.promise;
    }



    seen(dbname_prefix, username, id) {
        return MongoDBProvider.updateMain(dbname_prefix, "ringbell_item", username,
            { _id: { $eq: new require('mongodb').ObjectID(id) } },
            { $addToSet: { seen: username } });
    }

    seenAll(dbname_prefix, username) {
        return MongoDBProvider.updateMain(dbname_prefix, "ringbell_item", username,
            {
                $and: [
                    { seen: { $nin: [username] } },
                    { to_username: { $eq: username } }
                ]
            },
            { $addToSet: { seen: username } }
        )
    }
}




exports.RingBellItemService = new RingBellItemService();
