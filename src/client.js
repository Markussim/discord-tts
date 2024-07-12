const { Client, Events, GatewayIntentBits } = require("discord.js");
const dotenv = require("dotenv").config();

let token = process.env.DISCORD_TOKEN;
let channelID = process.env.CHANNEL_ID;
let sayUser = process.env.SAY_USER;

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Export the client, channel ID, and say user
module.exports = {
  client,
  channelID,
  sayUser,
};

// Log in to Discord with your client's token
client.login(token);
