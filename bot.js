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

// //******************Code to deploy this on Render*******************************

// const express = require('express');
// const app = express();

// app.listen(4000, () => {
// 	console.log(`Listening on port 4000`);
// });

// //*******************code to deploy on render ends here*************************

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
		const buttons = audioFiles.map((file, index) => {
			file = file.split('.')[0];
			const labelStartIndex = file.search(/[A-Za-z]/);
			const emoji = file.substring(0, labelStartIndex);
			return new ButtonBuilder()
				.setCustomId(`audio_${index}`)
				.setStyle(ButtonStyle.Secondary)
				.setLabel(file.substring(labelStartIndex))
				.setEmoji(emoji);
		});

		// Create action rows to hold the buttons (max 5 buttons per row)
		const rows = [];
		for (let i = 0; i < buttons.length; i += 5) {
			rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
		}

		//Stop Button at the end
		rows.push(
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('Stop')
					.setLabel('Stop')
					.setStyle(ButtonStyle.Danger)
					.setEmoji('⛔')
			)
		);

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

	if (!selectedFile) {
		interaction.reply({
			content: 'No audio file found!',
		});
		return;
	}
	// Get the member's voice channel
	const voiceChannel = interaction.member.voice.channel;

	if (!voiceChannel) {
		return interaction.reply({
			content: 'You need to be in a voice channel to use this command!',
			ephemeral: true,
		});
	}

	// Join the voice channel and play the selected audio file
	voiceConnection = joinVoiceChannel({
		channelId: voiceChannel.id,
		guildId: voiceChannel.guild.id,
		adapterCreator: voiceChannel.guild.voiceAdapterCreator,
	});

	const player = createAudioPlayer();
	const resource = createAudioResource(
		path.join(__dirname, 'audio', selectedFile)
	);

	player.play(resource);
	voiceConnection.subscribe(player);

	await interaction.deferUpdate();
	//   await interaction.followUp(`Now playing: ${selectedFile}`);

	// Handle the state change and disconnect when everyone leaves the channel
	client.on(Events.VoiceStateUpdate, (oldState, newState) => {
		if (
			voiceConnection &&
			oldState.channelId === voiceChannel.id &&
			!newState.channel
		) {
			const members = voiceChannel.members.filter((member) => !member.user.bot);
			if (
				members.size === 0 &&
				voiceConnection.state.status !== VoiceConnectionStatus.Destroyed
			) {
				player.stop();
				voiceConnection.destroy();
			}
		}
	});

	client.on('messageCreate', async (message) => {
		if (message.content === 'vc stop') {
			player.stop();
		}
	});

	client.once(Events.InteractionCreate, async (interactionStop) => {
		if (!interactionStop.isButton()) return;

		if (interactionStop.customId === 'Stop') {
			player.stop();
			await interactionStop.deferUpdate();
		}
	});
});

client.login(process.env.TOKEN);
