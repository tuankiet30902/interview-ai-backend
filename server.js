
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');

require('module-alias/register');
require('dotenv').config();

const setting = require('./utils/setting');
const { LogProvider } = require('./shared/log_nohierarchy/log.provider');
const ManagementSocket = require('./app/management/socket.concern');
const routerOffice = require('./app/office/routerProvider');
const routerManagement = require('./app/management/routerProvider');
const { SocketProvider } = require('./shared/socket/provider');
const initResource = require('./shared/init').init;
const { FileConst } = require('./shared/file/file.const');
const { QueueProvider } = require('./shared/queu/queue.provider');

const { CORS_ALLOWED_ORIGINS = '[]' } = process.env;

const app = express();

function parseAllowedOrigins() {
    try {
        const parsed = JSON.parse(CORS_ALLOWED_ORIGINS);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function isOriginAllowed(origin, extraAllowed = []) {
    if (!origin) return true; // allow non-browser requests
    const allowed = new Set([ 'http://localhost:3105', 'http://localhost:3005', ...extraAllowed ]);
    if (allowed.has(origin)) return true;
    const patterns = [/^https?:\/\/[a-zA-Z0-9-]+\.eranin\.com$/, /^https?:\/\/[a-zA-Z0-9-]+\.ahso\.vn$/, /^https?:\/\/localhost(:\d+)?$/];
    return patterns.some((r) => r.test(origin));
}

function setupViewEngine() {
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'pug');
}

function setupMiddlewares(extraAllowedOrigins) {
    app.set('trust proxy', 1);
    app.use(morgan('dev'));
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

    app.use(cors({
        origin: (origin, cb) => cb(null, isOriginAllowed(origin, extraAllowedOrigins)),
        credentials: true
    }));

    app.use(helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"],
            frameAncestors: ["'self'", 'http://localhost:3005']
        }
    }));

    app.use(session({ secret: setting.secretSession, saveUninitialized: true, resave: true }));
    app.use(passport.initialize());
    app.use(flash());
}

function setupRoutes() {
    const FILES_DIR = FileConst.pathLocal;
    app.use('/files', express.static(FILES_DIR));
    app.get('/files/:filename', (req, res) => res.sendFile(path.join(FILES_DIR, req.params.filename)));

    app.use('/fileDownload', express.static(FILES_DIR));
    app.get('/fileDownload/:filename', (req, res) => {
        const filePath = path.join(FILES_DIR, req.params.filename);
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        res.download(filePath);
    });

    Object.values(routerOffice).forEach(r => app.use(r.path, r.router));
    Object.values(routerManagement).forEach(r => app.use(r.path, r.router));
}

function setupErrorHandlers() {
    app.use((req, res, next) => {
        const err = new Error('Not Found'); err.status = 404; next(err);
    });

    if (app.get('env') === 'development') {
        app.use((err, req, res, next) => res.status(err.status || 500).render('error', { message: err.message, error: err }));
    }

    app.use((err, req, res, next) => res.status(err.status || 500).render('error', { message: err.message, error: {} }));
}

async function start() {
    const extraAllowed = parseAllowedOrigins();
    setupViewEngine();
    setupMiddlewares(extraAllowed);
    setupRoutes();
    setupErrorHandlers();

    // ensure resources ready before listening
    await Promise.all([
        initResource.initMongoDB(), 
        initResource.initRedis(),
        // initResource.initMinIO()
    ]);

    const server = http.createServer(app).listen(setting.port, setting.hostname, () => {
        LogProvider.info(`Server is listening port ${setting.port}`, 'server.start', 'system', 'startserver');
    });
    server.setTimeout(100000000);

    initResource.initIO(server);
    initResource.io.on('connection', socket => {
        SocketProvider.joinRoom(socket, `${socket.id}`);
        ManagementSocket(socket);
    });

    process.on('uncaughtException', err => {
        console.error('There was an uncaught error', err);
        process.exit(1);
    });

    process.on('SIGTERM', () => {
        console.log('🔄 Graceful shutdown...');
        QueueProvider.cleanup()
            .then(() => { console.log('✅ Cleanup completed'); process.exit(0); })
            .catch((error) => { console.log('❌ Cleanup failed:', error); process.exit(1); });
    });
}

start().catch(err => { console.error('Failed to start server', err); process.exit(1); });



















