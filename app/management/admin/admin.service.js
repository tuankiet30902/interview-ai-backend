const { MongoDBProvider } = require('../../../shared/mongodb/db.provider');
const q = require('q');
const ObjectID = require('mongodb').ObjectID;

// ==================== HELPER FUNCTIONS ====================

const ACTIVE_FILTER = {
    $or: [
        { isactive: { $eq: true } },
        { isactive: { $exists: false } }
    ]
};

const DONE_STATUSES = ['done', 'completed'];
const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildUserFilter(additionalFilter = {}) {
    const filter = {
        $and: [{
            $or: [
                { admin: { $exists: false } },
                { admin: { $ne: true } }
            ]
        }]
    };
    if (Object.keys(additionalFilter).length > 0) {
        filter.$and.push(additionalFilter);
    }
    return filter;
}

function getDateRange(startOffset = 0, endOffset = 0) {
    const start = new Date();
    start.setDate(start.getDate() + startOffset);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + endOffset);
    end.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end: end.getTime() };
}

function getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    end.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end: end.getTime() };
}

function getPreviousMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    end.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end: end.getTime() };
}

function getLast30DaysRange() {
    return { start: Date.now() - (30 * MS_PER_DAY), end: Date.now() };
}

function getTodayRange() {
    return getDateRange(0, 1);
}

function buildDateRangeFilter(dateFrom, dateTo) {
    return {
        $or: [
            { created_at: { $gte: dateFrom, $lt: dateTo } },
            { date_created: { $gte: dateFrom, $lt: dateTo } }
        ]
    };
}

function calculateGrowthRate(current, previous) {
    if (!previous || previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
}

function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return new Date(timestamp).toLocaleDateString('vi-VN');
}

function safeToObjectID(value) {
    if (!value) return value;
    if (value instanceof ObjectID) return value;
    if (typeof value === 'string' && ObjectID.isValid(value)) {
        return new ObjectID(value);
    }
    return value;
}

function safeToString(value) {
    if (!value) return '';
    return value.toString ? value.toString() : String(value);
}

function getCreatedTimestamp(item) {
    return item.created_at || item.date_created || 0;
}

function filterByDateRange(items, dateRange) {
    return items.filter(item => {
        const created = getCreatedTimestamp(item);
        return created >= dateRange.start && created < dateRange.end;
    });
}

function sortByCreated(items, limit = null) {
    const sorted = items.sort((a, b) => getCreatedTimestamp(b) - getCreatedTimestamp(a));
    return limit ? sorted.slice(0, limit) : sorted;
}

function getArrayLength(arr) {
    return (arr && Array.isArray(arr)) ? arr.length : 0;
}

function createActivity(user, tenantName = "N/A", now = Date.now()) {
    const timestamp = getCreatedTimestamp(user);
    const displayName = user.title || user.username;
    return {
        type: 'user_joined',
        message: tenantName !== "N/A"
            ? `${displayName} đã đăng ký với tenant ${tenantName}`
            : `${displayName} đã đăng ký`,
        time: formatTimeAgo(timestamp),
        icon: 'user_plus',
        timestamp,
        username: user.username,
        tenantName
    };
}

function mapTenantNamesToUsers(users, dbname_prefix) {
    if (!users || users.length === 0) {
        return Promise.resolve(users.map(u => ({ ...u, tenant_name: "N/A" })));
    }

    const tenantIds = [];
    const userTenantMap = {};
    const tenantIdSet = new Set();

    users.forEach((user, index) => {
        const tenantId = user.primary_tenant_id || (user.tenant_ids && user.tenant_ids[0]);
        if (tenantId) {
            const tenantIdObj = safeToObjectID(tenantId);
            userTenantMap[index] = tenantIdObj;
            const tenantIdStr = safeToString(tenantIdObj);
            if (!tenantIdSet.has(tenantIdStr)) {
                tenantIdSet.add(tenantIdStr);
                tenantIds.push(tenantIdObj);
            }
        }
    });

    if (tenantIds.length === 0) {
        return Promise.resolve(users.map(u => ({ ...u, tenant_name: "N/A" })));
    }

    return MongoDBProvider.load_onManagement(dbname_prefix, "tenant", {
        _id: { $in: tenantIds }
    }).then(tenants => {
        const tenantMap = {};
        if (tenants && Array.isArray(tenants)) {
            tenants.forEach(tenant => {
                tenantMap[safeToString(tenant._id)] = tenant.name || tenant.title || "N/A";
            });
        }

        return users.map((user, index) => {
            const tenantId = userTenantMap[index];
            const tenantIdStr = tenantId ? safeToString(tenantId) : '';
            return {
                ...user,
                tenant_name: tenantMap[tenantIdStr] || "N/A"
            };
        });
    }, () => {
        return users.map(u => ({ ...u, tenant_name: "N/A" }));
    });
}

