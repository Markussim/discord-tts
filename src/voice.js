const {
  joinVoiceChannel,
  createAudioResource,
  createAudioPlayer,
} = require("@discordjs/voice");
const textToSpeech = require("@google-cloud/text-to-speech");
const { Readable } = require("stream");

// Import client from src/main.js
const { client, channelID, sayUser } = require("./client");

let player = createAudioPlayer();

let timeout;

async function playMessage(messageObject) {
  // Destructure the message object
  const { content: message, nickname: userNickname } = messageObject;

  // Get the channel from its ID (Message is a string so we can't use message.guild.channels.cache.get)
  const channel = await client.channels.fetch(channelID);

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
    await createAudioFromText(message, userNickname)
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
}

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

// Export the function
module.exports = playMessage;
