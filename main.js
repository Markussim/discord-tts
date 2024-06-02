// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioResource,
  createAudioPlayer,
} = require("@discordjs/voice");
const { token, channelID } = require("./config.json");
const fs = require("fs");
const { Readable } = require("stream");
const textToSpeech = require("@google-cloud/text-to-speech");

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let timeout;

// Play each message received
client.on(Events.MessageCreate, async (message) => {
  try {
    // Ignore messages from the bot itself
    if (message.author.bot) {
      return;
    }

    console.log(channelID);

    const channel = message.guild.channels.cache.get(channelID);

    if (!channel) {
      console.error(`Channel with ID ${channelID} not found.`);
      return;
    }

    // Check if user is in voice channel
    const member = message.guild.members.cache.get(message.author.id);

    console.log(`User: ${member.voice.channel}`);

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

    const messageContentWithoutMention = message.content.replace(
      /<@&?\d+>/g,
      ""
    );

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

    const player = createAudioPlayer();
    const resource = createAudioResource(
      await createAudioFromText(messageContentWithoutMention)
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

// listen for all messages
client.on(Events.MessageCreate, (message) => {
  console.log(`Received message: ${message.content}`);
});

// Creates a client
const google_client = new textToSpeech.TextToSpeechClient();

async function createAudioFromText(text) {
  // Generate the audio
  const request = {
    input: { text: text },
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

  // Return the audio as a buffer
  return bufferToStream(response.audioContent);
}

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// Log in to Discord with your client's token
client.login(token);
