const {
  Client, GatewayIntentBits, Partials, ActivityType,
  EmbedBuilder, PermissionsBitField, REST, Routes,
  SlashCommandBuilder, ChannelType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

const PREFIX       = '$';
const TOKEN        = process.env.DISCORD_TOKEN;
const GUILD_ID     = process.env.GUILD_ID;

const DATA         = path.join(__dirname, 'data');
const REPLIES_FILE = path.join(DATA, 'replies.json');
const LINES_FILE   = path.join(DATA, 'lines.json');
const WARNS_FILE   = path.join(DATA, 'warns.json');

function loadJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function getTopRole(member) {
  return member.roles.cache
    .filter(r => !r.managed && r.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .first();
}

function getManagedRoles(guild) {
  const botTop = guild.members.me.roles.highest;
  return [...guild.roles.cache
    .filter(r => !r.managed && r.id !== guild.id && r.position < botTop.position)
    .sort((a, b) => a.position - b.position)
    .values()];
}

const slashCommands = [
  new SlashCommandBuilder().setName('help').setDescription('يعرض قائمة الأوامر'),
  new SlashCommandBuilder().setName('up').setDescription('يرقي عضو عدد من الرولات')
    .addUserOption(o => o.setName('عضو').setDescription('الشخص').setRequired(true))
    .addIntegerOption(o => o.setName('عدد').setDescription('عدد الرولات (افتراضي 1)').setMinValue(1)),
  new SlashCommandBuilder().setName('down').setDescription('ينزل عضو عدد من الرولات')
    .addUserOption(o => o.setName('عضو').setDescription('الشخص').setRequired(true))
    .addIntegerOption(o => o.setName('عدد').setDescription('عدد الرولات (افتراضي 1)').setMinValue(1)),
  new SlashCommandBuilder().setName('mute').setDescription('يكتم عضو')
    .addUserOption(o => o.setName('عضو').setDescription('الشخص').setRequired(true))
    .addStringOption(o => o.setName('سبب').setDescription('السبب')),
  new SlashCommandBuilder().setName('unmute').setDescription('يرفع الكتم عن عضو')
    .addUserOption(o => o.setName('عضو').setDescription('الشخص').setRequired(true)),
  new SlashCommandBuilder().setName('kick').setDescription('يطرد عضو')
    .addUserOption(o => o.setName('عضو').setDescription('الشخص').setRequired(true))
    .addStringOption(o => o.setName('سبب').setDescription('السبب')),
  new SlashCommandBuilder().setName('ban').setDescription('يحظر عضو')
    .addUserOption(o => o.setName('عضو').setDescription('الشخص').setRequired(true))
    .addStringOption(o => o.setName('سبب').setDescription('السبب')),
  new SlashCommandBuilder().setName('warn').setDescription('ينذر عضو')
    .addUserOption(o => o.setName('عضو').setDescription('الشخص').setRequired(true))
    .addStringOption(o => o.setName('سبب').setDescription('السبب').setRequired(true)),
  new SlashCommandBuilder().setName('warns').setDescription('يعرض إنذارات عضو')
    .addUserOption(o => o.setName('عضو').setDescription('الشخص').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('يمسح رسائل من الشات')
    .addIntegerOption(o => o.setName('عدد').setDescription('عدد الرسائل (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('lock').setDescription('يقفل الروم'),
  new SlashCommandBuilder().setName('unlock').setDescription('يفتح الروم'),
  new SlashCommandBuilder().setName('say').setDescription('يرسل رسالة باسم البوت')
    .addStringOption(o => o.setName('نص').setDescription('الرسالة').setRequired(true)),
  new SlashCommandBuilder().setName('setstatus').setDescription('يغير حالة البوت')
    .addStringOption(o => o.setName('نوع').setDescription('النوع').setRequired(true)
      .addChoices(
        { name: 'playing',   value: 'playing'   },
        { name: 'streaming', value: 'streaming' },
        { name: 'watching',  value: 'watching'  },
        { name: 'listening', value: 'listening' },
      ))
    .addStringOption(o => o.setName('نص').setDescription('نص الحالة').setRequired(true))
    .addStringOption(o => o.setName('رابط').setDescription('رابط للسترييم (اختياري)')),
  new SlashCommandBuilder().setName('addreply').setDescription('يضيف رد تلقائي')
    .addStringOption(o => o.setName('كلمة').setDescription('الكلمة المحفزة').setRequired(true))
    .addStringOption(o => o.setName('رد').setDescription('الرد').setRequired(true)),
  new SlashCommandBuilder().setName('reply').setDescription('يعرض الردود التلقائية'),
  new SlashCommandBuilder().setName('deletereply').setDescription('يحذف رد تلقائي')
    .addStringOption(o => o.setName('كلمة').setDescription('الكلمة').setRequired(true)),
  new SlashCommandBuilder().setName('addline').setDescription('يضيف خط تلقائي')
    .addStringOption(o => o.setName('كلمة').setDescription('الكلمة المحفزة').setRequired(true))
    .addStringOption(o => o.setName('رابط').setDescription('الرابط').setRequired(true)),
  new SlashCommandBuilder().setName('lines').setDescription('يعرض الخطوط المضافة'),
  new SlashCommandBuilder().setName('deleteline').setDescription('يحذف خط')
    .addStringOption(o => o.setName('كلمة').setDescription('الكلمة').setRequired(true)),
].map(c => c.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once('clientReady', async () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  client.user.setActivity(`${PREFIX}help | /help`, { type: ActivityType.Playing });
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: slashCommands });
      console.log('✅ تم تسجيل أوامر السلاش (Guild)');
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
      console.log('✅ تم تسجيل أوامر السلاش (Global)');
    }
  } catch (e) {
    console.error('❌ خطأ في تسجيل السلاش:', e);
  }
});

async function cmdHelp(send) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 قائمة الأوامر')
    .setDescription(`يدعم البريفكس \`${PREFIX}\` وأوامر السلاش \`/\``)
    .addFields(
      { name: '🎖️ الرولات', value: '`up @شخص [عدد]` — يرقيه\n`down @شخص [عدد]` — ينزله' },
      { name: '🔨 الإدارة', value: '`mute @شخص` — كتم\n`unmute @شخص` — رفع كتم\n`kick @شخص` — طرد\n`ban @شخص` — حظر\n`clear [عدد]` — مسح رسائل' },
      { name: '⚠️ الإنذارات', value: '`warn @شخص السبب` — ينذر\n`warns @شخص` — يعرض الإنذارات' },
      { name: '🔒 الروم', value: '`lock` — يقفل\n`unlock` — يفتح' },
      { name: '💬 الردود', value: '`addreply كلمة رد`\n`reply` — يعرض\n`deletereply كلمة`' },
      { name: '🔗 الخطوط', value: '`addline كلمة رابط`\n`lines` — يعرض\n`deleteline كلمة`' },
      { name: '⚙️ أخرى', value: '`say نص`\n`setstatus playing|streaming|watching|listening نص`\n`help`' },
    )
    .setFooter({ text: 'made with ❤️' }).setTimestamp();
  await send({ embeds: [embed] });
}

