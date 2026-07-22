const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { imageToWebp, videoToWebp } = require('../lib/mediaToWebp');
const { writeExif } = require('../lib/stickerExif');

function findMediaTarget(msg) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (quoted?.imageMessage || quoted?.videoMessage) {
    return {
      message: quoted,
      key: {
        remoteJid: msg.key.remoteJid,
        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
        participant: msg.message.extendedTextMessage.contextInfo.participant
      }
    };
  }
  if (msg.message?.imageMessage || msg.message?.videoMessage) {
    return { message: msg.message, key: msg.key };
  }
  return null;
}

module.exports = {
  name: 'sticker',
  aliases: ['s', 'stiker'],
  description: 'Turn an image/short video into a sticker (send as caption, or reply to media with .sticker)',
  execute: async ({ sock, msg, from, settings }) => {
    const target = findMediaTarget(msg);
    if (!target) {
      await sock.sendMessage(from, {
        text: 'Send an image or short video (under ~8s) with caption *.sticker*, or reply to one with *.sticker*.'
      });
      return;
    }

    await sock.sendMessage(from, { text: '⏳ Making your sticker...' });

    try {
      const isVideo = !!target.message.videoMessage;
      
      if (isVideo) {
        const duration = target.message.videoMessage?.seconds || 0;
        if (duration > 8) {
          await sock.sendMessage(from, {
            text: '❌ Video is too long. Maximum duration is 8 seconds.'
          });
          return;
        }
      }

      const buffer = await downloadMediaMessage(
        { key: target.key, message: target.message },
        'buffer',
        {}
      );

      if (!buffer || buffer.length === 0) {
        await sock.sendMessage(from, {
          text: '❌ Could not download the media. Try again.'
        });
        return;
      }

      const webp = isVideo ? await videoToWebp(buffer) : await imageToWebp(buffer);
      
      if (!webp || webp.length === 0) {
        await sock.sendMessage(from, {
          text: '❌ Could not convert to sticker format. Try a different image or video.'
        });
        return;
      }

      const finalBuffer = await writeExif(webp, settings.botName, settings.ownerName);
      
      await sock.sendMessage(from, { sticker: finalBuffer });
    } catch (err) {
      console.error('Sticker error:', err.message);
      await sock.sendMessage(from, {
        text: '❌ Could not create the sticker. Make sure:\n• The video is under 8 seconds\n• The image/video format is supported\n• The file size is not too large'
      });
    }
  }
};
