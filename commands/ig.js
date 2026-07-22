const { instagramGetUrl } = require('instagram-url-direct');

module.exports = {
  name: 'ig',
  aliases: ['instagram'],
  description: 'Download an Instagram photo/video post or reel (usage: .ig <link>)',
  execute: async ({ sock, from, args }) => {
    const url = args[0];
    if (!url || !url.includes('instagram.com')) {
      await sock.sendMessage(from, { text: 'Usage: .ig <instagram post/reel link>' });
      return;
    }

    await sock.sendMessage(from, { text: '⏳ Fetching media...' });

    try {
      const data = await instagramGetUrl(url);
      
      if (!data || !data.media_details || data.media_details.length === 0) {
        await sock.sendMessage(from, {
          text: '❌ Could not find media. The post might be private, deleted, or a Story (which is not supported).'
        });
        return;
      }

      const media = data.media_details[0];
      if (!media?.url) {
        await sock.sendMessage(from, {
          text: '❌ Could not extract media URL. Try a different post.'
        });
        return;
      }

      if (media.type === 'video' || media.type === 'VIDEO') {
        await sock.sendMessage(from, { 
          video: { url: media.url },
          caption: '🎬 Instagram video'
        });
      } else if (media.type === 'image' || media.type === 'IMAGE') {
        await sock.sendMessage(from, { 
          image: { url: media.url },
          caption: '📸 Instagram image'
        });
      } else {
        await sock.sendMessage(from, { 
          video: { url: media.url },
          caption: '📱 Instagram media'
        });
      }
    } catch (err) {
      console.error('Instagram download error:', err.message);
      await sock.sendMessage(from, {
        text: '❌ Could not download that Instagram link. It may be:\n• Private or restricted\n• A Story (not supported)\n• The account is rate-limiting requests\n\nTry again later or with a different post.'
      });
    }
  }
};
