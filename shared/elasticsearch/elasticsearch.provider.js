const { Client } = require('@elastic/elasticsearch');
const q = require('q');

class ElasticsearchProvider {
    constructor() {
        // Prevent instantiation
        throw new Error('ElasticsearchProvider is a static class. Use static methods.');
    }

    // Static properties
    static get client() {
        if (!ElasticsearchProvider._client) {
            try {
                const {
                    ELASTICSEARCH_URL = 'http://localhost:9200',
                    ELASTICSEARCH_USERNAME,
                    ELASTICSEARCH_PASSWORD
                } = process.env;

                const clientConfig = {
                    node: ELASTICSEARCH_URL,
                    requestTimeout: 30000,
                    pingTimeout: 3000,
                    maxRetries: 2,
                    retryOnTimeout: true
                };

                // Add authentication if provided
                if (ELASTICSEARCH_USERNAME && ELASTICSEARCH_PASSWORD) {
                    clientConfig.auth = {
                        username: ELASTICSEARCH_USERNAME,
                        password: ELASTICSEARCH_PASSWORD
                    };
                }

                ElasticsearchProvider._client = new Client(clientConfig);
            } catch (error) {
                console.error('[ElasticsearchProvider] Error creating client:', error);
                throw error;
            }
        }
        return ElasticsearchProvider._client;
    }

    static get indexName() {
        return 'tasks';
    }

    /**
     * Check if Elasticsearch is available
     * @returns {Promise<boolean>}
     */
    static async isAvailable() {
        try {
            const response = await ElasticsearchProvider.client.ping();
            return response === true;
        } catch (error) {
            console.warn('[ElasticsearchProvider.isAvailable] Error:', error.message);
            return false;
        }
    }

    /**
     * Setup Elasticsearch index with mapping
     * @returns {Promise<void>}
     */
    static async setupIndex() {
        const indexExists = await ElasticsearchProvider.client.indices.exists({
            index: ElasticsearchProvider.indexName
        });

        if (!indexExists) {
            await ElasticsearchProvider.client.indices.create({
                index: ElasticsearchProvider.indexName,
                body: {
                    mappings: {
                        properties: {
                            tenant_id: { type: 'keyword' },
                            project_id: { type: 'keyword' },
                            sprint_id: { type: 'keyword' },
                            name: {
                                type: 'text',
                                analyzer: 'standard',
                                fields: {
                                    keyword: { type: 'keyword' }
                                }
                            },
                            description: {
                                type: 'text',
                                analyzer: 'standard'
                            },
                            task_code: { type: 'keyword' },
                            status: { type: 'keyword' },
                            priority: { type: 'keyword' },
                            assignee: { type: 'keyword' },
                            tags: { type: 'keyword' },
                            isactive: { type: 'boolean' },
                            created_at: { type: 'date' },
                            updated_at: { type: 'date' }
                        }
                    },
                    settings: {
                        number_of_shards: 1,
                        number_of_replicas: 0
                    }
                }
            });
        }
    }

    /**
     * Index a single task
     * @param {Object} task - Task object
     * @returns {Promise<void>}
     */
    static async indexTask(task) {
        if (!task || !task._id) {
            throw new Error('Task must have _id');
        }

        await ElasticsearchProvider.client.index({
            index: ElasticsearchProvider.indexName,
            id: task._id.toString(),
            body: {
                // ✅ Don't include _id in body - it's metadata, set in id parameter above
                tenant_id: task.tenant_id ? task.tenant_id.toString() : null,
                project_id: task.project_id ? task.project_id.toString() : null,
                sprint_id: task.sprint_id ? task.sprint_id.toString() : null,
                name: task.name || '',
                description: task.description || '',
                task_code: task.task_code || '',
                // Only index status/priority if they have values (not empty string)
                status: (task.status && task.status.trim()) ? task.status : null,
                priority: (task.priority && task.priority.trim()) ? task.priority : null,
                assignee: task.assignee || '',
                tags: task.tags || [],
                isactive: task.isactive !== undefined ? task.isactive : true,
                created_at: task.created_at || new Date(),
                updated_at: task.updated_at || new Date()
            }
        });
    }

