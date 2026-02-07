// shared/queu/queue.const.js
const {
    QUEUE_OCR_PROCESSING_NAME,
    QUEUE_CONCURRENCY,
    QUEUE_MAX_ATTEMPTS,
    QUEUE_REMOVE_ON_COMPLETE,
    QUEUE_REMOVE_ON_FAIL,
    QUEUE_JOB_TIMEOUT,
    QUEUE_OCR_PROCESSING_NAME_LANDINGPAGE,
    QUEUE_CONCURRENCY_LANDINGPAGE,
    QUEUE_MAX_ATTEMPTS_LANDINGPAGE,
    QUEUE_REMOVE_ON_COMPLETE_LANDINGPAGE,
    QUEUE_REMOVE_ON_FAIL_LANDINGPAGE,
    QUEUE_JOB_TIMEOUT_LANDINGPAGE
} = process.env;

// Job Types - camelCase format
const jobTypes = {
    // OCR related
    ocrProcessDocument: 'ocr-process-document',
   
    ocrProcessTable: 'ocr-process-table',
    ocrExtractText: 'ocr-extract-text',
    
    // Email related (future)
    emailSendNotification: 'email-send-notification',
    emailSendReport: 'email-send-report',
    
    // Report related (future)
    reportGeneratePdf: 'report-generate-pdf',
    reportGenerateExcel: 'report-generate-excel',
    
    // File processing (future)
    fileCompress: 'file-compress',
    fileConvert: 'file-convert'
};

const jobTypes_Landingpage = {
 ocrProcessDocumentLandingPage: 'ocr-process-document-landing-page',
}
// Job Status - camelCase format
const jobStatus = {
    waiting: 'waiting',
    active: 'active',
    completed: 'completed',
    failed: 'failed',
    delayed: 'delayed',
    paused: 'paused'
};

// Queue Events - camelCase format
const queueEvents = {
    completed: 'completed',
    failed: 'failed',
    stalled: 'stalled',
    progress: 'progress',
    active: 'active',
    waiting: 'waiting',
    paused: 'paused',
    resumed: 'resumed'
};

// Job Priority - camelCase format
const jobPriority = {
    low: 1,
    normal: 5,
    high: 10,
    critical: 15
};

// Job Configs - camelCase format
const jobConfigs = {
    [jobTypes.ocrProcessDocument]: {
        concurrency: parseInt(QUEUE_CONCURRENCY) || 4,
        timeout: parseInt(QUEUE_JOB_TIMEOUT) || 6000000,
        priority: jobPriority.normal,
        attempts: 1,
        removeOnFail: 0
    },
    [jobTypes.ocrProcessTable]: {
        concurrency: 2,
        timeout: 90000,
        priority: jobPriority.high,
        attempts: 3
    },
    [jobTypes.ocrExtractText]: {
        concurrency: 4,
        timeout: 45000,
        priority: jobPriority.normal,
        attempts: 3
    },
    [jobTypes.emailSendNotification]: {
        concurrency: 10,
        timeout: 30000,
        priority: jobPriority.low,
        attempts: 5
    },
    [jobTypes.reportGeneratePdf]: {
        concurrency: 1,
        timeout: 180000,
        priority: jobPriority.high,
        attempts: 2
    },
    [jobTypes.fileCompress]: {
        concurrency: 3,
        timeout: 120000,
        priority: jobPriority.normal,
        attempts: 2
    }
};

const jobConfigs_Landingpage ={
    [jobTypes_Landingpage.ocrProcessDocumentLandingPage]: {
        concurrency: parseInt(QUEUE_CONCURRENCY_LANDINGPAGE) || 1,
        timeout: parseInt(QUEUE_JOB_TIMEOUT_LANDINGPAGE) || 6000000,
        priority: jobPriority.normal,
        attempts: parseInt(QUEUE_MAX_ATTEMPTS_LANDINGPAGE) || 3
    }
}

// Helper functions - camelCase format
const helperFunctions = {
    getJobConfig: (jobType) => {
        return jobConfigs[jobType] || {
            concurrency: 3,
            timeout: 60000,
            priority: jobPriority.normal,
            attempts: 3
        };
    },

    isValidJobType: (jobType) => {
        return Object.values(jobTypes).includes(jobType);
    },

    isValidJobStatus: (status) => {
        return Object.values(jobStatus).includes(status);
    },

    getRedisConfig: () => ({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
        db: parseInt(process.env.REDIS_DB) || 0
    }),

    getDefaultJobOptions: (customOptions = {}) => ({
        attempts: 1,
        removeOnComplete: parseInt(QUEUE_REMOVE_ON_COMPLETE) || 20,
        removeOnFail: 0,
        timeout: parseInt(QUEUE_JOB_TIMEOUT) || 60000,
        backoff: false,
        ...customOptions
    }),
    getJobConfig_Landingpage: (jobType) => {
        return jobConfigs_Landingpage[jobType] || {
            concurrency: 3,
            timeout: 60000,
            priority: jobPriority.normal,
            attempts: 3
        };
    },

    isValidJobType_Landingpage: (jobType) => {
        return Object.values(jobTypes_Landingpage).includes(jobType);
    },
    getDefaultJobOptions_Landingpage: (customOptions = {}) => ({
        attempts: parseInt(QUEUE_MAX_ATTEMPTS_LANDINGPAGE) || 3,
        removeOnComplete: parseInt(QUEUE_REMOVE_ON_COMPLETE_LANDINGPAGE) || 20,
        removeOnFail: parseInt(QUEUE_REMOVE_ON_FAIL_LANDINGPAGE) || 10,
        timeout: parseInt(QUEUE_JOB_TIMEOUT_LANDINGPAGE) || 60000,
        backoff: {
            type: 'exponential',
            delay: 2000
        },
        ...customOptions
    })
};

