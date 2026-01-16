# EchoVoice Logging System Documentation

## Overview

The EchoVoice project now uses Winston as its logging library, providing structured, configurable, and comprehensive logging throughout the application.

## Features

### Log Levels
- **error**: Error events that might still allow the application to continue running
- **warn**: Warning events that indicate potential issues
- **info**: Informational messages that highlight the progress of the application
- **http**: HTTP request/response logging
- **verbose**: Verbose informational messages  
- **debug**: Debug-level messages for development
- **silly**: Very detailed debug information

### Output Destinations
- **Console**: Colored, formatted output for real-time monitoring
- **Files**: 
  - `logs/combined.log` - All log messages
  - `logs/error.log` - Error level messages only
  - `logs/exceptions.log` - Uncaught exceptions
  - `logs/rejections.log` - Unhandled promise rejections

### Log Rotation
- Maximum file size: 5MB
- Maximum files kept: 5
- Old files are automatically archived

## Usage

### Importing the Logger

```javascript
// Import the main logger
const { logger } = require('./logger');

// Or create a module-specific logger
const { createModuleLogger } = require('./logger');
const moduleLogger = createModuleLogger('moduleName');
```

### Basic Logging

```javascript
// Simple messages
logger.info('Application started');
logger.warn('This is a warning');
logger.error('An error occurred');
logger.debug('Debug information');

// With metadata
logger.info('User action', {
  userId: '12345',
  action: 'login',
  timestamp: Date.now()
});
```

### Error Logging

```javascript
try {
  // Some operation
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context: 'additional context'
  });
}
```

### Module-Specific Logging

Each module should create its own logger instance:

```javascript
const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('voice');

logger.info('Voice module initialized');
```

## Configuration

### Environment Variables

- `LOG_LEVEL`: Set the minimum log level (default: 'info' in production, 'debug' in development)
- `NODE_ENV`: When set to 'development' or when `DEV=TRUE`, enables debug level logging
- `DEV`: When set to 'TRUE', enables debug level logging

### Examples

```bash
# Set log level to debug
LOG_LEVEL=debug npm start

# Enable development mode (includes debug logs)
DEV=TRUE npm start
```

## Module Integration

### client.js
- Connection and authentication events
- Environment variable validation
- Discord client errors and warnings

### main.js  
- Message processing events
- URL processing and description generation
- Error handling for message events

### voice.js
- Audio generation and playback
- Language detection
- Voice channel operations
- Text-to-speech processing

### queue.js
- Message queue operations
- Enqueue/dequeue events
- Queue statistics

## Best Practices

1. **Use appropriate log levels**: Don't log everything as 'info'
2. **Include relevant metadata**: Add context that helps with debugging
3. **Don't log sensitive information**: Avoid logging tokens, passwords, or PII
4. **Use module-specific loggers**: Create a logger for each module
5. **Log errors with context**: Include error messages, stack traces, and relevant context

## Examples from the Codebase

### Message Processing
```javascript
logger.info('Message received', {
  content: message.content,
  author: message.author.username,
  authorId: message.author.id,
  guildId: message.guild.id,
  channelId: message.channel.id
});
```

### Error Handling
```javascript
logger.error('Error processing Discord message', {
  error: error.message,
  stack: error.stack,
  messageId: message.id,
  authorId: message.author.id,
  guildId: message.guild?.id
});
```

### Queue Operations
```javascript
logger.info('Message enqueued', {
  messageId: messageObject.id,
  userId: messageObject.userId,
  nickname: messageObject.nickname,
  queueLength: queue.length,
  position: queue.length
});
```

## Monitoring and Debugging

### Real-time Monitoring
Watch the console output for real-time application status and errors.

### Historical Analysis
Check log files in the `logs/` directory for historical analysis and debugging.

### Log File Locations
- `logs/combined.log` - Complete application logs
- `logs/error.log` - Error messages only
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

## Troubleshooting

### Common Issues

1. **Log files not being created**: Ensure the `logs/` directory exists and has write permissions
2. **Too many debug messages**: Set `LOG_LEVEL=info` or remove `DEV=TRUE` from environment
3. **Missing context in logs**: Add relevant metadata objects to log calls

### Performance Considerations

- Debug and verbose logging can impact performance in production
- Use appropriate log levels based on environment
- Consider log file size limits and rotation settings