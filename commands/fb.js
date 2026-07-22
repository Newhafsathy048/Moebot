const axios = require('axios');

async function extractFbVideoUrl(link) {
  const { data: html } = await axios.get(link, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    },
    timeout: 20000
  });

  // Try multiple patterns for video URL extraction
  const patterns = [
    /"browser_native_hd_url":"(.*?)"/,
    /"browser_native_sd_url":"(.*?)"/,
    /"video":{"stream":"(.*?)"/,
    /"src":"(https:\/\/[^"]*video[^"]*)"/
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const raw = match[1];
      return raw.replace(/\\u0025/g, '%').replace(/\\\//g, '/').replace(/&amp;/g, '&');
    }
  }

  return null;
}

module.exports = {
  name: 'fb',
  aliases: ['facebook'],
  description: 'Download a public Facebook video (usage: .fb <link>)',
  execute: async ({ sock, from, args }) => {
    const url = args[0];
    if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
      await sock.sendMessage(from, { text: 'Usage: .fb <facebook video link>' });
      return;
    }

    await sock.sendMessage(from, { text: '⏳ Fetching video...' });

    try {
      const videoUrl = await extractFbVideoUrl(url);
      if (!videoUrl) {
        await sock.sendMessage(from, {
          text: '❌ Could not find video URL. The video might be:\n• Private or restricted\n• Deleted\n• From a live stream\n• Not a direct video link'
        });
        return;
      }

      await sock.sendMessage(from, { 
        video: { url: videoUrl },
        caption: '🎬 Facebook video'
      });
    } catch (err) {
      console.error('Facebook download error:', err.message);
      await sock.sendMessage(from, {
        text: '❌ Could not download that Facebook video. Make sure:\n• The link points to a public video\n• The video is not age-restricted\n• You have access to the video'
      });
    }
  }
};
