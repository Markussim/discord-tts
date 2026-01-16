const { Events } = require("discord.js");

const { client, channelID } = require("./client");
const { enqueue } = require("./queue");
const { test } = require("./voice");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");
const { createModuleLogger } = require("./logger");

// Create module-specific logger
const logger = createModuleLogger('main');

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
      logger.error(`Voice channel ${channelID} not found`, {
        channelId: channelID,
        guildName: message.guild?.name
      });
      return;
    }

    logger.info(`Message from ${message.author.username}`, {
      content: message.content,
      nickname: message.author.username,
      userId: message.author.id,
      channelName: message.channel.name,
      guildName: message.guild.name
    });

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
      logger.debug('Voice channel is empty', {
        queueLength: channel.members.size
      });
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
      if (process.env.DEV != "TRUE" && !member.voice.mute) {
        logger.debug(`Ignoring ${message.author.username} (unmuted in voice)`, {
          nickname: message.author.username,
          userId: message.author.id
        });
        return;
      }
    }

    const userNickname = message.member.nickname;

    // Replace mentions with nicknames
    let messageContentWithoutMention = replaceMentions(message);

    // Replace misc mention like things
    messageContentWithoutMention = replaceMisc(
      messageContentWithoutMention,
      client
    );

    logger.debug('Processed message content', {
      contentLength: messageContentWithoutMention.length,
      isImage: messageAttachments.length > 0
    });

    // Replace misc mention like things
    messageContentWithoutMention = await replaceUrls(
      messageContentWithoutMention,
      messageAttachments
    );

    if (
      messageContentWithoutMention.isImage &&
      messageContentWithoutMention.userComment
    ) {
      let descriptionMessage = {
        content: messageContentWithoutMention.userComment,
        nickname: userNickname,
        isImage: false,
        userId: message.author.id,
      };

      // Add message to the queue
      enqueue(descriptionMessage);
    }

    let messageObject = {
      content: messageContentWithoutMention.text,
      nickname: userNickname,
      isImage: messageContentWithoutMention.isImage,
      userId: message.author.id,
    };

    // Add message to the queue
    enqueue(messageObject);
  } catch (error) {
    logger.error('Failed to process message', {
      error: error.message,
      userId: message.author.id,
      nickname: message.author.username
    });
  }
});

client.once(Events.ClientReady, (c) => {
  logger.info(`Bot ready as ${c.user.username}`, {
    botUsername: c.user.username,
    guildCount: c.guilds.cache.size
  });
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

    let description = await gifToDescription([url]);

    logger.info('Generated GIF description', {
      url: url.substring(0, 50) + '...',
      description: description.substring(0, 100) + '...'
    });

    return {
      text: description,
      isImage: true,
    };
  } else if (attachments.length > 0) {
    // If there are attachments, return a description
    let description = await urlToDescription(
      attachments.slice(0, 5),
      inputString
    );

    return {
      text: description,
      isImage: true,
      userComment: inputString,
    };
  } else {
    // Get full url with http and path
    const fullUrls = inputString.match(urlRegex) ?? [];

    let replacedString = inputString;

    for (let fullUrl of fullUrls) {
      logger.debug(`Processing URL: ${fullUrl.substring(0, 50)}...`);

      let urlDescription = await htmlToDescription(fullUrl);

      replacedString = replacedString.replace(fullUrl, urlDescription);
    }

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

function replaceMisc(message, client) {
  let messageContent = message;
  // Replace channel mentions with channel names
  const channelMentions = messageContent.match(/<#(.*?)>/g) ?? [];

  channelMentions.forEach((channel) => {
    const channelId = channel.replace(/<#|>/g, "");
    const channelName = client.channels.cache.get(channelId).name;
    messageContent = messageContent.replace(channel, "hashtag " + channelName);
  });

  // Replace custom emoji with emoji name
  const emojis = messageContent.match(/<:(.*?):(.*?)>/g) ?? [];

  emojis.forEach((emoji) => {
    const emojiName = emoji.split(":")[1];
    messageContent = messageContent.replace(emoji, ":" + emojiName + ":");
  });

  return messageContent;
}

async function gifToDescription(url) {
  const response = await axios.get(url);

  // Get url for the gif in meta tag
  const $ = cheerio.load(response.data);
  const gifUrl = $("meta[property='og:image']").attr("content");

  let description = await urlToDescription([gifUrl]);

  return description;
}

async function urlToDescription(urls, comment) {
  // Variable that is true 1 of 5 times
  let shouldRoast =
    Math.floor(Math.random() * 5) === 0 ||
    process.env.ALWAYS_ROAST?.toLowerCase() === "true";

  if (comment?.toLowerCase().includes("roast")) {
    logger.info('🔥 Roast mode activated!', {
      nickname: 'user'
    });
    shouldRoast = true;

    // Remove the word roast from the comment
    comment = comment.replace(/roast/gi, "").trim();
  }

  let prompt = `Write a ${
    shouldRoast ? "funny max 20-30 words" : "serious max 10-20 words"
  } description for the image(s) in Swedish. Translate all text into Swedish. You don't have to read all text, and you should not mention that it is a translation. If it is a screenshot, only mention the most important parts.
  If the image(s) looks like google street view, try to guess where in the world it is. Do this in detail. It must be in a running text format.
  ${comment ? `User comment: "${comment}"` : ""}
  `;

  if (shouldRoast) {
    prompt += ` Roast content of the image throughout the message. You should swear as much as possible (About every second word), as all users are adults. Do not censor swears. ${
      comment ? `Roast the user comment too` : ""
    }`;
  }

  const content = [
    {
      type: "text",
      text: prompt,
    },
    ...urls.map((url) => ({
      type: "image_url",
      image_url: {
        url,
      },
    })),
  ];

  // Get description of the gif
  let message = {
    role: "user",
    content: content,
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [message],
  });

  let text = completion.choices[0].message.content;

  return text.toLowerCase();
}

async function htmlToDescription(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const headInfo = [
      $("head title").text(),
      $("meta[name='description']").attr("content"),
      $("meta[property='og:title']").attr("content"),
      $("meta[property='og:description']").attr("content"),
    ]
      .filter(Boolean)
      .join(" | ");

    const rawText = headInfo.replace(/\s+/g, " ").trim();

    logger.debug(`Extracted ${rawText.length} chars from ${url.substring(0, 30)}...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            'Write a short (Under 20 words) description of the content of this website in swedish (If it is a youtube video and you can\'t figure out what video is it, just say "youtube länk"). Never include the URL in the description.',
        },
        { role: "user", content: rawText },
      ],
    });

    const description = completion.choices[0].message.content;
    logger.info(`Generated description: "${description.substring(0, 50)}..."`);
    return description;
  } catch (e) {
    logger.warn(`Failed to describe ${url.substring(0, 30)}...`, {
      error: e.message
    });
    return url;
  }
}
