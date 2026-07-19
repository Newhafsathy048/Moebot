# MoE — WhatsApp Bot

A simple WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys) (multi-device, no browser required).

- 👤 **Owner:** MoE
- 📱 **WhatsApp:** https://wa.me/message/HEYNTN2KD6K7O1
- ✉️ **Email:** moehafsathy@myyahoo.com
- 🔗 **GitHub:** https://github.com/Newhafsathy048

---

## ✨ Available Commands

| Command | Description |
|---|---|
| `.menu` / `.help` | Show the command list (with banner image) |
| `.ping` | Check bot speed |
| `.alive` | Check if the bot is online (uptime) |
| `.owner` | Get owner contact info |
| `.sticker` / `.s` | Turn an image or short video into a sticker (send as caption, or reply to media) |
| `.tiktok` / `.tt` | Download a TikTok video without watermark — `.tiktok <link>` |
| `.ig` | Download an Instagram photo/video/reel — `.ig <link>` |
| `.fb` | Download a public Facebook video — `.fb <link>` |
| `.play` / `.song` | Search & send a YouTube track as audio — `.play <song name>` |

**Group management (admin only — the owner, or a real group admin, can use these):**

| Command | Description |
|---|---|
| `.tagall` | Mention every member — `.tagall <message>` |
| `.hidetag` | Same as `.tagall`, but doesn't list names in the text |
| `.kick` | Remove a member — reply to them or `@mention` them |
| `.promote` | Make a member a group admin |
| `.demote` | Remove a member's admin rights |
| `.antilink` | Auto-delete WhatsApp group invite links from non-admins — `.antilink on` / `off` |
| `.welcome` | Auto welcome/goodbye messages on join/leave — `.welcome on` / `off` |

Group actions call the real WhatsApp group admin API, so **the bot's own account must be an admin in that group** for `.kick`/`.promote`/`.demote`/`.antilink` deletions to actually take effect — otherwise WhatsApp itself rejects the request.

**Fun:**

| Command | Description |
|---|---|
| `.8ball` | Ask a yes/no question — `.8ball <question>` |
| `.quote` | Get a random motivational quote |

**Settings (owner only):**

| Command | Description |
|---|---|
| `.autoviewstatus` | Auto-view contacts' status updates — `.autoviewstatus on` / `off` |
| `.antidelete` | Recover "delete for everyone" messages — `.antidelete on` / `off` |

Both default to **on** (matching the old always-on behaviour) and are saved to `data/botSettings.json`, so a toggle survives a restart.

**Two things worth knowing before you assume either one is "broken":**
- **Auto status view** only makes the bot mark a status as viewed. For that view to actually show up to the person who posted it, **your own WhatsApp must have Read Receipts turned on** (Settings → Privacy → Read Receipts). If you've turned that off for your account, no view — bot or manual — will ever appear to them; that's a WhatsApp privacy rule, not something the bot can work around.
- **Anti-delete** can only ever catch **"Delete for everyone."** A plain **"Delete for me"** never notifies anyone else's device — WhatsApp doesn't send any signal for it — so there is nothing for any bot to detect or recover in that case.

**Always-on features (no command needed):**
- **Auto Status React** — optional; off by default. Set `AUTO_STATUS_REACT=true` in your env to auto-react to statuses with an emoji (`AUTO_STATUS_EMOJI`, default 💚).

All toggles (`.antilink`, `.welcome`, `.autoviewstatus`, `.antidelete`) are saved under `data/` (created automatically, already gitignored) so none of them reset when the bot restarts.

Commands are auto-loaded from the `commands/` folder — drop in a new file (see `commands/ping.js` as a simple template) to add more without touching `index.js`.

### A note on the downloader commands

`.tiktok`, `.ig`, `.fb`, and `.play` all depend on free third-party/unofficial services (TikTok/Instagram/Facebook change their sites often, and YouTube actively fights downloaders). They're implemented with commonly-used, currently-working approaches, but **any of them can break without warning** if the upstream site changes — that's true of every WhatsApp bot with these features, not just this one. If one stops working, check the console error and let me know — usually it just means the extraction method needs a small update.

