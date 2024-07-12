const queue = [];

function enqueue(message) {
  const messageObject = {
    content: message.content,
    nickname: message.nickname,
    // Generate a unique ID for each message
    id: Math.random().toString(36).substr(2, 9),
  };

  queue.push(messageObject);
}

function dequeue(id) {
  const index = queue.findIndex((message) => message.id === id);
  if (index === -1) {
    return;
  }

  queue.splice(index, 1);
}

function getNewestMessage() {
  if (queue.length === 0) {
    return null;
  }

  return queue[0];
}

module.exports = { enqueue, dequeue, getNewestMessage };
