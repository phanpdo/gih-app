const winston = require('winston');
require('winston-daily-rotate-file'); // Required for daily rotation
// Define a custom format for the logs
const customFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});
// Create a transport for rotating log files
const transport = new winston.transports.DailyRotateFile({
    filename: 'application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '1d', // Keep logs for 1 days
    dirname: './logs', // Directory to store log files
});

// Create a transport for console logging
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.timestamp(),
        customFormat
    ),
});

// Create a logger instance
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [transport, consoleTransport],
});

module.exports = logger;
