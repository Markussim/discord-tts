const {
  joinVoiceChannel,
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const textToSpeech = require("@google-cloud/text-to-speech");
const { Translate } = require("@google-cloud/translate").v2;
const { Readable } = require("stream");
const { createModuleLogger } = require("./logger");

// Create module-specific logger
const logger = createModuleLogger('voice');

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

  logger.info(`🎵 Playing message from ${messageObject.nickname}`, {
    messageId: messageObject.id,
    nickname: messageObject.nickname,
    userId: messageObject.userId,
    contentLength: messageObject.content.length,
    isImage: messageObject.isImage
  });

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
    logger.error('Failed to join voice channel', {
      channelId: channelID,
      guildName: channel.guild.name
    });
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
      logger.error('Audio playback failed', {
        error: error.message,
        messageId: messageObject?.id,
        nickname: messageObject?.nickname
      });
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

const translate = new Translate();

const voices = require("../voices.json");

async function createAudioFromText(
  text,
  userNickname,
  isImage = false,
  userId
) {
  let voiceName = voices[userId];

  let language = "sv-SE";

  let detectedLanguage;

  if (text.length < 20) {
    // Set language to "sv" if the text is less than 10 characters
    detectedLanguage = "sv";
    logger.debug(`Text too short, using Swedish (${text.length} chars)`);
  } else if (text.length > 5) {
    // Detect language of "text"
    const [detection] = await translate.detect(text);
    logger.info(`Language detected: ${detection.language} (${Math.round(detection.confidence * 100)}% confidence)`, {
      nickname: userNickname
    });

    detectedLanguage = detection.language;
  }

  if (detectedLanguage === "sv") {
    language = "sv-SE";
  } else if (detectedLanguage === "en") {
    language = "en-GB";
  } else {
    language = "en-GB";
  }

  if (!voiceName) {
    logger.warn(`No custom voice for ${userNickname}, using default`);
    voiceName = "sv-SE-Wavenet-C";
  }

  if (language === "en-GB") {
    voiceName = "en-GB-Chirp3-HD-Achernar";
  }

  if (!language) {
    logger.warn(`Language unknown for ${userNickname}, using Swedish`);
    language = "sv-SE";
  }

  logger.debug(`TTS: ${language} voice ${voiceName.split('-').pop()} for ${userNickname}`, {
    language,
    voiceName,
    isImage
  });

  // Generate the audio
  const formattedText = formatText(text, userNickname, isImage, language);

  // Log what will actually be spoken
  logger.info(`Speaking as ${userNickname}`, {
    nickname: userNickname,
    language,
    voiceName: voiceName.split('-').pop(),
    ttsText: formattedText
  });

  const request = {
    input: { text: formattedText },
    // Select the language and SSML voice gender (optional)
    voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
    // select the type of audio encoding
    audioConfig: { audioEncoding: "MP3" },

    voice: {
      languageCode: language,
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

function formatText(text, userNickname, isImage = false, language) {
  logger.debug(`Formatting for ${userNickname} (${language})`, {
    lastUser,
    nickname: userNickname,
    isImage
  });

  let oneMinute = 60000;

  if (
    lastUser === userNickname &&
    Date.now() - lastMessageTime < oneMinute &&
    !isImage
  ) {
    logger.debug(`Same user continues speaking`, {
      nickname: userNickname,
      ttsText: text
    });
    return text;
  }

  lastUser = userNickname;
  lastMessageTime = Date.now();

  let formattedText = "";

  if (language === "sv-SE") {
    if (isImage) {
      formattedText = `Bild skickad av ${userNickname}: ${text}`;
    } else {
      formattedText = `${userNickname} säger: ${text}`;
    }
  } else {
    if (isImage) {
      formattedText = `Image sent by ${userNickname}: ${text}`;
    } else {
      formattedText = `${userNickname} says: ${text}`;
    }
  }

  logger.debug(`Adding speaker introduction for ${userNickname}`, {
    nickname: userNickname,
    language,
    isImage,
    timeSinceLastMessage: Date.now() - lastMessageTime
  });

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