function mapTenantDetails(tenants, dbname_prefix) {
    if (!tenants || tenants.length === 0) {
        return Promise.resolve(tenants.map(t => ({
            ...t,
            owner_name: "N/A",
            member_count: 0,
            task_done: 0,
            task_total: 0,
            progress: 0
        })));
    }

    const tenantIds = tenants.map(t => t._id).filter(id => id);
    if (tenantIds.length === 0) {
        return Promise.resolve(tenants.map(t => ({
            ...t,
            owner_name: t.owner_name || t.owner_username || "N/A",
            member_count: (t.members && Array.isArray(t.members)) ? t.members.length : 0,
            task_done: 0,
            task_total: 0,
            progress: 0
        })));
    }

    const tenantIdStrings = tenantIds.map(id => safeToString(id));
    const tenantIdStringMap = {};
    tenantIdStrings.forEach(str => { tenantIdStringMap[str] = true; });

    const taskFilter = {
        $and: [
            { tenant_id: { $in: tenantIdStrings } },
            ACTIVE_FILTER
        ]
    };

    return MongoDBProvider.load_onOffice(dbname_prefix, "task", taskFilter).then(tasks => {
        const taskStatsMap = {};
        tenantIdStrings.forEach(str => {
            taskStatsMap[str] = { total: 0, done: 0 };
        });

        if (tasks && tasks.length > 0) {
            tasks.forEach(task => {
                const taskTenantIdStr = task.tenant_id ? safeToString(task.tenant_id) : null;
                if (!taskTenantIdStr || !tenantIdStringMap[taskTenantIdStr]) return;

                taskStatsMap[taskTenantIdStr].total++;
                const taskStatus = task.status ? String(task.status).toLowerCase().trim() : '';
                if (DONE_STATUSES.includes(taskStatus)) {
                    taskStatsMap[taskTenantIdStr].done++;
                }
            });
        }

        return tenants.map(tenant => {
            const tenantIdStr = safeToString(tenant._id);
            const stats = taskStatsMap[tenantIdStr] || { total: 0, done: 0 };
            const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

            return {
                ...tenant,
                owner_name: tenant.owner_name || tenant.owner_username || "N/A",
                member_count: (tenant.members && Array.isArray(tenant.members)) ? tenant.members.length : 0,
                task_done: stats.done,
                task_total: stats.total,
                progress
            };
        });
    }, () => {
        return tenants.map(t => ({
            ...t,
            owner_name: t.owner_name || t.owner_username || "N/A",
            member_count: (t.members && Array.isArray(t.members)) ? t.members.length : 0,
            task_done: 0,
            task_total: 0,
            progress: 0
        }));
    });
}

function mapTaskCountsToUsers(users, dbname_prefix) {
    if (!users || users.length === 0) {
        return Promise.resolve(users.map(u => ({ ...u, task_count: 0 })));
    }

    const usernames = users.map(u => u.username).filter(u => u);
    if (usernames.length === 0) {
        return Promise.resolve(users.map(u => ({ ...u, task_count: 0 })));
    }

    const taskFilter = {
        $or: [
            { assignee: { $in: usernames } },
            { assignees: { $in: usernames } },
            { created_by: { $in: usernames } }
        ]
    };

    return MongoDBProvider.load_onOffice(dbname_prefix, "task", taskFilter).then(tasks => {
        if (!tasks || tasks.length === 0) {
            return users.map(u => ({ ...u, task_count: 0 }));
        }

        const taskCountMap = {};
        usernames.forEach(username => {
            taskCountMap[username] = new Set();
        });

        tasks.forEach(task => {
            const taskId = task._id ? safeToString(task._id) : null;
            if (!taskId) return;

            if (task.assignee && taskCountMap[task.assignee]) {
                taskCountMap[task.assignee].add(taskId);
            }
            if (Array.isArray(task.assignees)) {
                task.assignees.forEach(assigneeUsername => {
                    if (assigneeUsername && taskCountMap[assigneeUsername]) {
                        taskCountMap[assigneeUsername].add(taskId);
                    }
                });
            }
            if (task.created_by && taskCountMap[task.created_by]) {
                taskCountMap[task.created_by].add(taskId);
            }
        });

        return users.map(user => ({
            ...user,
            task_count: user.username && taskCountMap[user.username] ? taskCountMap[user.username].size : 0
        }));
    }, () => {
        return users.map(u => ({ ...u, task_count: 0 }));
    });
}

function buildActivitiesFromUsers(usersWithTenant, tenantMap, now) {
    return usersWithTenant.map(user => {
        const tenantId = user.tenantId;
        const tenantIdStr = tenantId ? safeToString(tenantId) : null;
        const tenantName = tenantIdStr ? (tenantMap[tenantIdStr] || "N/A") : "N/A";
        return createActivity(user, tenantName, now);
    });
}

