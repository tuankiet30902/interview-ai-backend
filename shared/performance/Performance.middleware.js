const { PerformanceTracker } = require('./performance.tracker');
const { v4: uuidv4 } = require('uuid');

/**
 * Performance Tracking Middleware
 * Integrates with existing router structure
 */
class PerformanceMiddleware {
    /**
     * Express middleware to start performance tracking
     */
    static  init() {
        return async (req, res, next) => {
            // Generate unique request ID
            const requestId = uuidv4();
            
            // Attach to request for controller access
            req._performanceId = requestId;
            
            // CRITICAL: Also attach to req.body so controller can access it
            // This must be done AFTER body-parser middleware
            if (!req.body) {
                req.body = {};
            }
            req.body._performanceId = requestId;
            
            // Start tracking
            await PerformanceTracker.start(requestId, {
                method: req.method,
                route: req.route?.path || req.path,
                url: req.originalUrl,
                ip: req.ip,
            });

            // Checkpoint: Request received
            await PerformanceTracker.checkpoint(requestId, 'Request Received', {
                headers: req.headers['content-length'] ? `${req.headers['content-length']} bytes` : 'N/A',
            });

            next();
        };
    }

    /**
     * Helper to mark checkpoint in controllers
     * Usage in controller: const track = require('...').checkpoint;
     *                      track(req, 'Database Query', { count: results.length });
     */
    static async checkpoint(req, name, data = {}) {
        if (req._performanceId) {
            await PerformanceTracker.checkpoint(req._performanceId, name, data);
        }
    }

    /**
     * End tracking and log results
     * This should be called in Router.trycatchFunction
     */
    static async end(req, status, error = null) {
        if (!req._performanceId) return;
        try {
            await PerformanceTracker.checkpoint(req._performanceId,"Request Completed");

            const report = await PerformanceTracker.end(req._performanceId, {
                status,
                error: error ? error.message : null,
            });
    
            if (report) {
                PerformanceTracker.log(report);
            }
        } catch (error) {
            console.log(error);
        }

    }
}

module.exports = { 
    PerformanceMiddleware,
    // Export shorthand functions for easy use
    checkpoint: PerformanceMiddleware.checkpoint,
    endTracking: PerformanceMiddleware.end,
};