const ytSearch = require('yt-search');
const ytdl = require('@distube/ytdl-core');

module.exports = {
  name: 'play',
  aliases: ['song'],
  description: 'Search & send a YouTube audio track (usage: .play <song name>)',
  execute: async ({ sock, from, args }) => {
    const query = args.join(' ');
    if (!query) {
      await sock.sendMessage(from, { text: 'Usage: .play <song name>' });
      return;
    }

    await sock.sendMessage(from, { text: `🔎 Searching for "${query}"...` });

    try {
      const { videos } = await ytSearch(query);
      if (!videos?.length) {
        await sock.sendMessage(from, { text: '❌ No results found.' });
        return;
      }

      const video = videos[0];
      await sock.sendMessage(from, {
        text: `🎵 *${video.title}*\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ Downloading audio...`
      });

      try {
        const stream = ytdl(video.url, { 
          filter: 'audioonly', 
          quality: 'highestaudio',
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        });
        
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        if (buffer.length === 0) {
          await sock.sendMessage(from, {
            text: '❌ Downloaded file is empty. The video might be restricted or unavailable.'
          });
          return;
        }

        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: 'audio/mpeg',
          fileName: `${video.title}.mp3`
        });
      } catch (downloadErr) {
        console.error('YouTube download error:', downloadErr.message);
        await sock.sendMessage(from, {
          text: '❌ Could not download the audio. The video might be age-restricted, region-locked, or YouTube has changed its protection. Try a different song.'
        });
      }
    } catch (err) {
      console.error('Play command error:', err.message);
      await sock.sendMessage(from, {
        text: '❌ Search failed. YouTube frequently changes its site — try again in a moment or search for a different song.'
      });
    }
  }
};