function loadRecentActivities(dbname_prefix, limit = 10) {
    const dfd = q.defer();
    const now = Date.now();
    const last7Days = now - (7 * MS_PER_DAY);
    const userFilter = buildUserFilter(buildDateRangeFilter(last7Days, now));

    MongoDBProvider.load_onManagement(
        dbname_prefix, "user", userFilter, limit * 2, 0, { created_at: -1 }, { password: false }
    ).then(users => {
        if (!users || users.length === 0) {
            dfd.resolve([]);
            return;
        }

        const usersWithTenant = users.slice(0, limit);
        if (usersWithTenant.length === 0) {
            dfd.resolve([]);
            return;
        }

        const tenantIds = [];
        const userTenantMap = {};
        const tenantIdSet = new Set();

        usersWithTenant.forEach((user, index) => {
            const tenantId = user.primary_tenant_id || (user.tenant_ids && user.tenant_ids[0]);
            if (tenantId) {
                const tenantIdObj = safeToObjectID(tenantId);
                userTenantMap[index] = tenantIdObj;
                const tenantIdStr = safeToString(tenantIdObj);
                if (!tenantIdSet.has(tenantIdStr)) {
                    tenantIdSet.add(tenantIdStr);
                    tenantIds.push(tenantIdObj);
                }
            }
        });

        if (tenantIds.length === 0) {
            dfd.resolve(usersWithTenant.map(user => createActivity(user, "N/A", now)));
            return;
        }

        MongoDBProvider.load_onManagement(dbname_prefix, "tenant", {
            _id: { $in: tenantIds }
        }).then(tenants => {
            const tenantMap = {};
            if (tenants && Array.isArray(tenants)) {
                tenants.forEach(tenant => {
                    tenantMap[safeToString(tenant._id)] = tenant.name || tenant.title || "N/A";
                });
            }

            const usersForActivities = usersWithTenant.map((user, index) => ({
                ...user,
                tenantId: userTenantMap[index]
            }));

            dfd.resolve(buildActivitiesFromUsers(usersForActivities, tenantMap, now));
        }, () => {
            dfd.resolve(usersWithTenant.map(user => createActivity(user, "N/A", now)));
        });
    }, () => {
        dfd.resolve([]);
    });

    return dfd.promise;
}

// ==================== CLASS AdminService ====================

class AdminService {
    constructor() { }

    checkExists(dbname_prefix, identifier, password) {
        const filter = {
            $and: [
                {
                    $or: [
                        { username: { $eq: identifier } },
                        { email: { $eq: identifier } }
                    ]
                },
                { password: { $eq: password } },
                { isactive: { $eq: true } }
            ]
        };
        return MongoDBProvider.load_onManagement(dbname_prefix, "admin", filter, undefined, undefined, undefined, { password: false });
    }

    loadDetails(dbname_prefix, account) {
        return MongoDBProvider.getOne_onManagement(dbname_prefix, "admin", { username: { $eq: account } });
    }

    loadUsers(dbname_prefix, filter = {}) {
        const userFilter = buildUserFilter(filter);
        return MongoDBProvider.load_onManagement(dbname_prefix, "user", userFilter, undefined, undefined, undefined, { password: false });
    }

    countUsers(dbname_prefix, filter = {}) {
        const userFilter = buildUserFilter(filter);
        return MongoDBProvider.count_onManagement(dbname_prefix, "user", userFilter);
    }

    loadAdmins(dbname_prefix) {
        return MongoDBProvider.load_onManagement(dbname_prefix, "admin", {});
    }

    countAdmins(dbname_prefix) {
        return MongoDBProvider.count_onManagement(dbname_prefix, "admin", {});
    }

    loadTenants(dbname_prefix) {
        return MongoDBProvider.load_onManagement(dbname_prefix, "tenant", {});
    }

    countTenants(dbname_prefix) {
        return MongoDBProvider.count_onManagement(dbname_prefix, "tenant", {});
    }

    loadSpaces(dbname_prefix, filter = {}) {
        return MongoDBProvider.load_onOffice(dbname_prefix, "space", filter);
    }

    countSpaces(dbname_prefix, filter = {}) {
        return MongoDBProvider.count_onOffice(dbname_prefix, "space", filter);
    }

    loadProjects(dbname_prefix, filter = {}) {
        return MongoDBProvider.load_onOffice(dbname_prefix, "project", filter);
    }

    countProjects(dbname_prefix, filter = {}) {
        return MongoDBProvider.count_onOffice(dbname_prefix, "project", filter);
    }

    loadTasks(dbname_prefix, filter = {}) {
        return MongoDBProvider.load_onOffice(dbname_prefix, "task", filter);
    }

    countTasks(dbname_prefix, filter = {}) {
        return MongoDBProvider.count_onOffice(dbname_prefix, "task", filter);
    }