async function cmdUp(guild, member, steps, send) {
  const allRoles = getManagedRoles(guild);
  const topRole  = getTopRole(member);
  const curIdx   = topRole ? allRoles.findIndex(r => r.id === topRole.id) : -1;
  const newRole  = allRoles[Math.min(curIdx + steps, allRoles.length - 1)];
  if (!newRole || (topRole && newRole.id === topRole.id))
    return send(`⚠️ **${member.user.username}** وصل لأعلى رول ممكن.`);
  if (topRole) await member.roles.remove(topRole).catch(() => null);
  await member.roles.add(newRole).catch(() => null);
  await send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(
    `⬆️ تم ترقية **${member.user.username}** بـ **${steps}** رول\n` +
    (topRole ? `من: **${topRole.name}**\n` : '') + `إلى: **${newRole.name}**`
  )] });
}

async function cmdDown(guild, member, steps, send) {
  const allRoles = getManagedRoles(guild);
  const topRole  = getTopRole(member);
  if (!topRole) return send(`⚠️ **${member.user.username}** ما عنده أي رول.`);
  const curIdx   = allRoles.findIndex(r => r.id === topRole.id);
  const newRole  = curIdx - steps < 0 ? null : allRoles[Math.max(curIdx - steps, 0)];
  await member.roles.remove(topRole).catch(() => null);
  if (newRole) await member.roles.add(newRole).catch(() => null);
  await send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(
    `⬇️ تم تخفيض **${member.user.username}** بـ **${steps}** رول\n` +
    `من: **${topRole.name}**\n` + (newRole ? `إلى: **${newRole.name}**` : `وأصبح بدون رول`)
  )] });
}

