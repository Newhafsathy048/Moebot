const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
  proto
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const chalk = require('chalk');

const settings = require('./settings');
const { loadCommands } = require('./lib/commandLoader');
const { startServer } = require('./lib/server');
const { handleStatusUpdate } = require('./lib/autostatus');
const { cacheMessage, handleRevoke } = require('./lib/antidelete');
const { isGroup } = require('./lib/groupHelpers');
const { getGroupSettings } = require('./lib/groupSettings');
const { enforceAntilink } = require('./lib/antilinkGuard');

const SESSION_DIR = path.join(__dirname, 'session');

// No interactive terminal prompts anywhere in this file — hosting panels
// (Railway, KataBump, Pterodactyl, etc.) don't provide a real stdin, and
// trying to read from it crashes the process with ERR_USE_AFTER_CLOSE.
// The phone number must come from the OWNER_NUMBER environment variable.
// This bot is pairing-code-only — there is no QR code fallback.
const ownerNumber = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');

const commands = loadCommands();

function printBanner() {
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.green.bold(`   ${settings.botName} — WhatsApp Bot`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.white(`Owner   : ${settings.ownerName} (+${settings.ownerNumber})`));
  console.log(chalk.white(`GitHub  : ${settings.github}`));
  console.log(chalk.white(`Email   : ${settings.email}`));
  console.log(chalk.white(`Commands: ${new Set(commands.values()).size} loaded`));
  console.log(chalk.white(`Login   : Pairing code (number: +${ownerNumber || '???'})`));
  console.log(chalk.white(`Extras  : Auto Status View, Anti-Delete, Antilink, Welcome/Goodbye`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

async function startBot() {
  if (!ownerNumber) {
    console.log(chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.red('❌ OWNER_NUMBER is not set.'));
    console.log(chalk.yellow('   Set it as an environment variable (digits only, e.g. 12136061765)'));
    console.log(chalk.yellow('   then restart the bot — the pairing code will appear here automatically.'));
    console.log(chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    process.exit(1);
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    logger: pino({ level: 'silent' })
  });

  // Pairing code flow — runs automatically once, before the device is registered.
  // No prompts, no QR: the number comes straight from OWNER_NUMBER.
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(ownerNumber);
        console.log(chalk.bgGreen.black(`\n  Pairing Code: ${code}  \n`));
        console.log(
          chalk.yellow(
            'Open WhatsApp > Settings > Linked Devices > Link a Device, then enter this code.'
          )
        );
      } catch (err) {
        console.error(chalk.red('Failed to get pairing code:'), err.message);
      }
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'connecting') {
      console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));
    }

    if (connection === 'open') {
      console.log(chalk.green(`✅ ${settings.botName} connected successfully!`));
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : null;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log(chalk.red('🚪 Logged out. Delete the "session" folder, then restart to get a fresh pairing code.'));
      } else {
        console.log(chalk.red('⚠️  Connection closed. Reconnecting...'));
        startBot();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    // A single upsert event can carry more than one message (e.g. several
    // arriving together after a reconnect) — process every one of them,
    // not just the first, or later entries in the batch are silently
    // dropped (missed status views, missed deletions, missed commands).
    for (const msg of messages) {
      if (!msg?.message) continue;

      // Status updates (auto view/react) never reach the command handler.
      if (msg.key.remoteJid === 'status@broadcast') {
        await handleStatusUpdate(sock, msg);
        continue;
      }

      // Message deletions: try to recover and repost the original content.
      if (msg.message.protocolMessage?.type === proto.Message.ProtocolMessage.Type.REVOKE) {
        await handleRevoke(sock, msg);
        continue;
      }

      // Cache every message (incl. our own) so it can be recovered if deleted.
      cacheMessage(msg);

      // IMPORTANT: this bot pairs to the OWNER's own WhatsApp number (self-bot,
      // no separate "bot number"). That means every command you type from your
      // own phone is ALSO reported by Baileys as fromMe:true — there is no way
      // to tell "the owner typed a command" apart from "the bot sent a reply"
      // using fromMe alone. So we do NOT skip fromMe messages here, or you
      // could never trigger a command from your own chat. What stops the bot
      // from misreading its own replies as new commands is the prefix check
      // inside handleMessage() below — the bot's replies never start with
      // settings.prefix, so they're ignored automatically.
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error(chalk.red('Error handling message:'), err);
      }
    }
  });

  // Welcome/goodbye — only fires for groups where `.welcome on` was set.
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      if (!getGroupSettings(id).welcome) return;
      if (action !== 'add' && action !== 'remove') return;

      const meta = await sock.groupMetadata(id);
      for (const participant of participants) {
        const tag = `@${participant.split('@')[0]}`;
        const text = action === 'add'
          ? `👋 Welcome ${tag} to *${meta.subject}*! Glad to have you here.`
          : `👋 ${tag} has left the group. Goodbye!`;
        await sock.sendMessage(id, { text, mentions: [participant] });
      }
    } catch (err) {
      console.error(chalk.red('group-participants.update error:'), err.message);
    }
  });

  return sock;
}

async function handleMessage(sock, msg) {
  const from = msg.key.remoteJid;
  const body =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    '';

  // Antilink runs on every group message (not just commands) since a link
  // someone drops doesn't start with the prefix — .antilink on/off (the
  // command file) only flips this per-group setting.
  if (isGroup(from)) {
    const blocked = await enforceAntilink(sock, msg, from, body);
    if (blocked) return;
  }

  if (!body.startsWith(settings.prefix)) return;

  const [rawCmd, ...args] = body.slice(settings.prefix.length).trim().split(/\s+/);
  const command = commands.get((rawCmd || '').toLowerCase());
  if (!command) return;

  await command.execute({ sock, msg, from, args, settings });
}

printBanner();
startServer(settings);
startBot().catch((err) => {
  console.error(chalk.red('Bot failed to start:'), err);
  process.exit(1);
});
