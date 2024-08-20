const { Events } = require("discord.js");

const { client, channelID } = require("./client");
const { enqueue } = require("./queue");
const { test } = require("./voice");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");

// Set up OpenAI API
const openai = new OpenAI(process.env.OPENAI_API_KEY);

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

    const messageAttachmentsCollection = message.attachments;

    let messageAttachments = messageAttachmentsCollection.map((attachment) => {
      return attachment.url;
    });

    // Filter out attachments that are not images
    messageAttachments = messageAttachments.filter((attachment) =>
      attachment.match(/\.(jpeg|jpg|gif|png)(\?.*)?$/i)
    );

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
      console.log(process.env.DEV);

      // Check if user is muted
      if (process.env.DEV != "TRUE" && !member.voice.mute) {
        console.log("Ignoring message from user in voice channel.");
        return;
      }
    }

    const userNickname = message.member.nickname;

    // Replace mentions with nicknames
    let messageContentWithoutMention = replaceMentions(message);

    // Replace urls with "URL för <url>"
    messageContentWithoutMention = await replaceUrls(
      messageContentWithoutMention,
      messageAttachments
    );

    let messageObject = {
      content: messageContentWithoutMention.text,
      nickname: userNickname,
      isImage: messageContentWithoutMention.isImage,
    };

    // Add message to the queue
    enqueue(messageObject);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
});

async function replaceUrls(inputString, attachments) {
  // Regular expression to match URLs
  const urlRegex =
    /(https?:\/\/)?(www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?/g;

  let url = inputString.replace(urlRegex, (match, p1, p2, p3) => {
    return p3;
  });

  // If url is for tenor, get full url
  if (url.includes("tenor")) {
    url = inputString.match(urlRegex)[0];

    let description = await gifToDescription(url);

    console.log(`Description: ${description}`);

    return {
      text: description,
      isImage: true,
    };
  } else if (attachments.length > 0) {
    // If there are attachments, return a description
    let description = await urlToDescription(attachments[0]);

    return {
      text: description,
      isImage: true,
    };
  } else {
    // Replace URLs with the desired format
    const replacedString = inputString.replace(urlRegex, `URL för ${url}`);
    return {
      text: replacedString,
      isImage: false,
    };
  }
}

function replaceMentions(message) {
  // Receive nickname of the user of the user mentioned
  const mentionedUser = message.mentions.users;

  const mentionedRole = message.mentions.roles;

  // Create map of mentioned id and nickname
  const mentionedMap = new Map();

  // Create map of mentioned id and role name
  const mentionedRoleMap = new Map();

  mentionedUser.forEach((user) => {
    mentionedMap.set(user.id, user.displayName);
  });

  mentionedRole.forEach((role) => {
    mentionedRoleMap.set(role.id, role.name);
  });

  let messageContent = message.content;

  // Replace mentions with nicknames
  mentionedMap.forEach((value, key) => {
    messageContent = messageContent.replace(
      new RegExp(`<@!?${key}>`, "g"),
      "@" + value
    );
  });

  // Replace mentions with role names
  mentionedRoleMap.forEach((value, key) => {
    messageContent = messageContent.replace(
      new RegExp(`<@&${key}>`, "g"),
      "@" + value
    );
  });

  return messageContent;
}

async function gifToDescription(url) {
  const response = await axios.get(url);

  // Get url for the gif in meta tag
  const $ = cheerio.load(response.data);
  const gifUrl = $("meta[property='og:image']").attr("content");

  let description = await urlToDescription(gifUrl);

  return description;
}

async function urlToDescription(url) {
  // Get description of the gif
  let message = {
    role: "user",
    content: [
      {
        type: "text",
        text: "Write a very short description for this image in swedish.",
      },
      {
        type: "image_url",
        image_url: {
          url: url,
        },
      },
    ],
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [message],
  });

  let text = completion.choices[0].message.content;

  return text;
}
