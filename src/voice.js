const {
  joinVoiceChannel,
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const textToSpeech = require("@google-cloud/text-to-speech");
const { Readable } = require("stream");

// Import client from src/main.js
const { client, channelID, sayUser } = require("./client");
const { dequeue, getNewestMessage } = require("./queue");

let player = createAudioPlayer();

let timeout;

async function queueListener() {
  // Get the newest message
  const messageObject = getNewestMessage();

  // If there is no message, return
  if (messageObject === null) {
    setTimeout(queueListener, 1000);
    return;
  }

  console.log(`Playing message: ${messageObject.content}`);

  // Play the message
  await playMessage(messageObject);

  // Remove the message from the queue
  dequeue(messageObject.id);

  queueListener();
}

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

  // Create the audio and resource
  const audio = await createAudioFromText(message, userNickname);
  const resource = createAudioResource(audio);

  // Create a promise that will resolve when playback is complete
  return new Promise((resolve) => {
    // Listen for the player becoming idle, which indicates playback has finished
    player.once(AudioPlayerStatus.Idle, () => {
      resolve();
    });

    // Start the playback
    player.play(resource);
    connection.subscribe(player);

    // Set the last message time and inactivity timeout
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      connection.destroy();
    }, 300000);
  });
}

// Creates a client
const google_client = new textToSpeech.TextToSpeechClient();

async function createAudioFromText(text, userNickname) {
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

  // Return the audio as a buffer
  return bufferToStream(response.audioContent);
}

let lastUser = "";

let lastMessageTime = Date.now();

function formatText(text, userNickname) {
  console.log(`Last user: ${lastUser}`);

  let oneMinute = 60000;

  if (lastUser === userNickname && Date.now() - lastMessageTime < oneMinute) {
    return text;
  }

  lastUser = userNickname;
  lastMessageTime = Date.now();

  return sayUser == "TRUE" ? `${userNickname} säger: ${text}` : text;
}

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

(async () => {
  await queueListener();
})();
