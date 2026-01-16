const winston = require('winston');
const path = require('path');

// Define custom log levels
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        silly: 6
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        http: 'magenta',
        verbose: 'blue',
        debug: 'cyan',
        silly: 'grey'
    }
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let logMessage = `${timestamp} [${service || 'app'}] ${message}`;

        // Format common metadata in a readable way
        if (meta.userId && meta.nickname) {
            logMessage += ` (${meta.nickname}#${meta.userId.slice(-4)})`;
        } else if (meta.nickname) {
            logMessage += ` (${meta.nickname})`;
        } else if (meta.userId) {
            logMessage += ` (user ${meta.userId.slice(-4)})`;
        }

        if (meta.messageId) {
            logMessage += ` [${meta.messageId}]`;
        }

        if (meta.queueLength !== undefined) {
            logMessage += ` queue:${meta.queueLength}`;
        }

        if (meta.contentLength) {
            logMessage += ` (${meta.contentLength} chars)`;
        }

        if (meta.isImage) {
            logMessage += ` 🖼️`;
        }

        if (meta.channelId || meta.guildId) {
            let channelInfo = '';
            if (meta.channelName) channelInfo += `#${meta.channelName}`;
            if (meta.guildName) channelInfo += ` in ${meta.guildName}`;
            if (channelInfo) logMessage += ` ${channelInfo}`;
        }

        if (meta.error && level.includes('error')) {
            logMessage += `\n    ❌ ${meta.error}`;
            if (meta.stack && process.env.DEV === 'TRUE') {
                logMessage += `\n    Stack: ${meta.stack.split('\n')[1]?.trim()}`;
            }
        }

        if (meta.warning && level.includes('warn')) {
            logMessage += ` ⚠️  ${meta.warning}`;
        }

        // Special formatting for TTS text
        if (meta.ttsText) {
            logMessage += `\n    🗣️  "${meta.ttsText}"`;
        }

        return logMessage;
    })
);


// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Get log level from environment variable or default to 'info'
const getLogLevel = () => {
    if (process.env.NODE_ENV === 'development' || process.env.DEV === 'TRUE') {
        return 'debug';
    }
    return process.env.LOG_LEVEL || 'info';
};

// Create logger instance
const logger = winston.createLogger({
    levels: customLevels.levels,
    level: getLogLevel(),
    defaultMeta: { service: 'echovoice' },
    transports: [
        // Console output
        new winston.transports.Console({
            format: consoleFormat
        }),

        // Error log file
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),

        // Combined log file
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/combined.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ],

    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/exceptions.log'),
            format: fileFormat
        })
    ],

    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/rejections.log'),
            format: fileFormat
        })
    ]
});

// Create child loggers for different modules
const createModuleLogger = (moduleName) => {
    return logger.child({ service: moduleName });
};

module.exports = {
    logger,
    createModuleLogger
};