    /**
     * Bulk index tasks
     * @param {Array} tasks - Array of task objects
     * @returns {Promise<{success: number, errors: number}>}
     */
    static async bulkIndexTasks(tasks) {
        if (!tasks || tasks.length === 0) {
            return { success: 0, errors: 0 };
        }

        const body = tasks.flatMap(task => {
            if (!task || !task._id) {
                return [];
            }
            return [
                {
                    index: {
                        _index: ElasticsearchProvider.indexName,
                        _id: task._id.toString()
                    }
                },
                {
                    // Don't include _id in document body - it's metadata, set in index._id above
                    tenant_id: task.tenant_id ? task.tenant_id.toString() : null,
                    project_id: task.project_id ? task.project_id.toString() : null,
                    sprint_id: task.sprint_id ? task.sprint_id.toString() : null,
                    name: task.name || '',
                    description: task.description || '',
                    task_code: task.task_code || '',
                    // Only index status/priority if they have values (not empty string)
                    status: (task.status && task.status.trim()) ? task.status : null,
                    priority: (task.priority && task.priority.trim()) ? task.priority : null,
                    assignee: task.assignee || '',
                    tags: task.tags || [],
                    isactive: task.isactive !== undefined ? task.isactive : true,
                    created_at: task.created_at || new Date(),
                    updated_at: task.updated_at || new Date()
                }
            ];
        });

        if (body.length === 0) {
            return { success: 0, errors: 0 };
        }

        const response = await ElasticsearchProvider.client.bulk({ body });

        let success = 0;
        let errors = 0;

        // Handle both ES 7.x and 8.x response formats
        // ES 8.x: response.items directly
        // ES 7.x: response.body.items
        const items = response.items || response.body?.items || [];

        items.forEach((item, idx) => {
            // ES 8.x format: item.index, item.create, etc.
            // ES 7.x format: same
            const indexResult = item.index || item.create || {};
            if (indexResult.error) {
                errors++;
                if (idx < 2) { // Only log first 2 errors to avoid spam
                    const errorMsg = indexResult.error.reason || indexResult.error.message || JSON.stringify(indexResult.error);
                    console.error(`[ElasticsearchProvider.bulkIndexTasks] Error indexing task ${idx + 1}:`, errorMsg);
                }
            } else if (indexResult.status >= 200 && indexResult.status < 300) {
                // Success: status 200-299
                success++;
            } else if (indexResult._id) {
                // Has _id means success
                success++;
            } else {
                // Unknown status, count as error
                errors++;
                if (idx < 2) {
                    console.warn(`[ElasticsearchProvider.bulkIndexTasks] Unknown status for task ${idx + 1}:`, indexResult);
                }
            }
        });

        if (errors > 0) {
            console.warn(`[ElasticsearchProvider.bulkIndexTasks] Indexed ${success} tasks, ${errors} errors`);
        } else {
            console.log(`[ElasticsearchProvider.bulkIndexTasks] Successfully indexed ${success} tasks`);
        }

        return { success, errors };
    }

