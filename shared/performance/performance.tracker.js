const {CacheProvider} = require('../redis/cache.provider');
const PerformanceKey ="PerformanceKey";
const queryKey ="queryKey";
class PerformanceTracker {
    constructor() {
        // Store active tracking sessions by requestId
        // this.sessions = new Map();
    }

    /**
     * Start tracking for a request
     * @param {string} requestId - Unique request identifier
     * @param {object} metadata - Additional metadata (route, method, etc.)
     */
    async start(requestId, metadata = {}) {
        try {
            return await CacheProvider.put(PerformanceKey,requestId,queryKey,{
                startTime: Date.now(),
                checkpoints: [],
                metadata,
            });
        } catch (error) {
            console.log("PerformanceTracker.start.trycatch",error);
            return;
        }
    }

    /**
     * Mark a checkpoint in the request processing
     * @param {string} requestId - Request identifier
     * @param {string} name - Checkpoint name
     * @param {object} data - Additional data for this checkpoint
     */
    async checkpoint(requestId, name, data = {}) {
        // const session = this.sessions.get(requestId);
        try {
            const session = await CacheProvider.get(PerformanceKey,requestId,queryKey);
            if (!session) {
                console.warn(`[PerformanceTracker] No session found for requestId: ${requestId}`);
                return;
            }
    
            const now = Date.now();
            const elapsed = now - session.startTime;
            const previousCheckpoint = session.checkpoints[session.checkpoints.length - 1];
            const delta = previousCheckpoint ? elapsed - previousCheckpoint.elapsed : elapsed;
    
            session.checkpoints.push({
                name,
                timestamp: now,
                elapsed,
                delta,
                data,
            });
            await CacheProvider.put(PerformanceKey,requestId,queryKey,session);
        } catch (error) {
            console.log("PerformanceTracker.start.checkpoint",error);
            return;
        }

    }

    /**
     * End tracking and get results
     * @param {string} requestId - Request identifier
     * @param {object} finalData - Final data (status, error, etc.)
     * @returns {object} Performance report
     */
    async end(requestId, finalData = {}) {
        try {
            const session = await CacheProvider.get(PerformanceKey,requestId,queryKey);
            if (!session) {
                return null;
            }
    
            const totalTime = Date.now() - session.startTime;
            
            const report = {
                requestId,
                totalTime,
                metadata: session.metadata,
                checkpoints: session.checkpoints.map(cp => ({
                    name: cp.name,
                    elapsed: cp.elapsed,
                    delta: cp.delta,
                    data: cp.data,
                })),
                finalData,
                timestamp: new Date().toISOString(),
            };
    
            // Clean up
            // this.sessions.delete(requestId);
            CacheProvider.del(PerformanceKey,requestId);
            return report;
        } catch (error) {
            console.log(error);
            return null;
        }

    }

    /**
     * Log performance report
     * @param {object} report - Performance report
     */
    log(report) {
        if (!report) return;

        const { requestId, totalTime, metadata, checkpoints, finalData } = report;

        // Basic log
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`[Performance] ${metadata.method} ${metadata.route}`);
        console.log(`Request ID: ${requestId}`);
        console.log(`Total Time: ${totalTime}ms`);
        console.log(`Status: ${finalData.status || 'N/A'}`);

        if (checkpoints.length > 0) {
            console.log('\nCheckpoint Breakdown:');
            console.log('─────────────────────────────────────────────────────────');
            
            checkpoints.forEach((cp, index) => {
                const percentage = ((cp.delta / totalTime) * 100).toFixed(1);
                console.log(`${index + 1}. ${cp.name}`);
                console.log(`   Time: ${cp.elapsed}ms (Δ${cp.delta}ms) - ${percentage}%`);
                
                if (cp.data && Object.keys(cp.data).length > 0) {
                    console.log(`   Data: ${JSON.stringify(cp.data)}`);
                }
            });
        }

        // Performance warnings
        if (totalTime > 5000) {
            console.log(`\n⚠️  WARNING: Request took more than 5 seconds!`);
        } else if (totalTime > 2000) {
            console.log(`\n⚠️  SLOW: Request took more than 2 seconds`);
        }

        // Find slowest checkpoint
        if (checkpoints.length > 0) {
            const slowest = checkpoints.reduce((prev, current) => 
                (current.delta > prev.delta) ? current : prev
            );
            if (slowest.delta > 1000) {
                console.log(`\n🐌 Slowest Operation: ${slowest.name} (${slowest.delta}ms)`);
            }
        }

        console.log('═══════════════════════════════════════════════════════════\n');
    }

    /**
     * Get current session (for debugging)
     */
    async getSession(requestId) {
        return  await CacheProvider.get(PerformanceKey,requestId,queryKey);
    }

    /**
     * Clear all sessions (for testing)
     */
    clearAll() {
        // this.sessions.clear();
    }
}

// Singleton instance
const tracker = new PerformanceTracker();

module.exports = { PerformanceTracker: tracker };