async function cmdMute(guild, member, reason, send) {
  let muteRole = guild.roles.cache.find(r => r.name === 'Muted');
  if (!muteRole) {
    muteRole = await guild.roles.create({ name: 'Muted', permissions: [] }).catch(() => null);
    if (muteRole) {
      for (const [, ch] of guild.channels.cache)
        await ch.permissionOverwrites.create(muteRole, { SendMessages: false, Speak: false }).catch(() => null);
    }
  }
  if (!muteRole) return send('❌ فشل إنشاء رول Muted.');
  await member.roles.add(muteRole).catch(() => null);
  await send({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(
    `🔇 تم كتم **${member.user.username}**\nالسبب: ${reason || 'لم يُذكر'}`
  )] });
}

async function cmdUnmute(guild, member, send) {
  const muteRole = guild.roles.cache.find(r => r.name === 'Muted');
  if (!muteRole || !member.roles.cache.has(muteRole.id))
    return send(`⚠️ **${member.user.username}** ما هو مكتوم.`);
  await member.roles.remove(muteRole).catch(() => null);
  await send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(
    `🔊 تم رفع الكتم عن **${member.user.username}**`
  )] });
}

async function cmdKick(member, reason, send) {
  const name = member.user.username;
  await member.kick(reason || 'لم يُذكر سبب').catch(() => null);
  await send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(
    `🦶 تم طرد **${name}**\nالسبب: ${reason || 'لم يُذكر'}`
  )] });
}

async function cmdBan(guild, userId, username, reason, send) {
  await guild.members.ban(userId, { reason: reason || 'لم يُذكر سبب' }).catch(() => null);
  await send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(
    `🔨 تم حظر **${username}**\nالسبب: ${reason || 'لم يُذكر'}`
  )] });
}

async function cmdWarn(guild, target, reason, mod, send) {
  const warns = loadJSON(WARNS_FILE);
  if (!warns[target.id]) warns[target.id] = [];
  warns[target.id].push({ reason, date: new Date().toISOString(), by: mod.username });
  saveJSON(WARNS_FILE, warns);
  await send({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(
    `⚠️ تم إنذار **${target.username}**\nالسبب: **${reason}**\nإجمالي الإنذارات: **${warns[target.id].length}**`
  )] });
}

async function cmdWarns(target, send) {
  const warns = loadJSON(WARNS_FILE);
  const list  = warns[target.id];
  if (!list || list.length === 0) return send(`📭 **${target.username}** ما عنده إنذارات.`);
  const embed = new EmbedBuilder().setColor(0xFEE75C)
    .setTitle(`⚠️ إنذارات ${target.username} (${list.length})`)
    .setDescription(list.map((w, i) =>
      `**${i + 1}.** ${w.reason} — بواسطة ${w.by} — <t:${Math.floor(new Date(w.date).getTime() / 1000)}:d>`
    ).join('\n'));
  await send({ embeds: [embed] });
}

async function cmdClear(channel, amount, send) {
  const deleted = await channel.bulkDelete(amount, true).catch(() => null);
  const msg = await send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(
    `🧹 تم مسح **${deleted ? deleted.size : amount}** رسالة.`
  )] });
  setTimeout(() => { if (msg && msg.delete) msg.delete().catch(() => null); }, 3000);
}

async function cmdLock(channel, guild, send) {
  await channel.permissionOverwrites.edit(guild.id, { SendMessages: false }).catch(() => null);
  await send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('🔒 تم قفل الروم.')] });
}

