// shared/queu/queue.provider.js - RabbitMQ Version
const q = require('q');
const amqp = require('amqplib');
const { QueueConst } = require('./queue.const');

class QueueProvider {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.queue = null;
        this.queue_landingpage = null;
        this.processors = new Map();
        this.isInitialized = false;
        this.isProcessing = false;
        
        // Queue names
        this.mainQueueName = 'ocr-processing';
        this.landingQueueName = 'ocr-processing-landing-page';
        this.mainDLQName = 'ocr-processing-dlq';
        this.landingDLQName = 'ocr-processing-landing-page-dlq';
        
        // Stats tracking
        this.stats = {
            main_queue: { waiting: 0, active: 0, completed: 0, failed: 0 },
            landingpage_queue: { waiting: 0, active: 0, completed: 0, failed: 0 }
        };
    }

    // Initialize queue - PHẢI chạy trước khi dùng
    init() {
        const dfd = q.defer();
        
        try {
            const connectionUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost';
            
            console.log('[QueueProvider] Connecting to RabbitMQ...');
            
            amqp.connect(connectionUrl)
                .then(connection => {
                    this.connection = connection;
                    return connection.createChannel();
                })
                .then(channel => {
                    this.channel = channel;
                    return this.setupQueues();
                })
                .then(() => {
                    console.log(`[QueueProvider] ✅ RabbitMQ initialized`);
                    console.log(`📊 Dashboard: http://localhost:15672`);
                    console.log(`🔍 Queues: ${this.mainQueueName}, ${this.landingQueueName}`);
                    
                    this.isInitialized = true;
                    this.setupEventHandlers();
                    dfd.resolve(true);
                })
                .catch(error => {
                    console.log('[QueueProvider] ❌ RabbitMQ initialization failed:', error);
                    dfd.reject(error);
                });
            
        } catch (error) {
            console.log('[QueueProvider] Initialization failed:', error);
            dfd.reject(error);
        }

        return dfd.promise;
    }

    // Setup queues with dead letter support
    async setupQueues() {
        // Setup main queue with Single Active Consumer
        // const queue_concurrency = QueueConst.getJobConfig(QueueConst.jobTypes.ocrProcessDocument).concurrency;
        // const queue_concurrency_landing = QueueConst.getJobConfig_Landingpage(QueueConst.jobTypes_Landingpage.ocrProcessDocumentLandingPage).concurrency;
        // await this.connection.prefetch(queue_concurrency+queue_concurrency_landing);
        await this.channel.assertQueue(this.mainQueueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': this.mainDLQName,
                'x-message-ttl': 600000, // 10 minutes timeout
                // 'x-single-active-consumer': true //
            }
        });
        
        await this.channel.assertQueue(this.mainDLQName, { durable: true });

        // Setup landing page queue with Single Active Consumer
        await this.channel.assertQueue(this.landingQueueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': this.landingDLQName,
                'x-message-ttl': 600000,
                // 'x-single-active-consumer': true 
            }
        });
        
        await this.channel.assertQueue(this.landingDLQName, { durable: true });
        // console.log("queue_concurrency+queue_concurrency_landing",queue_concurrency+queue_concurrency_landing);
        // Set prefetch = 1 for sequential processing
        // await this.channel.prefetch(queue_concurrency+queue_concurrency_landing);
        
        console.log('[QueueProvider] Queues setup complete (Single Active Consumer + Sequential processing)');
    }

    // Setup event handlers for Bull compatibility
    setupEventHandlers() {
        // Connection events
        this.connection.on('error', (error) => {
            console.log('[QueueProvider] ❌ Connection error:', error);
        });

        this.connection.on('close', () => {
            console.log('[QueueProvider] Connection closed');
        });

        // Channel events
        this.channel.on('error', (error) => {
            console.log('[QueueProvider] ❌ Channel error:', error);
        });

        this.channel.on('close', () => {
            console.log('[QueueProvider] Channel closed');
        });

        // Consumer events
        this.channel.on('return', (msg) => {
            console.log('[QueueProvider] 📤 Message returned:', msg);
        });

        this.channel.on('drain', () => {
            console.log('[QueueProvider] 💧 Channel drained');
        });
    }

    // Emulate Bull event listeners (for compatibility)
    setupEventListeners() {
        // This method exists for compatibility but RabbitMQ events are handled differently
        console.log('[QueueProvider] Event listeners setup (RabbitMQ mode)');
    }

    setupEventListeners_Landingpage() {
        // This method exists for compatibility but RabbitMQ events are handled differently  
        console.log('[QueueProvider] Landing page event listeners setup (RabbitMQ mode)');
    }

    // Register processor - Compatible with Bull interface
    registerProcessor(jobType, processorFunction, customConfig = {}) {
        const dfd = q.defer();

        try {
            if (!this.channel) {
                dfd.reject(new Error('Queue not initialized. Call init() first.'));
                return dfd.promise;
            }

            if (!QueueConst.isValidJobType(jobType)) {
                dfd.reject(new Error(`Invalid job type: ${jobType}`));
                return dfd.promise;
            }

            if (this.processors.has(jobType)) {
                console.warn(`[QueueProvider] Processor for ${jobType} already registered`);
                dfd.resolve(true);
                return dfd.promise;
            }

            // Get config from QueueConst
            const jobConfig = { ...QueueConst.getJobConfig(jobType), ...customConfig };

            // Wrap processor for RabbitMQ
            const wrappedProcessor = (job) => {
                const processorDfd = q.defer();
                
                console.log(`[${jobType}] Processing job ${job.id}`);
                
                // Add progress function to job (Bull compatibility)
                job.progress = (percent) => {
                    console.log(`📊 Job ${job.id} (${job.type}) progress: ${percent}%`);
                };
                
                job.progress(5);
                
                // Convert processor function to promise if needed
                q.when(processorFunction(job))
                    .then((result) => {
                        job.progress(100);
                        console.log(`[${jobType}] Job ${job.id} completed successfully`);
                        console.log(`✅ Job ${job.id} (${job.type}) completed`);
                        processorDfd.resolve(result);
                    })
                    .catch((error) => {
                        console.log(`[${jobType}] Job ${job.id} failed:`, error);
                        console.log(`❌ Job ${job.id} (${job.type}) failed:`, error.message);
                        processorDfd.reject(error);
                    });

                return processorDfd.promise;
            };

            // Store processor
            this.processors.set(jobType, { 
                processorFunction: wrappedProcessor, 
                config: jobConfig,
                registeredAt: new Date(),
                queueName: this.mainQueueName
            });
            
            console.log(`[QueueProvider] Processor registered: ${jobType} (concurrency: ${jobConfig.concurrency})`);
            
            // Auto start processing if not already started
            setTimeout(() => this.autoStartProcessing(), 100);
            
            dfd.resolve(true);
            
        } catch (error) {
            console.log('[QueueProvider] Failed to register processor:', error);
            dfd.reject(error);
        }

        return dfd.promise;
    }

    registerProcessor_Landingpage(jobType, processorFunction, customConfig = {}) {
        const dfd = q.defer();

        try {
            if (!this.channel) {
                dfd.reject(new Error('Queue not initialized. Call init() first.'));
                return dfd.promise;
            }

            if (!QueueConst.isValidJobType_Landingpage(jobType)) {
                dfd.reject(new Error(`Invalid job type: ${jobType}`));
                return dfd.promise;
            }

            if (this.processors.has(jobType)) {
                console.warn(`[QueueProvider] Processor for ${jobType} already registered`);
                dfd.resolve(true);
                return dfd.promise;
            }

            // Get config from QueueConst
            const jobConfig = { ...QueueConst.getJobConfig_Landingpage(jobType), ...customConfig };

            // Wrap processor for RabbitMQ
            const wrappedProcessor = (job) => {
                const processorDfd = q.defer();
                
                console.log(`[${jobType}] Processing job ${job.id}`);
                
                // Add progress function to job (Bull compatibility)
                job.progress = (percent) => {
                    console.log(`📊 Job ${job.id} (${job.type}) progress: ${percent}%`);
                };
                
                job.progress(5);
                
                q.when(processorFunction(job))
                    .then((result) => {
                        job.progress(100);
                        console.log(`[${jobType}] Job ${job.id} completed successfully`);
                        console.log(`✅ Job ${job.id} (${job.type}) completed`);
                        processorDfd.resolve(result);
                    })
                    .catch((error) => {
                        console.log(`[${jobType}] Job ${job.id} failed:`, error);
                        console.log(`❌ Job ${job.id} (${job.type}) failed:`, error.message);
                        processorDfd.reject(error);
                    });

                return processorDfd.promise;
            };

            // Store processor
            this.processors.set(jobType, { 
                processorFunction: wrappedProcessor, 
                config: jobConfig,
                registeredAt: new Date(),
                queueName: this.landingQueueName
            });
            
            console.log(`[QueueProvider] Processor registered: ${jobType} (concurrency: ${jobConfig.concurrency})`);
            
            // Auto start processing if not already started  
            setTimeout(() => this.autoStartProcessing(), 100);
            
            dfd.resolve(true);
            
        } catch (error) {
            console.log('[QueueProvider] Failed to register processor:', error);
            dfd.reject(error);
        }

        return dfd.promise;
    }

    // Start processing jobs
    startProcessing() {
        if (this.isProcessing) {
            console.log('[QueueProvider] Already processing');
            return q.resolve(true);
        }

        if (this.processors.size === 0) {
            console.log('[QueueProvider] ⚠️ No processors registered yet');
            return q.resolve(true);
        }

        this.isProcessing = true;
        console.log(`[QueueProvider] Starting job processing for ${this.processors.size} processors...`);

        // Start consumers for each registered processor
        this.processors.forEach((processorInfo, jobType) => {
            console.log(`[QueueProvider] Starting consumer for ${jobType}...`);
            this.startConsumer(jobType, processorInfo);
        });

        console.log('✅ All consumers started successfully');
        return q.resolve(true);
    }

    // Auto start processing when processors are registered
    autoStartProcessing() {
        if (!this.isProcessing && this.processors.size > 0) {
            console.log('[QueueProvider] 🚀 Auto-starting processing...');
            this.startProcessing();
        }
    }

    // Start consumer for specific job type
    startConsumer(jobType, processorInfo) {
        const queueName = processorInfo.queueName;
        const concurrency = processorInfo.config.concurrency || 1;
        console.log(`[QueueProvider] Starting consumer for ${jobType} on queue ${queueName} (Single Active Consumer mode)`);
        console.log("concurrency",concurrency);
        // Set prefetch = 1 for sequential processing
        this.channel.prefetch(concurrency, true)
            .then(() => {
                return this.channel.consume(queueName, async (msg) => {
                    if (msg) {
                        await this.processMessage(msg, jobType, processorInfo);
                    }
                }, { 
                    noAck: false  // Manual acknowledgment
                    // No exclusive flag needed - RabbitMQ handles Single Active Consumer automatically
                });
            })
            .then(() => {
                console.log(`✅ Consumer registered for ${jobType} with concurrency: ${concurrency}`);
            })
            .catch((error) => {
                console.error(`❌ Failed to start consumer for ${jobType}:`, error);
            });
    }

    // Process individual message
    processMessage(msg, jobType, processorInfo) {
        let job;
        
        try {
            job = JSON.parse(msg.content.toString());
            
            console.log(`🔄 [ACTIVE CONSUMER] Job ${job.id} started processing (Single Active Consumer mode)`);

            // Execute processor using q.when for promise handling
            q.when(processorInfo.processorFunction(job))
                .then((result) => {
                    // ✅ Only acknowledge after job is COMPLETELY done
                    this.channel.ack(msg);
                    
                    // Update stats
                    this.updateStats(processorInfo.queueName, 'completed');
                    
                    console.log(`✅ [ACTIVE CONSUMER] Job ${job.id} processing completed - ready for next job`);
                })
                .catch((error) => {
                    console.error(`❌ [ACTIVE CONSUMER] Processing failed for job ${job.id}:`, error.message);

                    // Get current attempt count
                    const attempts = (msg.properties.headers?.attempts || 0) + 1;
                    const maxAttempts = job?.maxAttempts || 3;

                    if (attempts < maxAttempts) {
                        // Retry: reject with requeue
                        console.log(`🔄 [ACTIVE CONSUMER] Job ${job.id} will be retried (attempt ${attempts}/${maxAttempts})`);
                        
                        // Update headers for retry
                        if (!msg.properties.headers) msg.properties.headers = {};
                        msg.properties.headers.attempts = attempts;
                        
                        this.channel.nack(msg, false, true); // Requeue for retry

                    } else {
                        // Max attempts reached: send to dead letter queue
                        console.log(`💀 [ACTIVE CONSUMER] Job ${job.id} failed permanently after ${attempts} attempts`);
                        this.channel.nack(msg, false, false); // Don't requeue (goes to DLQ)
                        
                        // Update stats
                        this.updateStats(processorInfo.queueName, 'failed');
                    }
                });

        } catch (error) {
            console.error(`❌ [ACTIVE CONSUMER] Error parsing job message:`, error.message);
            // Reject malformed message immediately
            this.channel.nack(msg, false, false);
        }
    }

    // Add job - Compatible with Bull interface
    addJob(jobType, jobData, customOptions = {}) {
        const dfd = q.defer();

        try {
            if (!this.channel) {
                dfd.reject(new Error('Queue not initialized. Call init() first.'));
                return dfd.promise;
            }

            if (!QueueConst.isValidJobType(jobType)) {
                dfd.reject(new Error(`Invalid job type: ${jobType}`));
                return dfd.promise;
            }

            // Get config from QueueConst
            const jobConfig = QueueConst.getJobConfig(jobType);
            
            // Create job object
            const jobId = this.generateJobId();
            const job = {
                id: jobId,
                type: jobType,
                data: jobData,
                attempts: 0,
                maxAttempts: jobConfig.attempts,
                priority: jobConfig.priority,
                createdAt: new Date().toISOString(),
                timestamp: Date.now()
            };

            const messageOptions = {
                persistent: true,
                priority: jobConfig.priority,
                messageId: jobId,
                timestamp: Date.now(),
                headers: {
                    jobType: jobType,
                    attempts: 0,
                    maxAttempts: job.maxAttempts
                }
            };

            this.channel.sendToQueue(
                this.mainQueueName,
                Buffer.from(JSON.stringify(job)),
                messageOptions
            );

            console.log(`[QueueProvider] Job ${jobId} (${jobType}) added to queue`);
            console.log(`⏳ Job ${jobId} is waiting in queue`);
            
            // Update stats
            this.updateStats(this.mainQueueName, 'waiting');

            dfd.resolve({
                jobId: jobId,
                jobType: jobType,
                status: QueueConst.jobStatus.waiting,
                priority: jobConfig.priority,
                createdAt: job.timestamp
            });
                
        } catch (error) {
            console.log('[QueueProvider] Failed to add job:', error);
            dfd.reject(error);
        }

        return dfd.promise;
    }

    addJob_landingpage(jobType, jobData, customOptions = {}) {
        const dfd = q.defer();

        try {
            if (!this.channel) {
                dfd.reject(new Error('Queue not initialized. Call init() first.'));
                return dfd.promise;
            }

            if (!QueueConst.isValidJobType_Landingpage(jobType)) {
                dfd.reject(new Error(`Invalid job type: ${jobType}`));
                return dfd.promise;
            }

            // Get config from QueueConst
            const jobConfig = QueueConst.getJobConfig_Landingpage(jobType);
            
            // Create job object
            const jobId = this.generateJobId();
            const job = {
                id: jobId,
                type: jobType,
                data: jobData,
                attempts: 0,
                maxAttempts: jobConfig.attempts,
                priority: jobConfig.priority,
                createdAt: new Date().toISOString(),
                timestamp: Date.now()
            };

            const messageOptions = {
                persistent: true,
                priority: jobConfig.priority,
                messageId: jobId,
                timestamp: Date.now(),
                headers: {
                    jobType: jobType,
                    attempts: 0,
                    maxAttempts: job.maxAttempts
                }
            };

            this.channel.sendToQueue(
                this.landingQueueName,
                Buffer.from(JSON.stringify(job)),
                messageOptions
            );

            console.log(`[QueueProvider] Job ${jobId} (${jobType}) added to queue`);
            console.log(`⏳ Job ${jobId} is waiting in queue`);
            
            // Update stats
            this.updateStats(this.landingQueueName, 'waiting');

            dfd.resolve({
                jobId: jobId,
                jobType: jobType,
                status: QueueConst.jobStatus.waiting,
                priority: jobConfig.priority,
                createdAt: job.timestamp
            });
                
        } catch (error) {
            console.log('[QueueProvider] Failed to add job:', error);
            dfd.reject(error);
        }

        return dfd.promise;
    }

    // Get job status - Simplified for RabbitMQ
    getJobStatus(jobId) {
        const dfd = q.defer();
        
        // RabbitMQ doesn't have direct job lookup like Bull
        // This is a simplified implementation
        dfd.resolve({
            jobId: jobId,
            jobType: 'unknown',
            status: 'unknown',
            progress: 0,
            data: {},
            result: null,
            error: null,
            attempts: 0,
            priority: 0,
            createdAt: Date.now(),
            processedAt: null,
            finishedAt: null
        });

        return dfd.promise;
    }

    getJobStatus_Landingpage(jobId) {
        // Same as above - simplified for RabbitMQ
        return this.getJobStatus(jobId);
    }

    // Get queue statistics
    getQueueStats() {
        const dfd = q.defer();
        
        if (!this.isInitialized) {
            dfd.reject(new Error('Queue not initialized'));
            return dfd.promise;
        }
        
        // Get real stats from RabbitMQ
        Promise.all([
            this.channel.checkQueue(this.mainQueueName),
            this.channel.checkQueue(this.landingQueueName),
            this.channel.checkQueue(this.mainDLQName),
            this.channel.checkQueue(this.landingDLQName)
        ])
        .then(([mainQueue, landingQueue, mainDLQ, landingDLQ]) => {
            dfd.resolve({
                main_queue: { 
                    waiting: mainQueue.messageCount,
                    active: 0, // RabbitMQ doesn't track this directly
                    completed: this.stats.main_queue.completed,
                    failed: mainDLQ.messageCount
                },
                landingpage_queue: { 
                    waiting: landingQueue.messageCount,
                    active: 0,
                    completed: this.stats.landingpage_queue.completed,
                    failed: landingDLQ.messageCount
                },
                timestamp: new Date().toISOString()
            });
        })
        .catch(error => {
            console.log('[QueueProvider] Failed to get stats:', error);
            dfd.resolve(this.stats);
        });
        
        return dfd.promise;
    }

    // Clear failed jobs
    clearFailedJobs() {
        const dfd = q.defer();
        
        Promise.all([
            this.channel.purgeQueue(this.mainDLQName),
            this.channel.purgeQueue(this.landingDLQName)
        ])
        .then(([mainCleared, landingCleared]) => {
            const totalCleared = mainCleared.messageCount + landingCleared.messageCount;
            console.log(`[QueueProvider] Failed jobs cleared: ${totalCleared}`);
            dfd.resolve(true);
        })
        .catch(dfd.reject);
        
        return dfd.promise;
    }

    // Convenience methods (unchanged for compatibility)
    addOCRJob(jobData, options = {}) {
        return this.addJob(QueueConst.jobTypes.ocrProcessDocument, jobData, options);
    }

    addOCRJob_Landingpage(jobData, options = {}) {
        return this.addJob_landingpage(QueueConst.jobTypes_Landingpage.ocrProcessDocumentLandingPage, jobData, options);
    }

    registerOCRProcessor(processorFunction, customConfig = {}) {
        return this.registerProcessor(QueueConst.jobTypes.ocrProcessDocument, processorFunction, customConfig);
    }

    registerOCRProcessor_LandingPage(processorFunction, customConfig = {}) {
        return this.registerProcessor_Landingpage(QueueConst.jobTypes_Landingpage.ocrProcessDocumentLandingPage, processorFunction, customConfig);
    }

    // Health check
    isQueueHealthy() {
        return this.connection && !this.connection.connection.destroyed;
    }

    isQueueHealthy_LandingPage() {
        return this.connection && !this.connection.connection.destroyed;
    }

    // Cleanup
    cleanup() {
        const dfd = q.defer();
        
        console.log('[QueueProvider] Cleaning up queue...');
        this.isProcessing = false;
        
        if (this.connection) {
            this.connection.close()
                .then(() => {
                    console.log('[QueueProvider] Queue closed');
                    this.connection = null;
                    this.channel = null;
                    this.processors.clear();
                    this.isInitialized = false;
                    dfd.resolve(true);
                })
                .catch((error) => {
                    console.log('[QueueProvider] Error closing queue:', error);
                    dfd.reject(error);
                });
        } else {
            this.connection = null;
            this.channel = null;
            this.processors.clear();
            this.isInitialized = false;
            dfd.resolve(true);
        }

        return dfd.promise;
    }

    // Setup dashboard - Placeholder for compatibility
    setupDashboard() {
        if (!this.isInitialized) {
            throw new Error('Queue must be initialized first');
        }
        
        console.log('[QueueProvider] Dashboard available at: http://localhost:15672');
        return { url: 'http://localhost:15672' };
    }

    // Remove stalled jobs - Not applicable to RabbitMQ
    async removeAllStalledJobs() {
        console.log('[QueueProvider] Stalled jobs auto-handled by RabbitMQ TTL');
        return 0;
    }

    // Remove failed jobs
    async removeAllFailedJobs() {
        try {
            const mainResult = await this.channel.purgeQueue(this.mainDLQName);
            const landingResult = await this.channel.purgeQueue(this.landingDLQName);
            
            const total = mainResult.messageCount + landingResult.messageCount;
            console.log(`Removed ${total} failed jobs`);
            return total;
        } catch (error) {
            console.log('Error removing failed jobs:', error);
            throw error;
        }
    }

    // Utility methods
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateStats(queueName, operation) {
        if (queueName === this.mainQueueName) {
            if (operation === 'completed') this.stats.main_queue.completed++;
            if (operation === 'failed') this.stats.main_queue.failed++;
            if (operation === 'waiting') this.stats.main_queue.waiting++;
        } else if (queueName === this.landingQueueName) {
            if (operation === 'completed') this.stats.landingpage_queue.completed++;
            if (operation === 'failed') this.stats.landingpage_queue.failed++;
            if (operation === 'waiting') this.stats.landingpage_queue.waiting++;
        }
    }
}

exports.QueueProvider = new QueueProvider();