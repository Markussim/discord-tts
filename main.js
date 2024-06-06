// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioResource,
  createAudioPlayer,
} = require("@discordjs/voice");
const { Readable } = require("stream");
const textToSpeech = require("@google-cloud/text-to-speech");
const dotenv = require("dotenv").config();

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let token = process.env.DISCORD_TOKEN;
let channelID = process.env.CHANNEL_ID;
let sayUser = process.env.SAY_USER;

let timeout;

let player = createAudioPlayer();

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

    console.log(`Received message: ${message.content}`);

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

    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: channelID,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    // Play the audio
    if (!connection) {
      console.error("The bot is not connected to a voice channel.");
      return;
    }

    const resource = createAudioResource(
      await createAudioFromText(messageContentWithoutMention, userNickname)
    );

    player.play(resource);

    connection.subscribe(player);

    // Set the last message time
    lastMessageTime = Date.now();

    // Set a timeout to disconnect the bot after 5 minutes of inactivity
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      connection.destroy();
    }, 300000);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
});

// Creates a client
const google_client = new textToSpeech.TextToSpeechClient();

async function createAudioFromText(text, userNickname) {
  console.time("createAudioFromText");
  // Generate the audio
  const request = {
    input: { text: formatText(text, userNickname) },
    // Select the language and SSML voice gender (optional)
    voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
    // select the type of audio encoding
    audioConfig: { audioEncoding: "MP3" },

    voice: {
      languageCode: "sv-SE",
      name: "sv-SE-Wavenet-C",
      ssmlGender: "NEUTRAL",
    },
  };

  // Performs the text-to-speech request
  const [response] = await google_client.synthesizeSpeech(request);

  console.timeEnd("createAudioFromText");

  // Return the audio as a buffer
  return bufferToStream(response.audioContent);
}

function formatText(text, userNickname) {
  return sayUser == "TRUE" ? `${userNickname} säger: ${text}` : text;
}

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

function replaceUrls(inputString) {
  // Regular expression to match URLs
  const urlRegex =
    /(https?:\/\/)?(www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?/g;

  // Replace URLs with the desired format
  const replacedString = inputString.replace(urlRegex, (match, p1, p2, p3) => {
    return `URL för ${p3}`;
  });

  console.log(replacedString);

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

// Log in to Discord with your client's token
client.login(token);
