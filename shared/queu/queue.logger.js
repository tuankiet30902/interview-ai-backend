class QueueLogger {
    constructor() {}
    static logJobEvent(event, jobId, jobType, extra = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            service: 'e-document-queue',
            event,
            jobId,
            jobType,
            ...extra
        };
        
        console.log(`[QUEUE] ${JSON.stringify(logData)}`);
    }
    
    static logError(jobId, jobType, error, extra = {}) {
        const errorData = {
            timestamp: new Date().toISOString(),
            service: 'e-document-queue',
            event: 'job_error',
            jobId,
            jobType,
            error: error.message,
            stack: error.stack?.substring(0, 500), // Limit stack trace
            ...extra
        };
        
        console.log(`[QUEUE_ERROR] ${JSON.stringify(errorData)}`);
    }
    
    static logQueueHealth(queueName, stats) {
        console.log(`[QUEUE_HEALTH] ${queueName}:`, JSON.stringify(stats));
    }
}

// exports.QueueLogger = new QueueLogger();
module.exports = { QueueLogger };