async function cmdUnlock(channel, guild, send) {
  await channel.permissionOverwrites.edit(guild.id, { SendMessages: null }).catch(() => null);
  await send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription('🔓 تم فتح الروم.')] });
}

function cmdSetStatus(type, text, url) {
  const typeMap = {
    playing: ActivityType.Playing, streaming: ActivityType.Streaming,
    watching: ActivityType.Watching, listening: ActivityType.Listening,
  };
  client.user.setActivity(text, { type: typeMap[type], url: url || undefined });
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const content      = message.content;
  const lowerContent = content.toLowerCase();

  const lines = loadJSON(LINES_FILE);
  for (const [trigger, link] of Object.entries(lines)) {
    if (lowerContent.includes(trigger.toLowerCase())) {
      await message.delete().catch(() => {});
      await message.channel.send(link);
      return;
    }
  }

  const replies = loadJSON(REPLIES_FILE);
  for (const [keyword, reply] of Object.entries(replies)) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      await message.reply(reply);
      return;
    }
  }

  if (!content.startsWith(PREFIX)) return;
  const args    = content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const send    = (data) => message.channel.send(data);
  const noPerms = (flag) => !message.member.permissions.has(flag);

  if (command === 'help') return cmdHelp(send);

  if (command === 'up') {
    if (noPerms(PermissionsBitField.Flags.ManageRoles)) return send('❌ ما عندك صلاحية إدارة الرولات.');
    const member = message.mentions.members.first();
    if (!member) return send('❌ الاستخدام: `$up @شخص [عدد]`');
    return cmdUp(message.guild, member, parseInt(args.find(a => !a.startsWith('<'))) || 1, send);
  }

  if (command === 'down') {
    if (noPerms(PermissionsBitField.Flags.ManageRoles)) return send('❌ ما عندك صلاحية إدارة الرولات.');
    const member = message.mentions.members.first();
    if (!member) return send('❌ الاستخدام: `$down @شخص [عدد]`');
    return cmdDown(message.guild, member, parseInt(args.find(a => !a.startsWith('<'))) || 1, send);
  }

  if (command === 'mute') {
    if (noPerms(PermissionsBitField.Flags.ManageRoles)) return send('❌ ما عندك صلاحية.');
    const member = message.mentions.members.first();
    if (!member) return send('❌ الاستخدام: `$mute @شخص [سبب]`');
    return cmdMute(message.guild, member, args.filter(a => !a.startsWith('<')).join(' '), send);
  }

  if (command === 'unmute') {
    if (noPerms(PermissionsBitField.Flags.ManageRoles)) return send('❌ ما عندك صلاحية.');
    const member = message.mentions.members.first();
    if (!member) return send('❌ الاستخدام: `$unmute @شخص`');
    return cmdUnmute(message.guild, member, send);
  }

  if (command === 'kick') {
    if (noPerms(PermissionsBitField.Flags.KickMembers)) return send('❌ ما عندك صلاحية طرد الأعضاء.');
    const member = message.mentions.members.first();
    if (!member) return send('❌ الاستخدام: `$kick @شخص [سبب]`');
    return cmdKick(member, args.filter(a => !a.startsWith('<')).join(' '), send);
  }

  if (command === 'ban') {
    if (noPerms(PermissionsBitField.Flags.BanMembers)) return send('❌ ما عندك صلاحية حظر الأعضاء.');
    const user = message.mentions.users.first();
    if (!user) return send('❌ الاستخدام: `$ban @شخص [سبب]`');
    return cmdBan(message.guild, user.id, user.username, args.filter(a => !a.startsWith('<')).join(' '), send);
  }

  if (command === 'warn') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    const user = message.mentions.users.first();
    if (!user) return send('❌ الاستخدام: `$warn @شخص السبب`');
    const reason = args.filter(a => !a.startsWith('<')).join(' ');
    if (!reason) return send('❌ اكتب السبب.');
    return cmdWarn(message.guild, user, reason, message.author, send);
  }

  if (command === 'warns') {
    const user = message.mentions.users.first();
    if (!user) return send('❌ الاستخدام: `$warns @شخص`');
    return cmdWarns(user, send);
  }

  if (command === 'clear') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    await message.delete().catch(() => null);
    return cmdClear(message.channel, Math.min(parseInt(args[0]) || 10, 100), send);
  }

  if (command === 'lock') {
    if (noPerms(PermissionsBitField.Flags.ManageChannels)) return send('❌ ما عندك صلاحية.');
    return cmdLock(message.channel, message.guild, send);
  }

  if (command === 'unlock') {
    if (noPerms(PermissionsBitField.Flags.ManageChannels)) return send('❌ ما عندك صلاحية.');
    return cmdUnlock(message.channel, message.guild, send);
  }

  if (command === 'say') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    const text = args.join(' ');
    if (!text) return send('❌ الاستخدام: `$say النص`');
    await message.delete().catch(() => null);
    return message.channel.send(text);
  }

  if (command === 'setstatus') {
    if (noPerms(PermissionsBitField.Flags.Administrator)) return send('❌ للأدمن فقط.');
    const type = args.shift()?.toLowerCase();
    if (!['playing','streaming','watching','listening'].includes(type))
      return send('❌ الاستخدام: `$setstatus playing|streaming|watching|listening النص`');
    const urlMatch = args.join(' ').match(/(https?:\/\/\S+)/);
    const url  = urlMatch ? urlMatch[1] : null;
    const text = args.join(' ').replace(url || '', '').trim();
    if (!text) return send('❌ اكتب نص الحالة.');
    cmdSetStatus(type, text, url);
    return send({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`✅ تم تغيير الحالة: **${type}** — ${text}`)] });
  }

  if (command === 'addreply') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    const keyword = args.shift(); const reply = args.join(' ');
    if (!keyword || !reply) return send('❌ الاستخدام: `$addreply الكلمة الرد`');
    const data = loadJSON(REPLIES_FILE); data[keyword] = reply; saveJSON(REPLIES_FILE, data);
    return send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ تمت إضافة رد:\nالكلمة: **${keyword}**\nالرد: **${reply}**`)] });
  }

  if (command === 'reply') {
    const data = loadJSON(REPLIES_FILE); const entries = Object.entries(data);
    if (!entries.length) return send('📭 ما فيه ردود مضافة.');
    return send({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('📋 الردود التلقائية').setDescription(entries.map(([k,v]) => `• **${k}** ← ${v}`).join('\n'))] });
  }

  if (command === 'deletereply') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    const keyword = args.join(' ');
    if (!keyword) return send('❌ الاستخدام: `$deletereply الكلمة`');
    const data = loadJSON(REPLIES_FILE);
    if (!data[keyword]) return send(`❌ ما فيه رد بكلمة **${keyword}**.`);
    delete data[keyword]; saveJSON(REPLIES_FILE, data);
    return send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`✅ تم حذف الرد للكلمة: **${keyword}**`)] });
  }

  if (command === 'addline') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    const trigger = args.shift(); const link = args.join(' ');
    if (!trigger || !link) return send('❌ الاستخدام: `$addline الكلمة الرابط`');
    const data = loadJSON(LINES_FILE); data[trigger] = link; saveJSON(LINES_FILE, data);
    return send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ تمت إضافة الخط:\nالكلمة: **${trigger}**\nالرابط: ${link}`)] });
  }

    if (command === 'lines') {
    const data = loadJSON(LINES_FILE); const entries = Object.entries(data);
    if (!entries.length) return send('📭 ما فيه خطوط مضافة.');
    return send({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🔗 الخطوط المضافة').setDescription(entries.map(([k,v]) => `• **${k}** ← ${v}`).join('\n'))] });
  }

  if (command === 'deleteline') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    const trigger = args.join(' ');
    if (!trigger) return send('❌ الاستخدام: `$deleteline الكلمة`');
    const data = loadJSON(LINES_FILE);
    if (!data[trigger]) return send(`❌ ما فيه خط بكلمة **${trigger}**.`);
    delete data[trigger]; saveJSON(LINES_FILE, data);
    return send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`✅ تم حذف الخط للكلمة: **${trigger}**`)] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guild, channel, member: iMember, user } = interaction;
  const send = async (data) => {
    if (interaction.deferred || interaction.replied) return interaction.editReply(data);
    return interaction.reply(data);
  };
  const noPerms = (flag) => !iMember.permissions.has(flag);
  await interaction.deferReply();

  if (commandName === 'help') return cmdHelp(send);
  if (commandName === 'up') {
    if (noPerms(PermissionsBitField.Flags.ManageRoles)) return send('❌ ما عندك صلاحية.');
    return cmdUp(guild, interaction.options.getMember('عضو'), interaction.options.getInteger('عدد') || 1, send);
  }
  if (commandName === 'down') {
    if (noPerms(PermissionsBitField.Flags.ManageRoles)) return send('❌ ما عندك صلاحية.');
    return cmdDown(guild, interaction.options.getMember('عضو'), interaction.options.getInteger('عدد') || 1, send);
  }
  if (commandName === 'mute') {
    if (noPerms(PermissionsBitField.Flags.ManageRoles)) return send('❌ ما عندك صلاحية.');
    return cmdMute(guild, interaction.options.getMember('عضو'), interaction.options.getString('سبب') || '', send);
  }
  if (commandName === 'unmute') {
    if (noPerms(PermissionsBitField.Flags.ManageRoles)) return send('❌ ما عندك صلاحية.');
    return cmdUnmute(guild, interaction.options.getMember('عضو'), send);
  }
  if (commandName === 'kick') {
    if (noPerms(PermissionsBitField.Flags.KickMembers)) return send('❌ ما عندك صلاحية.');
    return cmdKick(interaction.options.getMember('عضو'), interaction.options.getString('سبب') || '', send);
  }
  if (commandName === 'ban') {
    if (noPerms(PermissionsBitField.Flags.BanMembers)) return send('❌ ما عندك صلاحية.');
    const target = interaction.options.getUser('عضو');
    return cmdBan(guild, target.id, target.username, interaction.options.getString('سبب') || '', send);
  }
  if (commandName === 'warn') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    return cmdWarn(guild, interaction.options.getUser('عضو'), interaction.options.getString('سبب'), user, send);
  }
  if (commandName === 'warns') return cmdWarns(interaction.options.getUser('عضو'), send);
  if (commandName === 'clear') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    return cmdClear(channel, interaction.options.getInteger('عدد'), send);
  }
  if (commandName === 'lock') {
    if (noPerms(PermissionsBitField.Flags.ManageChannels)) return send('❌ ما عندك صلاحية.');
    return cmdLock(channel, guild, send);
  }
  if (commandName === 'unlock') {
    if (noPerms(PermissionsBitField.Flags.ManageChannels)) return send('❌ ما عندك صلاحية.');
    return cmdUnlock(channel, guild, send);
  }
  if (commandName === 'say') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    await send('✅ تم الإرسال.');
    return channel.send(interaction.options.getString('نص'));
  }
  if (commandName === 'setstatus') {
    if (noPerms(PermissionsBitField.Flags.Administrator)) return send('❌ للأدمن فقط.');
    const type = interaction.options.getString('نوع');
    const text = interaction.options.getString('نص');
    const url  = interaction.options.getString('رابط');
    cmdSetStatus(type, text, url);
    return send({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`✅ تم تغيير الحالة: **${type}** — ${text}`)] });
  }
  if (commandName === 'addreply') {
    if (noPerms(PermissionsBitField.Flags.ManageMessages)) return send('❌ ما عندك صلاحية.');
    const keyword = interaction.options.getString('كلمة');
    const reply   = interaction.options.getString('رد');
    const data    = loadJSON(REPLIES_FILE); data[keyword] = reply; saveJSON(REPLIES_FILE, data);
    return send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ تمت إضافة رد:\n**${keyword}** ← **${reply}**`)] });
  }
  if (commandName === 'reply') {
    const data = loadJSON(REPLIES_FILE); const entries = Object.entries(data);