---

## 🚀 Run Locally

```bash
npm install
cp .env.example .env   # then set OWNER_NUMBER
npm start
```

The console will print a **pairing code**:

1. Open WhatsApp on your phone
2. Go to **Settings → Linked Devices → Link a Device**
3. Enter the pairing code shown in the terminal

> ⚠️ A `session/` folder is created after login — **never commit it to GitHub or share it with anyone**. It's equivalent to your WhatsApp account password.

> 💡 `npm install` pulls in `sharp` and `ffmpeg-static` (used for stickers), which download prebuilt binaries — this makes install a bit slower but means no manual ffmpeg setup is needed on the host.

---

## ☁️ Deploy on KataBump (or any panel-based host)

Panel hosts like KataBump, Pterodactyl, or similar don't give the process a real interactive terminal. The bot **never prompts for input** for this reason — it reads everything from environment variables instead. This bot is **pairing-code-only** (no QR code at all).

1. Upload the project files (or connect your GitHub repo: `https://github.com/Newhafsathy048`)
2. Set the **Startup/Environment Variable** on the panel:
   - `OWNER_NUMBER` = your WhatsApp number, digits only (e.g. `12136061765`)
3. Start the server, then open the console — the pairing code is printed there automatically, a few seconds after boot
4. Enter it on your phone: **WhatsApp → Settings → Linked Devices → Link a Device**

If `OWNER_NUMBER` isn't set, the bot won't crash — it prints a clear message telling you to set it, then exits cleanly so the panel shows a readable error instead of a stack trace.

### Previously hit this error?
```
Error [ERR_USE_AFTER_CLOSE]: readline was closed
```
That happened because the old code tried to ask for your number interactively (`readline.question`), which panel hosts don't support — the input stream gets closed before the prompt runs. This version removes that prompt entirely; the number always comes from `OWNER_NUMBER`.

---

## ☁️ Deploy on Railway

`railway.json` and `Procfile` are already included:

1. Push the code to your repo: `https://github.com/Newhafsathy048`
2. Connect the repo on Railway
3. Set the `OWNER_NUMBER` environment variable in the Railway dashboard
4. Deploy, then check the logs for the pairing code (no QR — pairing code only)

---

## 🛠️ Project Structure

```
MoE-Bot/
├── index.js              # WhatsApp connection + message handler (no interactive prompts)
├── settings.js            # Bot info (name, number, links)
├── assets/
│   └── menu.png             # Banner image sent with .menu
├── commands/               # One file per command
│   ├── menu.js
│   ├── ping.js
│   ├── alive.js
│   ├── owner.js
│   ├── sticker.js
│   ├── tiktok.js
│   ├── ig.js
│   ├── fb.js
│   ├── play.js
│   ├── tagall.js
│   ├── hidetag.js
│   ├── kick.js
│   ├── promote.js
│   ├── demote.js
│   ├── antilink.js
│   ├── welcome.js
│   ├── 8ball.js
│   ├── quote.js
│   ├── autoviewstatus.js
│   └── antidelete.js
├── lib/
│   ├── commandLoader.js    # Auto-loads every command
│   ├── server.js           # Health-check server (for Railway/KataBump/Render)
│   ├── autostatus.js       # Auto status view/react
│   ├── antidelete.js       # Deleted-message recovery
│   ├── mediaToWebp.js      # Image/video → webp for stickers
│   ├── stickerExif.js      # Sticker pack name/author metadata
│   ├── groupHelpers.js     # Admin checks + mention/reply target lookup
│   ├── groupSettings.js    # Per-group antilink/welcome toggle storage
│   ├── botSettings.js      # Bot-wide autoviewstatus/antidelete toggle storage
│   └── antilinkGuard.js    # Antilink enforcement (runs on every group message)
├── data/                    # Created automatically — per-group settings (gitignored)
└── session/                 # Created after pairing — never commit this!
```
