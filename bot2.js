const {
	Client,
	GatewayIntentBits,
	Partials,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	Events,
} = require('discord.js');
const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	VoiceConnectionStatus,
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel],
});

let voiceConnection; // Global variable to track the voice connection

client.once('ready', () => {
	console.log('Bot is ready!');
});

client.on('messageCreate', async (message) => {
	if (message.content === 'vc join') {
		const voiceChannel = message.member.voice.channel;

		if (!voiceChannel) {
			return message.reply(
				'You need to be in a voice channel to use this command!'
			);
		}

		voiceConnection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		});

		voiceConnection.on(VoiceConnectionStatus.Ready, () => {
			console.log('The bot has connected to the channel!');
		});

		voiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
			console.log('The bot has disconnected from the channel!');
		});

		message.reply('Joined the voice channel!');
	}

	if (message.content === 'vc buttons') {
		// Read the directory for audio files
		const audioFiles = fs
			.readdirSync('./audio')
			.filter((file) => file.endsWith('.mp3'));

		if (audioFiles.length === 0) {
			return message.reply('No audio files found in the folder.');
		}

		// Create buttons for each audio file
		const buttons = audioFiles.map((file, index) =>
			new ButtonBuilder()
				.setCustomId(`audio_${index}`)
				.setLabel(file.split('.')[0])
				.setStyle(ButtonStyle.Primary)
		);

		// Create action rows to hold the buttons (max 5 buttons per row)
		const rows = [];
		for (let i = 0; i < buttons.length; i += 5) {
			rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
		}

		// Send a message with buttons
		await message.channel.send({
			content: 'Choose an audio file to play:',
			components: rows,
		});
	}
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isButton()) return;

	// Extract the audio file index from the button ID
	const fileIndex = parseInt(interaction.customId.split('_')[1]);

	// Read the directory for audio files again
	const audioFiles = fs
		.readdirSync('./audio')
		.filter((file) => file.endsWith('.mp3'));

	// Get the selected audio file
	const selectedFile = audioFiles[fileIndex];

	if (!selectedFile) return;

	// Get the member's voice channel
	const voiceChannel = interaction.member.voice.channel;

	if (!voiceChannel) {
		return interaction.reply({
			content: 'You need to be in a voice channel to use this command!',
			ephemeral: true,
		});
	}

	// Ensure the bot is connected to the voice channel
	if (
		!voiceConnection ||
		voiceConnection.joinConfig.channelId !== voiceChannel.id
	) {
		voiceConnection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		});
	}

	// Create a new audio player and resource for each sound
	const player = createAudioPlayer();
	const resource = createAudioResource(
		path.join(__dirname, 'audio', selectedFile)
	);

	player.play(resource);
	voiceConnection.subscribe(player);

	await interaction.deferUpdate();
	// await interaction.followUp(`Now playing: ${selectedFile}`);
});

client.login(process.env.TOKEN);
