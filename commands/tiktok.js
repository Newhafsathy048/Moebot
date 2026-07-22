const axios = require('axios');

async function fetchTikTokVideo(url) {
  try {
    // Try primary API first
    const { data } = await axios.get('https://www.tikwm.com/api/', {
      params: { url },
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const videoUrl = data?.data?.play;
    if (videoUrl) return videoUrl;
  } catch (err) {
    console.warn('TikWM API failed:', err.message);
  }

  // Fallback: try alternative approach
  try {
    const { data } = await axios.get('https://api.tiktok.com/v1/video', {
      params: { url },
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const videoUrl = data?.video?.downloadAddr || data?.video?.playAddr;
    if (videoUrl) return videoUrl;
  } catch (err) {
    console.warn('Fallback API failed:', err.message);
  }

  return null;
}

module.exports = {
  name: 'tiktok',
  aliases: ['tt'],
  description: 'Download a TikTok video without watermark (usage: .tiktok <link>)',
  execute: async ({ sock, from, args }) => {
    const url = args[0];
    if (!url || !url.includes('tiktok.com')) {
      await sock.sendMessage(from, { text: 'Usage: .tiktok <tiktok video link>' });
      return;
    }

    await sock.sendMessage(from, { text: '⏳ Fetching video...' });

    try {
      const videoUrl = await fetchTikTokVideo(url);
      
      if (!videoUrl) {
        await sock.sendMessage(from, {
          text: '❌ Could not extract video URL. The video might be private, deleted, or the download service is down.'
        });
        return;
      }

      await sock.sendMessage(from, {
        video: { url: videoUrl },
        caption: '🎬 TikTok video'
      });
    } catch (err) {
      console.error('TikTok download error:', err.message);
      await sock.sendMessage(from, {
        text: '❌ Could not download that TikTok video. The link might be invalid, private, or the download service is temporarily unavailable.'
      });
    }
  }
};
