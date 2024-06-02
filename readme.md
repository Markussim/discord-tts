# 🗣️ Discord TTS Bot

This project is a Discord bot that uses Google Cloud's Text-to-Speech API to convert messages into speech and play them in a voice channel. 🎤

## 📚 Features

- Converts text messages to speech using Google Cloud TTS.
- Joins a specified voice channel and plays the converted speech.
- Ignores messages from users who are already in the voice channel and unmuted.
- Disconnects from the voice channel after 5 minutes of inactivity. ⏲️

## 🛠️ How to set up

### 1. Clone the repository 📦

```sh
git clone https://github.com/yourusername/discord-tts-bot.git
cd discord-tts-bot
```

### 2. Install dependencies 📥

Make sure you have Node.js installed, then run:

```sh
npm install
```

### 3. Set up configuration ⚙️

Create a `.env` file in the root directory of the project with the following content:

```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
CHANNEL_ID=YOUR_VOICE_CHANNEL_ID
SAY_USER=TRUE_OR_FALSE
```

Replace `YOUR_DISCORD_BOT_TOKEN` with your bot token and `YOUR_VOICE_CHANNEL_ID` with the ID of the voice channel you want the bot to join. Set `SAY_USER` to `TRUE` if you want the bot to mention the user's name before the message, or `FALSE` otherwise.

You also need to link a google cloud service account key to the project. You can do this by using the -v flag to mount the key file into the container.

```sh
-v /path/to/key.json:/etc/service-account-key.json
```

Note that the right side of the colon should be `/etc/service-account-key.json` as that is the path the code is looking for the key file, and the left needs to be an absolute path to the key file on your local machine.

## 🚀 Usage

Start the bot by running:

```sh
node index.js
```

Your bot should now be online and ready to convert text messages into speech! 🎉

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Enjoy your new text-to-speech Discord bot! 🎧
