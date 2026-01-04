const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionsBitField 
} = require('discord.js');

const express = require('express'); // keep bot alive on Railway
const app = express();
app.get('/', (req, res) => res.send('Bot is online ✅'));
app.listen(3000, () => console.log('🌐 Web server running on port 3000'));

// ----------------------
// DISCORD CLIENT
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// LOGIN using environment variable
client.login(process.env.TOKEN);

// READY
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ----------------------
// CREATE TICKET PANEL
// ----------------------
client.on('messageCreate', async (message) => {
  if (message.content === '!ticketpanel' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {

    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket Bot | Secure Ticket System')
      .setDescription('Press the button below to open a private ticket.')
      .setColor('Green')
      .setFooter({ text: 'Powered by Ticket Bot' });

    const button = new ButtonBuilder()
      .setCustomId('open_ticket')
      .setLabel('Open Ticket')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// ----------------------
// HANDLE BUTTON CLICKS
// ----------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const guild = interaction.guild;
  const user = interaction.user;

  // ------------- OPEN TICKET -------------
  if (interaction.customId === 'open_ticket') {
    // Check if ticket already exists
    const existing = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
    if (existing) return interaction.reply({ content: 'You already have an open ticket!', ephemeral: true });

    // Find the category
    const category = guild.channels.cache.find(c => c.name === 'tickets' && c.type === ChannelType.GuildCategory);
    if (!category) return interaction.reply({ content: '❌ Tickets category not found. Please create a category named "tickets".', ephemeral: true });

    // Create ticket channel under the category
    const ticketChannel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // everyone denied
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] } // user allowed
      ]
    });

    // Send embed inside ticket
    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Your Ticket')
      .setDescription('Staff will assist you shortly.\n\nUse the buttons below to **add users** or **close** the ticket.')
      .setColor('Purple');

    const addButton = new ButtonBuilder()
      .setCustomId('add_user')
      .setLabel('Add User')
      .setStyle(ButtonStyle.Primary);

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(addButton, closeButton);

    await ticketChannel.send({ content: `<@${user.id}>`, embeds: [ticketEmbed], components: [row] });
    interaction.reply({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });
  }

  // ------------- ADD USER -------------
  if (interaction.customId === 'add_user') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: '❌ Only staff can add users.', ephemeral: true });
    }

    await interaction.reply({ content: 'Please mention the user to add.', ephemeral: true });

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });

    collector.on('collect', async (msg) => {
      const userToAdd = msg.mentions.users.first();
      if (!userToAdd) return interaction.followUp({ content: '❌ No user mentioned.', ephemeral: true });

      await interaction.channel.permissionOverwrites.edit(userToAdd.id, {
        ViewChannel: true,
        SendMessages: true
      });

      interaction.followUp({ content: `✅ ${userToAdd.tag} has been added to the ticket.` });
      msg.delete(); // optional cleanup
    });
  }

  // ------------- CLOSE TICKET -------------
  if (interaction.customId === 'close_ticket') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });
    }

    await interaction.channel.send('🔒 Closing ticket in 5 seconds...');
    setTimeout(() => {
      interaction.channel.delete().catch(err => console.log(err));
    }, 5000);

    interaction.reply({ content: '✅ Ticket will be closed shortly.', ephemeral: true });
  }
});