    getDashboardStats(dbname_prefix) {
        const dfd = q.defer();
        const today = getTodayRange();
        const currentMonth = getCurrentMonthRange();
        const previousMonth = getPreviousMonthRange();
        const last30Days = getLast30DaysRange();

        const promises = {
            allUsers: this.loadUsers(dbname_prefix),
            allAdmins: this.loadAdmins(dbname_prefix),
            activeUsers: this.loadUsers(dbname_prefix, { isactive: { $eq: true } }),
            allTenants: this.loadTenants(dbname_prefix),
            allSpaces: this.loadSpaces(dbname_prefix),
            allProjects: this.loadProjects(dbname_prefix),
            allTasks: this.loadTasks(dbname_prefix),
            activeSpaces: this.loadSpaces(dbname_prefix, ACTIVE_FILTER),
            activeProjects: this.loadProjects(dbname_prefix, ACTIVE_FILTER),
            activeTasks: this.loadTasks(dbname_prefix, ACTIVE_FILTER),
            allLandingVisits: MongoDBProvider.load_onManagement(dbname_prefix, "landing_visit", {}).catch(() => []),
            allLoginEvents: MongoDBProvider.load_onManagement(dbname_prefix, "login_event", {}).catch(() => [])
        };

        // Derived promises
        promises.newUsersThisMonth = promises.allUsers.then(users => filterByDateRange(users, currentMonth));
        promises.usersLastMonth = promises.allUsers.then(users => users.filter(u => getCreatedTimestamp(u) < previousMonth.end));
        promises.newUsers30Days = promises.allUsers.then(users => filterByDateRange(users, last30Days));
        promises.newTenants30Days = promises.allTenants.then(tenants => filterByDateRange(tenants, last30Days));
        promises.newSpaces30Days = promises.allSpaces.then(spaces => filterByDateRange(spaces, last30Days));
        promises.newProjects30Days = promises.allProjects.then(projects => filterByDateRange(projects, last30Days));
        promises.newTasks30Days = promises.allTasks.then(tasks => filterByDateRange(tasks, last30Days));
        promises.recentUsers = promises.allUsers.then(users => sortByCreated(users, 10));
        promises.recentTenants = promises.allTenants.then(tenants => sortByCreated(tenants, 10));
        promises.recentSpaces = promises.allSpaces.then(spaces => sortByCreated(spaces, 10));
        promises.recentProjects = promises.allProjects.then(projects => sortByCreated(projects, 10));
        promises.monthlyUserStats = this.getMonthlyUserStats(dbname_prefix).catch(err => {
            console.error('[AdminService.getDashboardStats] Error loading monthly stats:', err);
            return [];
        });
        promises.recentActivities = loadRecentActivities(dbname_prefix, 50).catch(err => {
            console.error('[AdminService.getDashboardStats] Error loading recent activities:', err);
            return [];
        });
        promises.landingVisitsToday = promises.allLandingVisits.then(visits => {
            if (!visits || !Array.isArray(visits)) return 0;
            return visits.filter(v => {
                const ts = v.timestamp || v.created_at || v.date_created || 0;
                return ts >= today.start && ts < today.end;
            }).length;
        });
        promises.loginEventsToday = promises.allLoginEvents.then(events => {
            if (!events || !Array.isArray(events)) return 0;
            return events.filter(e => {
                const ts = e.timestamp || e.created_at || e.date_created || 0;
                return ts >= today.start && ts < today.end;
            }).length;
        });

        const promisesArray = [
            promises.allUsers, promises.allAdmins, promises.activeUsers, promises.allTenants,
            promises.allSpaces, promises.allProjects, promises.allTasks, promises.activeSpaces,
            promises.activeProjects, promises.activeTasks, promises.newUsersThisMonth, promises.usersLastMonth,
            promises.newUsers30Days, promises.newTenants30Days, promises.newSpaces30Days,
            promises.newProjects30Days, promises.newTasks30Days, promises.recentUsers, promises.recentTenants,
            promises.recentSpaces, promises.recentProjects, promises.monthlyUserStats, promises.recentActivities,
            promises.allLandingVisits, promises.allLoginEvents, promises.landingVisitsToday, promises.loginEventsToday
        ];

        q.all(promisesArray).then(results => {
            const [
                allUsers, allAdmins, activeUsers, allTenants, allSpaces, allProjects, allTasks,
                activeSpaces, activeProjects, activeTasks, newUsersThisMonth, usersLastMonth,
                newUsers30Days, newTenants30Days, newSpaces30Days, newProjects30Days, newTasks30Days,
                recentUsers, recentTenants, recentSpaces, recentProjects, monthlyUserStats, recentActivities,
                allLandingVisits, allLoginEvents, landingVisitsToday, loginEventsToday
            ] = results;

            const stats = {
                totalUsers: getArrayLength(allUsers),
                totalAdmins: getArrayLength(allAdmins),
                activeUsers: getArrayLength(activeUsers),
                inactiveUsers: getArrayLength(allUsers) - getArrayLength(activeUsers),
                totalTenants: getArrayLength(allTenants),
                totalSpaces: getArrayLength(allSpaces),
                totalProjects: getArrayLength(allProjects),
                totalTasks: getArrayLength(allTasks),
                activeSpaces: getArrayLength(activeSpaces),
                activeProjects: getArrayLength(activeProjects),
                activeTasks: getArrayLength(activeTasks),
                newUsersThisMonth: getArrayLength(newUsersThisMonth),
                usersLastMonth: getArrayLength(usersLastMonth),
                newUsers30Days: getArrayLength(newUsers30Days),
                newTenants30Days: getArrayLength(newTenants30Days),
                newSpaces30Days: getArrayLength(newSpaces30Days),
                newProjects30Days: getArrayLength(newProjects30Days),
                newTasks30Days: getArrayLength(newTasks30Days),
                landingVisitsToday: typeof landingVisitsToday === 'number' ? landingVisitsToday : 0,
                loginEventsToday: typeof loginEventsToday === 'number' ? loginEventsToday : 0
            };

            const totalUsersGrowth = calculateGrowthRate(stats.totalUsers, stats.usersLastMonth);
            const estimatedNewUsersLastMonth = Math.max(0, stats.usersLastMonth - (stats.totalUsers - stats.newUsersThisMonth));
            const newUsersGrowth = calculateGrowthRate(stats.newUsersThisMonth, estimatedNewUsersLastMonth);

            const resolveStats = (usersWithTenant) => {
                dfd.resolve({
                    ...stats,
                    taskStatusStats: {},
                    recentUsers: usersWithTenant,
                    recentTenants: recentTenants || [],
                    recentSpaces: recentSpaces || [],
                    recentProjects: recentProjects || [],
                    growth: {
                        users30Days: stats.newUsers30Days,
                        tenants30Days: stats.newTenants30Days,
                        spaces30Days: stats.newSpaces30Days,
                        projects30Days: stats.newProjects30Days,
                        tasks30Days: stats.newTasks30Days
                    },
                    totalUsersGrowth,
                    newUsersGrowth,
                    overallGrowthRate: totalUsersGrowth,
                    monthlyUserStats: monthlyUserStats || [],
                    recentActivities: recentActivities || []
                });
            };

            mapTenantNamesToUsers(recentUsers, dbname_prefix)
                .then(resolveStats, () => {
                    resolveStats(recentUsers.map(u => ({ ...u, tenant_name: "N/A" })));
                });
        }, err => {
            console.error('[AdminService.getDashboardStats] Error:', err);
            dfd.reject(err);
        });

        return dfd.promise;
    }

