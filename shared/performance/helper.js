

const { checkpoint } = require('./Performance.middleware');


async function track(reqOrBody, name, data = {}) {
    // Handle both req object and body object (body có _performanceId từ req)
    let perfId = reqOrBody._performanceId;
    
    // Fallback: nếu body không có _performanceId nhưng có _service (từ MultiTenant)
    // thì lấy từ global tracker (sẽ implement sau nếu cần)
    if (!perfId && reqOrBody.body && reqOrBody.body._performanceId) {
        // reqOrBody là req object
        perfId = reqOrBody.body._performanceId;
    }
    
    if (perfId) {
        const { PerformanceTracker } = require('./performance.tracker');
        await PerformanceTracker.checkpoint(perfId, name, data);
    } else {
        // Debug: log warning nếu không tìm thấy performance ID
        console.warn('[Performance] Warning: No _performanceId found in request/body. Checkpoint skipped:', name);
    }
}

/**
 * Wrapper function để tự động track function execution time
 * 
 * @param {object} reqOrBody - Request object hoặc body object
 * @param {string} name - Tên operation
 * @param {function} fn - Function cần track (async hoặc sync)
 * @returns {Promise|any} Kết quả của function
 * 
 * @example
 * const { trackAsync } = require('../../../shared/performance/helper');
 * 
 * async function loadTasks(body) {
 *   const tasks = await trackAsync(body, 'Load Tasks from DB', async () => {
 *     return await TaskModel.find({});
 *   });
 *   
 *   return tasks;
 * }
 */
async function trackAsync(reqOrBody, name, fn) {
    track(reqOrBody, `${name} - Start`);
    
    try {
        const result = await fn();
        
        // Add result metadata if available
        let metadata = {};
        if (Array.isArray(result)) {
            metadata.count = result.length;
        } else if (result && typeof result === 'object') {
            metadata.type = result.constructor.name;
        }
        
        track(reqOrBody, `${name} - Completed`, metadata);
        return result;
    } catch (error) {
        track(reqOrBody, `${name} - Error`, { error: error.message });
        throw error;
    }
}

/**
 * Tạo một scoped tracker cho một operation phức tạp
 * 
 * @param {object} reqOrBody - Request object hoặc body object
 * @param {string} operationName - Tên operation
 * @returns {object} Scoped tracker với các method tiện dụng
 * 
 * @example
 * const { createScope } = require('../../../shared/performance/helper');
 * 
 * async function processTask(body) {
 *   const scope = createScope(body, 'Process Task');
 *   
 *   scope.start();
 *   
 *   const task = await getTask();
 *   scope.checkpoint('Fetched Task');
 *   
 *   await updateTask(task);
 *   scope.checkpoint('Updated Task');
 *   
 *   scope.end();
 *   return task;
 * }
 */
function createScope(reqOrBody, operationName) {
    return {
        start: () => track(reqOrBody, `${operationName} - Started`),
        checkpoint: (name, data) => track(reqOrBody, `${operationName}: ${name}`, data),
        end: (data) => track(reqOrBody, `${operationName} - Completed`, data),
        error: (error) => track(reqOrBody, `${operationName} - Error`, { error: error.message }),
    };
}

module.exports = {
    track,
    trackAsync,
    createScope,
};