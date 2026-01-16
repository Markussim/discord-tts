const { createModuleLogger } = require("./logger");

// Create module-specific logger
const logger = createModuleLogger('queue');

const queue = [];

function enqueue(message) {
  const messageObject = {
    content: message.content,
    nickname: message.nickname,
    isImage: message.isImage,
    // Generate a unique ID for each message
    id: Math.random().toString(36).substr(2, 9),
    userId: message.userId,
  };

  queue.push(messageObject);

  logger.info(`Queued message from ${messageObject.nickname}`, {
    messageId: messageObject.id,
    userId: messageObject.userId,
    nickname: messageObject.nickname,
    contentLength: messageObject.content.length,
    isImage: messageObject.isImage,
    queueLength: queue.length
  });
}

function dequeue(id) {
  const index = queue.findIndex((message) => message.id === id);
  if (index === -1) {
    logger.warn(`Message ${id} not found in queue`, {
      messageId: id,
      queueLength: queue.length
    });
    return;
  }

  const message = queue[index];
  queue.splice(index, 1);

  logger.info(`Processed message from ${message.nickname}`, {
    messageId: id,
    userId: message.userId,
    nickname: message.nickname,
    queueLength: queue.length
  });
}

function getNewestMessage() {
  if (queue.length === 0) {
    return null;
  }

  const message = queue[0];
  logger.debug(`Next message: ${message.nickname}`, {
    messageId: message.id,
    nickname: message.nickname,
    queueLength: queue.length
  });

  return message;
}

// Add function to get queue stats for monitoring
function getQueueStats() {
  const stats = {
    length: queue.length,
    isEmpty: queue.length === 0,
    messages: queue.map(msg => ({
      id: msg.id,
      nickname: msg.nickname,
      contentLength: msg.content.length,
      isImage: msg.isImage
    }))
  };

  logger.debug('Queue stats requested', stats);
  return stats;
}

module.exports = { enqueue, dequeue, getNewestMessage, getQueueStats };