    getMonthlyUserStats(dbname_prefix) {
        const dfd = q.defer();
        const now = new Date();
        const months = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
            monthEnd.setHours(0, 0, 0, 0);

            months.push({
                month: `T${12 - i}`,
                start: monthStart.getTime(),
                end: monthEnd.getTime()
            });
        }

        this.loadUsers(dbname_prefix).then(allUsers => {
            const results = months.map(month => ({
                month: month.month,
                'Tổng users': allUsers.filter(u => getCreatedTimestamp(u) < month.end).length,
                'Users mới': allUsers.filter(u => {
                    const created = getCreatedTimestamp(u);
                    return created >= month.start && created < month.end;
                }).length
            }));

            dfd.resolve(results);
        }, err => {
            console.error('[AdminService.getMonthlyUserStats] Error:', err);
            dfd.resolve([]);
        });

        return dfd.promise;
    }

    loadUsersPaginated(dbname_prefix, options) {
        const dfd = q.defer();
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;
        const search = options.search || '';
        const status = options.status;
        const sortBy = options.sortBy || 'created_at';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        const { dateFrom, dateTo } = options;

        const filter = buildUserFilter();
        if (dateFrom !== undefined && dateTo !== undefined) {
            filter.$and.push(buildDateRangeFilter(dateFrom, dateTo));
        }
        if (search && search.trim()) {
            const searchRegex = { $regex: search.trim(), $options: 'i' };
            filter.$and.push({
                $or: [
                    { username: searchRegex },
                    { email: searchRegex },
                    { title: searchRegex },
                    { title_search: searchRegex }
                ]
            });
        }
        if (status === 'active') {
            filter.$and.push({ isactive: { $eq: true } });
        } else if (status === 'inactive') {
            filter.$and.push({ isactive: { $ne: true } });
        }

        const sort = { [sortBy]: sortOrder };

        MongoDBProvider.load_onManagement(
            dbname_prefix, "user", filter, limit, skip, sort, { password: false }
        ).then(users => {
            if (!users || users.length === 0) {
                dfd.resolve({
                    users: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
                return;
            }

            const countFilter = filter.$and.slice(1);
            const countPromise = countFilter.length > 0
                ? this.loadUsers(dbname_prefix, countFilter.length === 1 ? countFilter[0] : { $and: countFilter })
                : this.loadUsers(dbname_prefix);

            countPromise.then(allUsers => {
                const totalCount = getArrayLength(allUsers);
                this._mergeUserData(users, dbname_prefix, page, limit, totalCount, dfd);
            }, () => {
                this._mergeUserData(users, dbname_prefix, page, limit, users.length, dfd);
            });
        }, err => {
            console.error('[AdminService.loadUsersPaginated] Error:', err);
            dfd.reject(err);
        });

        return dfd.promise;
    }

    _mergeUserData(users, dbname_prefix, page, limit, totalCount, dfd) {
        q.all([
            mapTenantNamesToUsers(users, dbname_prefix),
            mapTaskCountsToUsers(users, dbname_prefix)
        ]).then(results => {
            const [usersWithTenant, usersWithTaskCount] = results;
            const finalUsers = usersWithTenant.map((user, index) => ({
                ...user,
                task_count: usersWithTaskCount[index]?.task_count || 0
            }));

            dfd.resolve({
                users: finalUsers || [],
                pagination: {
                    page, limit, total: totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                }
            });
        }, () => {
            dfd.resolve({
                users: users.map(u => ({ ...u, tenant_name: "N/A", task_count: 0 })),
                pagination: {
                    page, limit, total: totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                }
            });
        });
    }

    loadTenantsForFilter(dbname_prefix) {
        return this.loadTenants(dbname_prefix).then(tenants => sortByCreated(tenants, 1000));
    }

    loadSpacesPaginated(dbname_prefix, options) {
        const dfd = q.defer();
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;
        const search = options.search || '';
        const status = options.status;
        const sortBy = options.sortBy || 'created_at';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

        const filter = {};
        if (search && search.trim()) {
            const searchRegex = { $regex: search.trim(), $options: 'i' };
            filter.$or = [
                { name: searchRegex },
                { name_search: searchRegex },
                { owner_name: searchRegex },
                { owner_username: searchRegex }
            ];
        }
        if (status === 'active') {
            filter.status = { $eq: 'active' };
        } else if (status === 'inactive') {
            filter.status = { $ne: 'active' };
        }

        const sort = { [sortBy]: sortOrder };

        q.all([
            MongoDBProvider.load_onManagement(dbname_prefix, "tenant", filter, limit, skip, sort),
            this._getFilteredTenants(dbname_prefix, filter)
        ]).then(results => {
            const [tenants, allTenants] = results;

            mapTenantDetails(tenants || [], dbname_prefix).then(tenantsWithDetails => {
                dfd.resolve({
                    spaces: tenantsWithDetails || [],
                    pagination: {
                        page, limit,
                        total: getArrayLength(allTenants),
                        totalPages: Math.ceil(getArrayLength(allTenants) / limit)
                    }
                });
            }, () => {
                dfd.resolve({
                    spaces: tenants.map(t => ({
                        ...t,
                        owner_name: t.owner_name || t.owner_username || "N/A",
                        member_count: (t.members && Array.isArray(t.members)) ? t.members.length : 0,
                        task_done: 0, task_total: 0, progress: 0
                    })) || [],
                    pagination: {
                        page, limit,
                        total: getArrayLength(allTenants),
                        totalPages: Math.ceil(getArrayLength(allTenants) / limit)
                    }
                });
            });
        }, err => {
            console.error('[AdminService.loadSpacesPaginated] Error:', err);
            dfd.reject(err);
        });

        return dfd.promise;
    }

    _getFilteredTenants(dbname_prefix, filter) {
        return this.loadTenants(dbname_prefix).then(allTenants => {
            if (!filter || Object.keys(filter).length === 0) {
                return allTenants || [];
            }
            let filtered = allTenants || [];
            if (filter.status) {
                if (filter.status.$eq) {
                    filtered = filtered.filter(t => t.status === filter.status.$eq);
                } else if (filter.status.$ne) {
                    filtered = filtered.filter(t => t.status !== filter.status.$ne);
                }
            }
            if (filter.$or && Array.isArray(filter.$or)) {
                const searchRegex = filter.$or.find(f => f.name && f.name.$regex);
                if (searchRegex) {
                    const regex = new RegExp(searchRegex.name.$regex, searchRegex.name.$options || 'i');
                    filtered = filtered.filter(t =>
                        (t.name && regex.test(t.name)) ||
                        (t.name_search && regex.test(t.name_search)) ||
                        (t.owner_name && regex.test(t.owner_name)) ||
                        (t.owner_username && regex.test(t.owner_username))
                    );
                }
            }
            return filtered;
        });
    }

    loadProjectsPaginated(dbname_prefix, options) {
        const dfd = q.defer();
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;
        const search = options.search || '';
        const status = options.status;
        const sortBy = options.sortBy || 'created_at';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

        const filter = {};
        if (search && search.trim()) {
            const searchRegex = { $regex: search.trim(), $options: 'i' };
            filter.$or = [
                { name: searchRegex },
                { title: searchRegex }
            ];
        }
        if (status === 'active') {
            filter.isactive = { $eq: true };
        } else if (status === 'inactive') {
            filter.isactive = { $ne: true };
        }

        const sort = { [sortBy]: sortOrder };

        q.all([
            MongoDBProvider.load_onOffice(dbname_prefix, "project", filter, limit, skip, sort),
            this.loadProjects(dbname_prefix, filter)
        ]).then(results => {
            const [projects, allProjects] = results;
            dfd.resolve({
                projects: projects || [],
                pagination: {
                    page, limit,
                    total: getArrayLength(allProjects),
                    totalPages: Math.ceil(getArrayLength(allProjects) / limit)
                }
            });
        }, err => {
            console.error('[AdminService.loadProjectsPaginated] Error:', err);
            dfd.reject(err);
        });

        return dfd.promise;
    }

    countTodayUsers(dbname_prefix) {
        const today = getTodayRange();
        return this.loadUsers(dbname_prefix, buildDateRangeFilter(today.start, today.end)).then(users => users.length);
    }

    loadAllActivities(dbname_prefix, options) {
        const dfd = q.defer();
        const page = options.page || 1;
        const limit = options.limit || 50;
        const skip = (page - 1) * limit;
        const days = options.days || 7;
        const now = Date.now();
        const dateFrom = now - (days * MS_PER_DAY);
        const userFilter = buildUserFilter(buildDateRangeFilter(dateFrom, now));

        MongoDBProvider.load_onManagement(
            dbname_prefix, "user", userFilter, limit * 3, skip, { created_at: -1 }, { password: false }
        ).then(users => {
            if (!users || users.length === 0) {
                dfd.resolve({
                    activities: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
                return;
            }

            const usersWithTenant = users.filter(user =>
                user.primary_tenant_id || (user.tenant_ids && user.tenant_ids.length > 0)
            ).slice(0, limit);

            if (usersWithTenant.length === 0) {
                dfd.resolve({
                    activities: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
                return;
            }

            const tenantIds = [];
            const userTenantMap = {};
            const tenantIdSet = new Set();

            usersWithTenant.forEach((user, index) => {
                const tenantId = user.primary_tenant_id || (user.tenant_ids && user.tenant_ids[0]);
                if (tenantId) {
                    const tenantIdObj = safeToObjectID(tenantId);
                    userTenantMap[index] = tenantIdObj;
                    const tenantIdStr = safeToString(tenantIdObj);
                    if (!tenantIdSet.has(tenantIdStr)) {
                        tenantIdSet.add(tenantIdStr);
                        tenantIds.push(tenantIdObj);
                    }
                }
            });

            if (tenantIds.length === 0) {
                dfd.resolve({
                    activities: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
                return;
            }

            q.all([
                MongoDBProvider.load_onManagement(dbname_prefix, "tenant", { _id: { $in: tenantIds } }),
                this.loadUsers(dbname_prefix, buildDateRangeFilter(dateFrom, now))
            ]).then(results => {
                const [tenants, allUsers] = results;
                const tenantMap = {};
                if (tenants && Array.isArray(tenants)) {
                    tenants.forEach(tenant => {
                        tenantMap[safeToString(tenant._id)] = tenant.name || tenant.title || "N/A";
                    });
                }

                const usersForActivities = usersWithTenant.map((user, index) => ({
                    ...user,
                    tenantId: userTenantMap[index]
                }));
                const activities = buildActivitiesFromUsers(usersForActivities, tenantMap, now);

                const totalWithTenant = allUsers.filter(user =>
                    user.primary_tenant_id || (user.tenant_ids && user.tenant_ids.length > 0)
                ).length;

                dfd.resolve({
                    activities,
                    pagination: {
                        page, limit, total: totalWithTenant,
                        totalPages: Math.ceil(totalWithTenant / limit)
                    }
                });
            }, () => {
                dfd.resolve({
                    activities: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            });
        }, () => {
            dfd.resolve({
                activities: [],
                pagination: { page, limit, total: 0, totalPages: 0 }
            });
        });

        return dfd.promise;
    }

    getReportsStats(dbname_prefix) {
        const dfd = q.defer();
        const now = Date.now();
        const last30Days = getLast30DaysRange();
        const previous30Days = {
            start: last30Days.start - (30 * MS_PER_DAY),
            end: last30Days.start
        };

        q.all([
            this.loadTasks(dbname_prefix),
            this.loadUsers(dbname_prefix),
            this.loadSpaces(dbname_prefix)
        ]).then(results => {
            const [allTasks, allUsers, allSpaces] = results;
            const activeTasks = allTasks.filter(t => t.isactive !== false);

            const completedTasks = activeTasks.filter(t => {
                const status = t.status ? String(t.status).toLowerCase().trim() : '';
                return DONE_STATUSES.includes(status);
            });
            const completedTasksCount = completedTasks.length;

            const previousCompletedTasks = activeTasks.filter(t => {
                const status = t.status ? String(t.status).toLowerCase().trim() : '';
                const updated = t.updated_at || t.created_at || 0;
                return DONE_STATUSES.includes(status) && updated >= previous30Days.start && updated < previous30Days.end;
            });
            const completedTasksGrowth = calculateGrowthRate(completedTasksCount, previousCompletedTasks.length);

            // Calculate average time
            const { avgTimeDays, avgTimeGrowth } = this._calculateAverageTime(completedTasks, previousCompletedTasks);

            // Calculate completion rate
            const totalTasksCount = activeTasks.length;
            const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
            const previousTotalTasks = activeTasks.filter(t => {
                const created = t.created_at || 0;
                return created >= previous30Days.start && created < previous30Days.end;
            }).length;
            const previousCompletedInPeriod = activeTasks.filter(t => {
                const status = t.status ? String(t.status).toLowerCase().trim() : '';
                const updated = t.updated_at || t.created_at || 0;
                return DONE_STATUSES.includes(status) && updated >= previous30Days.start && updated < previous30Days.end;
            }).length;
            const previousCompletionRate = previousTotalTasks > 0 ? Math.round((previousCompletedInPeriod / previousTotalTasks) * 100) : 0;
            const completionRateGrowth = calculateGrowthRate(completionRate, previousCompletionRate);

            // Task status stats
            const taskStatusStats = this._calculateTaskStatusStats(activeTasks, now);

            // Workspace performance
            const workspacePerformance = this._calculateWorkspacePerformance(activeTasks, allSpaces);

            // Weekly activity
            const weeklyActivity = this._calculateWeeklyActivity(activeTasks);

            dfd.resolve({
                totalUsers: allUsers.length,
                totalUsersGrowth: calculateGrowthRate(allUsers.length, allUsers.filter(u => getCreatedTimestamp(u) < previous30Days.end).length),
                completedTasks: completedTasksCount,
                completedTasksGrowth,
                avgTimeDays: Math.round(avgTimeDays * 10) / 10,
                avgTimeGrowth,
                completionRate,
                completionRateGrowth,
                taskStatusStats,
                workspacePerformance,
                weeklyActivity
            });
        }, err => {
            console.error('[AdminService.getReportsStats] Error:', err);
            dfd.reject(err);
        });

        return dfd.promise;
    }

    _calculateAverageTime(completedTasks, previousCompletedTasks) {
        const calculateAvg = (tasks) => {
            let totalTime = 0;
            let completedWithTime = 0;
            tasks.forEach(task => {
                const created = task.created_at || 0;
                const updated = task.updated_at || created;
                if (created > 0 && updated > created) {
                    totalTime += (updated - created);
                    completedWithTime++;
                }
            });
            const avgTimeMs = completedWithTime > 0 ? totalTime / completedWithTime : 0;
            return avgTimeMs / MS_PER_DAY;
        };

        const avgTimeDays = calculateAvg(completedTasks);
        const prevAvgTimeDays = calculateAvg(previousCompletedTasks);
        const avgTimeGrowth = prevAvgTimeDays > 0 ? calculateGrowthRate(avgTimeDays, prevAvgTimeDays) : 0;

        return { avgTimeDays, avgTimeGrowth };
    }

    _calculateTaskStatusStats(activeTasks, now) {
        const stats = {
            'Hoàn thành': 0,
            'Đang làm': 0,
            'Chờ xử lý': 0,
            'Quá hạn': 0
        };

        activeTasks.forEach(task => {
            const status = task.status ? String(task.status).toLowerCase().trim() : '';
            const dueDate = task.due_date || 0;
            const isOverdue = dueDate > 0 && dueDate < now && !DONE_STATUSES.includes(status);

            if (DONE_STATUSES.includes(status)) {
                stats['Hoàn thành']++;
            } else if (status === 'in_progress' || status === 'inprogress') {
                stats['Đang làm']++;
            } else if (isOverdue) {
                stats['Quá hạn']++;
            } else {
                stats['Chờ xử lý']++;
            }
        });

        return stats;
    }

    _calculateWorkspacePerformance(activeTasks, allSpaces) {
        const spaceMap = {};
        if (allSpaces && allSpaces.length > 0) {
            allSpaces.forEach(space => {
                const spaceId = space._id ? safeToString(space._id) : null;
                if (spaceId) {
                    spaceMap[spaceId] = space.name || space.title || 'Unknown';
                }
            });
        }

        const spaceStats = {};
        activeTasks.forEach(task => {
            const spaceId = task.space_id ? safeToString(task.space_id) : null;
            const spaceName = spaceId && spaceMap[spaceId] ? spaceMap[spaceId] : 'Other';
            if (!spaceStats[spaceName]) {
                spaceStats[spaceName] = { total: 0, completed: 0 };
            }
            spaceStats[spaceName].total++;
            const status = task.status ? String(task.status).toLowerCase().trim() : '';
            if (DONE_STATUSES.includes(status)) {
                spaceStats[spaceName].completed++;
            }
        });

        return Object.keys(spaceStats).map(spaceName => ({
            name: spaceName,
            completed: spaceStats[spaceName].completed,
            total: spaceStats[spaceName].total
        })).sort((a, b) => b.completed - a.completed).slice(0, 5);
    }

    _calculateWeeklyActivity(activeTasks) {
        const weeklyActivity = [];
        const nowDate = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(nowDate);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const dayStart = date.getTime();
            const dayEnd = dayStart + MS_PER_DAY;
            const dayName = DAY_NAMES[date.getDay()];

            const tasksInDay = activeTasks.filter(t => {
                const created = t.created_at || 0;
                const updated = t.updated_at || created;
                return (created >= dayStart && created < dayEnd) || (updated >= dayStart && updated < dayEnd);
            }).length;

            const activeUsersInDay = new Set();
            activeTasks.forEach(t => {
                const created = t.created_at || 0;
                const updated = t.updated_at || created;
                if ((created >= dayStart && created < dayEnd) || (updated >= dayStart && updated < dayEnd)) {
                    if (t.created_by) activeUsersInDay.add(t.created_by);
                    if (t.assignee) activeUsersInDay.add(t.assignee);
                    if (Array.isArray(t.assignees)) {
                        t.assignees.forEach(a => activeUsersInDay.add(a));
                    }
                }
            });

            weeklyActivity.push({
                day: dayName,
                tasks: tasksInDay,
                activeUsers: activeUsersInDay.size
            });
        }

        return weeklyActivity;
    }
}

exports.AdminService = new AdminService();