// Main QueueConst object - contains everything
var obj = {
    // Original properties (backward compatibility)
    queueOcrProcessingName: QUEUE_OCR_PROCESSING_NAME || 'ocr-processing',
    queueOcrProcessingName_LandingPage: QUEUE_OCR_PROCESSING_NAME_LANDINGPAGE || 'ocr-processing-landing-page',

    queueConcurrency: parseInt(QUEUE_CONCURRENCY) || 3,
    queueMaxAttempts: parseInt(QUEUE_MAX_ATTEMPTS) || 3,
    queueRemoveOnComplete: parseInt(QUEUE_REMOVE_ON_COMPLETE) || 20,
    queueRemoveOnFail: parseInt(QUEUE_REMOVE_ON_FAIL) || 10,
    queueJobTimeout: parseInt(QUEUE_JOB_TIMEOUT) || 60000,

    queueConcurrency_LandingPage: parseInt(QUEUE_CONCURRENCY_LANDINGPAGE) || 3,
    queueMaxAttempts_LandingPage: parseInt(QUEUE_MAX_ATTEMPTS_LANDINGPAGE) || 3,
    queueRemoveOnComplete_LandingPage: parseInt(QUEUE_REMOVE_ON_COMPLETE_LANDINGPAGE) || 20,
    queueRemoveOnFail_LandingPage: parseInt(QUEUE_REMOVE_ON_FAIL_LANDINGPAGE) || 10,
    queueJobTimeout_LandingPage: parseInt(QUEUE_JOB_TIMEOUT_LANDINGPAGE) || 60000,

    // New properties - all in camelCase
    jobTypes: jobTypes,
    jobTypes_Landingpage: jobTypes_Landingpage,
    jobStatus: jobStatus,
    queueEvents: queueEvents,
    jobPriority: jobPriority,
    jobConfigs: jobConfigs,
    jobConfigs_Landingpage: jobConfigs_Landingpage,
    
    // Helper functions
    getJobConfig: helperFunctions.getJobConfig,
    isValidJobType: helperFunctions.isValidJobType,
    getJobConfig_Landingpage: helperFunctions.getJobConfig_Landingpage,
    isValidJobType_Landingpage: helperFunctions.isValidJobType_Landingpage,
    isValidJobStatus: helperFunctions.isValidJobStatus,
    getRedisConfig: helperFunctions.getRedisConfig,
    getDefaultJobOptions: helperFunctions.getDefaultJobOptions,
    getDefaultJobOptions_Landingpage: helperFunctions.getDefaultJobOptions_Landingpage,

    // Environment configs
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB) || 0
    },

    // Default configurations
    defaults: {
        concurrency: parseInt(QUEUE_CONCURRENCY) || 3,
        attempts: parseInt(QUEUE_MAX_ATTEMPTS) || 3,
        timeout: parseInt(QUEUE_JOB_TIMEOUT) || 60000,
        removeOnComplete: parseInt(QUEUE_REMOVE_ON_COMPLETE) || 20,
        removeOnFail: parseInt(QUEUE_REMOVE_ON_FAIL) || 10,
        backoffType: 'exponential',
        backoffDelay: 2000
    }
};

const retryConfigs = {
    ocr_processing: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: 10,
        removeOnFail: 5
    },
    ocr_processing_critical: {
        attempts: 5,
        backoff: {
            type: 'exponential', 
            delay: 2000
        },
        removeOnComplete: 20,
        removeOnFail: 10
    }
}

// Export main object
exports.QueueConst = obj;

// Export individual components (backward compatibility + convenience)
exports.jobTypes = jobTypes;
exports.jobTypes_Landingpage = jobTypes_Landingpage;
exports.jobStatus = jobStatus;
exports.queueEvents = queueEvents;
exports.jobPriority = jobPriority;
exports.jobConfigs_Landingpage = jobConfigs_Landingpage;
exports.retryConfigs =retryConfigs;
// Export helper functions
exports.getJobConfig = helperFunctions.getJobConfig;
exports.isValidJobType = helperFunctions.isValidJobType;
exports.getJobConfig_Landingpage = helperFunctions.getJobConfig_Landingpage;
exports.isValidJobType_Landingpage = helperFunctions.isValidJobType_Landingpage;
exports.isValidJobStatus = helperFunctions.isValidJobStatus;
exports.getRedisConfig = helperFunctions.getRedisConfig;
exports.getDefaultJobOptions = helperFunctions.getDefaultJobOptions;
exports.getDefaultJobOptions_Landingpage = helperFunctions.getDefaultJobOptions_Landingpage;