const { Events } = require("discord.js");

const { client, channelID } = require("./client");
const { enqueue } = require("./queue");
const { test } = require("./voice");

// Play each message received
client.on(Events.MessageCreate, async (message) => {
  try {
    // Ignore messages from the bot itself
    if (message.author.bot) {
      return;
    }

    const channel = message.guild.channels.cache.get(channelID);

    if (!channel) {
      console.error(`Channel with ID ${channelID} not found.`);
      return;
    }

    console.log(`Message received: ${message.content}`);

    // Check if voice channel is empty
    if (channel.members.size == 0) {
      console.log("Channel is empty.");
      return;
    }

    // Check if user is in voice channel
    const member = message.guild.members.cache.get(message.author.id);

    // If user is in the voice channel, ignore the message
    if (
      member.voice &&
      member.voice.channel &&
      member.voice.channel.id == channelID
    ) {
      // Check if user is muted
      if (!member.voice.mute) {
        return;
      }
    }

    const userNickname = message.member.nickname;

    // Replace mentions with nicknames
    let messageContentWithoutMention = replaceMentions(message);

    // Replace urls with "URL för <url>"
    messageContentWithoutMention = replaceUrls(messageContentWithoutMention);

    let messageObject = {
      content: messageContentWithoutMention,
      nickname: userNickname,
    };

    // Add message to the queue
    enqueue(messageObject);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
});

function replaceUrls(inputString) {
  // Regular expression to match URLs
  const urlRegex =
    /(https?:\/\/)?(www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?/g;

  // Replace URLs with the desired format
  const replacedString = inputString.replace(urlRegex, (match, p1, p2, p3) => {
    return `URL för ${p3}`;
  });

  return replacedString;
}

function replaceMentions(message) {
  // Receive nickname of the user of the user mentioned
  const mentionedUser = message.mentions.users;

  // Create map of mentioned id and nickname
  const mentionedMap = new Map();

  mentionedUser.forEach((user) => {
    mentionedMap.set(user.id, user.displayName);
  });

  let messageContent = message.content;

  // Replace mentions with nicknames
  mentionedMap.forEach((value, key) => {
    messageContent = messageContent.replace(
      new RegExp(`<@!?${key}>`, "g"),
      "@" + value
    );
  });

  return messageContent;
}
