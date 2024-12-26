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
  const {
    content: message,
    nickname: userNickname,
    isImage: isImage,
    userId: userId,
  } = messageObject;
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
  const audio = await createAudioFromText(
    message,
    userNickname,
    isImage,
    messageObject.userId
  );

  const resource = createAudioResource(audio);

  // Create a promise that will resolve when playback is complete
  return new Promise((resolve) => {
    // Listen for the player becoming idle, which indicates playback has finished
    player.once(AudioPlayerStatus.Idle, () => {
      resolve();
    });

    // On kick, destroy the connection
    connection.on("stateChange", async (_, newState) => {
      if (newState.status === "disconnected") {
        resolve();
      }
    });

    // On error, destroy the connection
    player.on("error", async (error) => {
      console.error(`Error: ${error.message}`);
      connection.destroy();
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

const voices = require("../voices.json");

async function createAudioFromText(
  text,
  userNickname,
  isImage = false,
  userId
) {
  let voiceName = voices[userId];

  if (!voiceName) {
    console.error("Voice not found");
    voiceName = "sv-SE-Wavenet-C";
  }

  // Generate the audio
  const request = {
    input: { text: formatText(text, userNickname, isImage) },
    // Select the language and SSML voice gender (optional)
    voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
    // select the type of audio encoding
    audioConfig: { audioEncoding: "MP3" },

    voice: {
      languageCode: "sv-SE",
      name: voiceName,
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

function formatText(text, userNickname, isImage = false) {
  console.log(`Last user: ${lastUser}`);

  let oneMinute = 60000;

  if (
    lastUser === userNickname &&
    Date.now() - lastMessageTime < oneMinute &&
    !isImage
  ) {
    return text;
  }

  lastUser = userNickname;
  lastMessageTime = Date.now();

  let formattedText = "";

  if (isImage) {
    formattedText = `Bild skickad av ${userNickname}: ${text}`;
  } else {
    formattedText = `${userNickname} säger: ${text}`;
  }

  return formattedText;
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
