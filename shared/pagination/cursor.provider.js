/**
 * Cursor-based Pagination Provider
 * Implements keyset pagination for stable, performant pagination
 */

class CursorProvider {
    constructor() {}

    /**
     * Encode cursor from last task data
     * @param {Object} data - Last task data { _id, sortField, sortValue }
     * @returns {string} Base64 encoded cursor
     */
    encodeCursor(data) {
        if (!data || !data._id) {
            return null;
        }

        try {
            const cursorData = {
                lastId: data._id.toString ? data._id.toString() : String(data._id),
                lastSortKey: data._sort_key || this._buildSortKey(data),
                timestamp: Date.now() // For debugging/validation
            };

            const jsonString = JSON.stringify(cursorData);
            return Buffer.from(jsonString).toString('base64');
        } catch (error) {
            console.error('[CursorProvider.encodeCursor] Error:', error);
            return null;
        }
    }

    /**
     * Decode cursor to get pagination data
     * @param {string} cursor - Base64 encoded cursor
     * @returns {Object|null} Decoded cursor data or null if invalid
     */
    decodeCursor(cursor) {
        if (!cursor || typeof cursor !== 'string') {
            return null;
        }

        try {
            const jsonString = Buffer.from(cursor, 'base64').toString('utf-8');
            const data = JSON.parse(jsonString);

            // Validate cursor data
            if (!data.lastId || !data.lastSortKey) {
                console.warn('[CursorProvider.decodeCursor] Invalid cursor data:', data);
                return null;
            }

            return data;
        } catch (error) {
            console.error('[CursorProvider.decodeCursor] Error:', error);
            return null;
        }
    }

    /**
     * Build composite sort key for stable pagination
     * Format: "{sortFieldValue}_{taskId}" for unique, sortable key
     * @param {Object} task - Task object
     * @param {Object} sortConfig - Sort configuration { field, order }
     * @returns {string} Composite sort key
     */
    buildSortKey(task, sortConfig) {
        if (!task || !sortConfig || !sortConfig.field) {
            return `${task._id}`;
        }

        const sortField = sortConfig.field;
        let sortValue = task[sortField];

        // Handle different field types
        if (sortValue === null || sortValue === undefined) {
            // Null values go to end (for desc) or beginning (for asc)
            sortValue = sortConfig.order === 'desc' ? '9999999999999' : '0';
        } else if (sortValue instanceof Date) {
            sortValue = sortValue.getTime();
        } else if (typeof sortValue === 'string') {
            // Normalize string for sorting (lowercase, trim)
            sortValue = sortValue.toLowerCase().trim();
        } else if (typeof sortValue === 'number') {
            // Keep number as is
            sortValue = sortValue;
        } else {
            // Convert to string for other types
            sortValue = String(sortValue);
        }

        // Build composite key: sortValue_taskId
        // This ensures stable sorting even when sort values are equal
        const taskId = task._id.toString ? task._id.toString() : String(task._id);
        return `${sortValue}_${taskId}`;
    }

    /**
     * Build sort key from existing task data (for backward compatibility)
     * @param {Object} task - Task object
     * @returns {string} Sort key
     */
    _buildSortKey(task) {
        // Default to updated_at if available, otherwise use _id
        if (task.updated_at) {
            return `${task.updated_at}_${task._id}`;
        }
        if (task.created_at) {
            return `${task.created_at}_${task._id}`;
        }
        return `${task._id}`;
    }

    /**
     * Add cursor condition to MongoDB query
     * @param {Object} query - MongoDB query object
     * @param {Object} cursorData - Decoded cursor data
     * @param {Object} sortConfig - Sort configuration { field, order }
     * @param {string} direction - 'next' or 'prev'
     * @returns {Object} Updated query with cursor condition
     */
    addCursorCondition(query, cursorData, sortConfig, direction = 'next') {
        if (!cursorData || !sortConfig) {
            return query;
        }

        const sortField = sortConfig.field;
        const sortOrder = sortConfig.order === 'desc' ? -1 : 1;

        // Parse sort key to get sort value
        const sortKeyParts = cursorData.lastSortKey.split('_');
        const lastSortValue = sortKeyParts[0];
        const lastTaskId = sortKeyParts[1] || cursorData.lastId;

        // Build cursor condition based on direction and sort order
        if (direction === 'next') {
            if (sortOrder === -1) {
                // Descending: get items less than cursor
                query.$or = [
                    { [sortField]: { $lt: this._parseSortValue(lastSortValue, sortField) } },
                    {
                        [sortField]: this._parseSortValue(lastSortValue, sortField),
                        _id: { $gt: require('mongodb').ObjectID(lastTaskId) }
                    }
                ];
            } else {
                // Ascending: get items greater than cursor
                query.$or = [
                    { [sortField]: { $gt: this._parseSortValue(lastSortValue, sortField) } },
                    {
                        [sortField]: this._parseSortValue(lastSortValue, sortField),
                        _id: { $gt: require('mongodb').ObjectID(lastTaskId) }
                    }
                ];
            }
        } else {
            // Previous page (reverse direction)
            if (sortOrder === -1) {
                // Descending: get items greater than cursor
                query.$or = [
                    { [sortField]: { $gt: this._parseSortValue(lastSortValue, sortField) } },
                    {
                        [sortField]: this._parseSortValue(lastSortValue, sortField),
                        _id: { $lt: require('mongodb').ObjectID(lastTaskId) }
                    }
                ];
            } else {
                // Ascending: get items less than cursor
                query.$or = [
                    { [sortField]: { $lt: this._parseSortValue(lastSortValue, sortField) } },
                    {
                        [sortField]: this._parseSortValue(lastSortValue, sortField),
                        _id: { $lt: require('mongodb').ObjectID(lastTaskId) }
                    }
                ];
            }
        }

        return query;
    }

    /**
     * Parse sort value from string back to original type
     * @param {string} value - String value
     * @param {string} field - Field name
     * @returns {*} Parsed value
     */
    _parseSortValue(value, field) {
        // Try to parse as number first (for timestamps, numbers)
        if (!isNaN(value) && value !== '') {
            const numValue = Number(value);
            if (field === 'created_at' || field === 'updated_at' || field === 'due_date') {
                return numValue; // Timestamp
            }
            if (field === 'priority') {
                // Priority might be numeric in some systems
                return numValue;
            }
        }

        // Return as string for text fields
        return value;
    }

    /**
     * Build MongoDB sort object for stable pagination
     * Always includes _id as secondary sort for stability
     * @param {Object} sortConfig - Sort configuration { field, order }
     * @returns {Object} MongoDB sort object
     */
    buildSortObject(sortConfig) {
        if (!sortConfig || !sortConfig.field) {
            return { created_at: -1, _id: 1 };
        }

        const sortField = sortConfig.field;
        const sortOrder = sortConfig.order === 'desc' ? -1 : 1;

        return {
            [sortField]: sortOrder,
            _id: 1 // Secondary sort for stability
        };
    }
}

module.exports = {
    CursorProvider: new CursorProvider()
};