    /**
     * Search tasks
     * @param {Object} query - Search query object
     * @returns {Promise<{tasks: Array, total: number}>}
     */
    static async searchTasks(query) {
        const {
            tenant_id,
            project_id,
            sprint_id,
            status,
            priority,
            assignee,
            isactive,
            searchText,
            top = 100,
            offset = 0,
            sort = { created_at: 'desc' }
        } = query;

        const must = [];
        const should = [];

        // Required filters
        if (tenant_id) {
            must.push({ term: { tenant_id: tenant_id.toString() } });
        }

        if (project_id) {
            must.push({ term: { project_id: project_id.toString() } });
        }

        if (sprint_id) {
            must.push({ term: { sprint_id: sprint_id.toString() } });
        }

        if (status) {
            must.push({ term: { status: status } });
        }

        if (priority) {
            must.push({ term: { priority: priority } });
        }

        if (assignee) {
            must.push({ term: { assignee: assignee } });
        }

        if (isactive !== undefined) {
            must.push({ term: { isactive: isactive } });
        }

        // Parse priority and status from searchText (similar to MongoDB fallback)
        let remainingSearchText = searchText ? searchText.trim() : '';
        let parsedPriority = null;
        let parsedStatus = null;

        if (remainingSearchText) {
            const priorityMap = {
                'urgent': 'urgent', 'nghiêm trọng': 'urgent', 'critical': 'urgent',
                'high': 'high', 'cao': 'high', 'quan trọng': 'high',
                'medium': 'medium', 'trung bình': 'medium',
                'normal': 'normal', 'bình thường': 'normal', // MongoDB uses "normal" for "bình thường"
                'low': 'low', 'thấp': 'low'
            };
            const statusMap = {
                'todo': 'todo', 'to do': 'todo', 'chưa làm': 'todo', 'chưa bắt đầu': 'todo',
                'planning': 'planning', 'lên kế hoạch': 'planning', 'kế hoạch': 'planning',
                'in progress': 'in_progress', 'in_progress': 'in_progress', 'đang làm': 'in_progress', 'đang thực hiện': 'in_progress',
                'at risk': 'at_risk', 'at_risk': 'at_risk', 'rủi ro': 'at_risk', 'có rủi ro': 'at_risk',
                'update required': 'update_required', 'update_required': 'update_required', 'cần cập nhật': 'update_required',
                'on hold': 'on_hold', 'on_hold': 'on_hold', 'tạm dừng': 'on_hold', 'hoãn': 'on_hold',
                'done': 'done', 'complete': 'done', 'completed': 'done', 'hoàn thành': 'done', 'xong': 'done',
                'cancelled': 'cancelled', 'cancel': 'cancelled', 'hủy': 'cancelled', 'đã hủy': 'cancelled'
            };

            const searchLower = remainingSearchText.toLowerCase();

            // Try exact match first
            parsedPriority = priorityMap[searchLower];
            parsedStatus = statusMap[searchLower];

            if (parsedPriority || parsedStatus) {
                // Exact match found, remove from search text
                remainingSearchText = '';
            } else {
                // Try to find keywords in text (prefer longer matches)
                const priorityKeywords = Object.keys(priorityMap).sort((a, b) => b.length - a.length);
                for (const keyword of priorityKeywords) {
                    if (searchLower.includes(keyword)) {
                        parsedPriority = priorityMap[keyword];
                        remainingSearchText = remainingSearchText.replace(new RegExp(keyword, 'gi'), '').trim();
                        break;
                    }
                }

                const statusKeywords = Object.keys(statusMap).sort((a, b) => b.length - a.length);
                for (const keyword of statusKeywords) {
                    if (searchLower.includes(keyword)) {
                        parsedStatus = statusMap[keyword];
                        remainingSearchText = remainingSearchText.replace(new RegExp(keyword, 'gi'), '').trim();
                        break;
                    }
                }
            }

            // Add parsed priority/status to must filters (override if already set in query)
            if (parsedPriority) {
                console.log(`[ElasticsearchProvider.searchTasks] Parsed priority from "${searchText}": ${parsedPriority}`);
                // Use term query for exact match on keyword field
                // Also ensure priority field exists and is not empty
                must.push({
                    bool: {
                        must: [
                            { exists: { field: 'priority' } },
                            { term: { priority: parsedPriority } }
                        ]
                    }
                });
            }
            if (parsedStatus) {
                console.log(`[ElasticsearchProvider.searchTasks] Parsed status from "${searchText}": ${parsedStatus}`);
                must.push({
                    bool: {
                        must: [
                            { exists: { field: 'status' } },
                            { term: { status: parsedStatus } }
                        ]
                    }
                });
            }
            if (remainingSearchText && remainingSearchText.trim() !== searchText.trim()) {
                console.log(`[ElasticsearchProvider.searchTasks] Remaining search text after parsing: "${remainingSearchText}"`);
            }
        }

        // Full-text search (include priority and status fields for fuzzy matching)
        if (remainingSearchText && remainingSearchText.trim()) {
            should.push({
                multi_match: {
                    query: remainingSearchText.trim(),
                    fields: ['name^3', 'description^2', 'task_code^2', 'tags', 'priority^2', 'status^2'],
                    type: 'best_fields',
                    fuzziness: 'AUTO'
                }
            });
        } else if (searchText && searchText.trim() && !parsedPriority && !parsedStatus) {
            // If no priority/status parsed, search in all fields including priority/status
            should.push({
                multi_match: {
                    query: searchText.trim(),
                    fields: ['name^3', 'description^2', 'task_code^2', 'tags', 'priority^2', 'status^2'],
                    type: 'best_fields',
                    fuzziness: 'AUTO'
                }
            });
        }

        // Build query - only add should/minimum_should_match if we have searchText
        const boolQuery = {
            must: must
        };

        if (should.length > 0) {
            boolQuery.should = should;
            boolQuery.minimum_should_match = 1;
        }

        const esQuery = {
            index: ElasticsearchProvider.indexName,
            body: {
                query: {
                    bool: boolQuery
                },
                size: top,
                from: offset,
                sort: Object.keys(sort).map(key => {
                    // Handle both number (-1, 1) and string ('desc', 'asc') formats
                    const sortValue = sort[key];
                    if (sortValue === -1 || sortValue === 'desc' || sortValue === 'DESC') {
                        return { [key]: 'desc' };
                    } else {
                        return { [key]: 'asc' };
                    }
                })
            }
        };

        console.log(`[ElasticsearchProvider.searchTasks] ES Query:`, JSON.stringify(esQuery.body, null, 2));

        const response = await ElasticsearchProvider.client.search(esQuery);

        // Handle both ES 7.x and 8.x response formats
        // ES 8.x: response.hits directly
        // ES 7.x: response.body.hits
        const hits = response.hits || response.body?.hits || {};
        const hitsArray = hits.hits || [];

        const tasks = hitsArray.map(hit => ({
            _id: hit._id,
            _score: hit._score || 0,
            ...(hit._source || {})
        }));

        // Handle both ES 7.x and 8.x total formats
        let total = 0;
        if (hits.total) {
            if (typeof hits.total === 'object' && hits.total.value !== undefined) {
                // ES 8.x format: { value: 10, relation: 'eq' }
                total = hits.total.value;
            } else if (typeof hits.total === 'number') {
                // ES 7.x format: 10
                total = hits.total;
            }
        }

        return {
            tasks: tasks,
            total: total
        };
    }

    /**
     * Delete a task from index
     * @param {String} taskId - Task ID
     * @returns {Promise<void>}
     */
    static async deleteTask(taskId) {
        try {
            await ElasticsearchProvider.client.delete({
                index: ElasticsearchProvider.indexName,
                id: taskId.toString()
            });
        } catch (error) {
            // Ignore if document doesn't exist
            if (error.meta?.statusCode !== 404) {
                throw error;
            }
        }
    }
}

module.exports = { ElasticsearchProvider };
