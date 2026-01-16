const { Client, Events, GatewayIntentBits } = require("discord.js");
const dotenv = require("dotenv").config();
const { createModuleLogger } = require("./logger");

// Create module-specific logger
const logger = createModuleLogger('client');

let token = process.env.DISCORD_TOKEN;
let channelID = process.env.CHANNEL_ID;
let sayUser = process.env.SAY_USER;

// Validate required environment variables
if (!token) {
  logger.error('DISCORD_TOKEN environment variable is not set');
  process.exit(1);
}

if (!channelID) {
  logger.error('CHANNEL_ID environment variable is not set');
  process.exit(1);
}

logger.info('Starting EchoVoice bot...', {
  channelID,
  hasToken: !!token
});

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Add error handling for client events
client.on('error', (error) => {
  logger.error('Discord client error', {
    error: error.message
  });
});

client.on('warn', (warning) => {
  logger.warn(`Discord warning: ${warning}`);
});

// Export the client, channel ID, and say user
module.exports = {
  client,
  channelID,
  sayUser,
};

// Log in to Discord with your client's token
logger.info('Logging in to Discord...');
client.login(token)
  .then(() => {
    logger.info('✓ Login successful');
  })
  .catch((error) => {
    logger.error('Login failed', {
      error: error.message
    });
    process.exit(1);
  });
