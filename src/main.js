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
      // Check if user is muted
      if (process.env.DEV != "TRUE" && !member.voice.mute) {
        console.log("Ignoring message from user in voice channel.");
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

    console.log(messageContentWithoutMention);

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
    console.error(`Error: ${error.message}`);
  }
});

client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
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

    console.log(`Description: ${description}`);

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
      console.log(`Full URL: ${fullUrl}`);

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
  const shouldRoast =
    Math.floor(Math.random() * 5) === 0 ||
    process.env.ALWAYS_ROAST?.toLowerCase() === "true";

  let prompt = `Write a ${
    shouldRoast ? "funny 2 sentence" : "serious 1 sentence"
  } description for the image(s) in Swedish. Translate all text into Swedish. You don't have to read all text, and you should not mention that it is a translation. If it is a screenshot, only mention the most important parts.
  If the image(s) looks like google street view, try to guess where in the world it is. Do this in detail. It must be in a running text format.
  ${comment ? `User comment: "${comment}"` : ""}
  `;

  if (shouldRoast) {
    prompt += ` Roast content of the image throughout the message. You should swear as much as possible (Especially those starting with f), as all users are adults. Do not censor swears. ${
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
    const response = await axios.get(url);

    const $ = cheerio.load(response.data);

    let metaTagsArray = [];

    if ($("meta[name='description']").attr("content")) {
      metaTagsArray.push($("meta[name='description']").attr("content"));
    }

    if ($("meta[property='og:description']").attr("content")) {
      metaTagsArray.push($("meta[property='og:description']").attr("content"));
    }

    if ($("meta[name='twitter:description']").attr("content")) {
      metaTagsArray.push($("meta[name='twitter:description']").attr("content"));
    }

    if ($("title").text()) {
      metaTagsArray.push($("title").text());
    }

    let description = metaTagsArray.join(" | ");

    console.log(`Description: ${description}`);

    // Cut raw text to 1000 characters
    rawText = description.substring(0, 1000);

    const systemMessage = {
      role: "system",
      content: [
        {
          type: "text",
          text: "What is this website? Write a 10 word description in swedish. Please start with 'URL för'.",
        },
      ],
    };

    const message = {
      role: "user",
      content: [
        {
          type: "text",
          text: rawText,
        },
      ],
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [systemMessage, message],
    });

    let text = completion.choices[0].message.content;

    return text;
  } catch (error) {
    return url;
  }
}
