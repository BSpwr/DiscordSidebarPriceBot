/** ------------------------------------------------------------------------------------------------
 * 
 *                         _(`-')    (`-').-> _  (`-')<-.(`-')  
 *                        ( (OO ).-> ( OO)_   \-.(OO ) __( OO)  
 *                        \    .'_ (_)--\_)  _.'    \'-'---.\  
 *                         '`'-..__)/    _ / (_...--''| .-. (/  
 *                         |  |  ' |\_..`--. |  |_.' || '-' `.) 
 *                         |  |  / :.-._)   \|  .___.'| /`'.  | 
 *                         |  '-'  /\       /|  |     | '--'  / 
 *                         `------'  `-----' `--'     `------'  
 *  
 *      Program:  DiscordSidebarPriceBot (DSPB)
 *       Author:  Piper
 *                  Discord:  cucurbit
 *                   Reddit:  piper_cucu
 *                  Twitter:  @PiperCucu
 *                   GitHub:  pipercucu
 *
 *  Description:  Discord bot for pulling cryptocurrency price data at intervals and displaying it in the users sidebar
 * 
 *                                ♡ Made with love in Alabama, USA
 * -------------------------------------------------------------------------------------------------*/
'use strict'

const auth = require('./auth.json');
const coinGeckoCmds = require('./coinGeckoCmds.js');
const Discord = require('discord.js');
const rp = require('request-promise');
const bot = new Discord.Client();

let UPDATE_INTERVAL;  // Price update interval in milliseconds
let TICKER;           // Which ticker to pull price for
let TOKEN_INDEX;      // Discord bot token index to use (in auth.json)
let ROTATE_PRICE;     // If unpopulated, keep price as $, otherwise rotate between $, ⟠ and ₿ with specified time interval
const ROTATE_PRICE_INTERVAL_MS = 5000

let priceData;
let guildMeCache = [];

// Ready up activities
bot.on('ready', () => {
  console.log(`Logged in as ${bot.user.tag}!`);
  bot.user.setActivity(`😀`);

  // Run the lookup loader
  coinGeckoCmds.loadLookupJson();

  bot.guilds.cache.each(guild => guildMeCache.push(guild.me));

  // Get ticker from args, default to ETH if unpopulated
  if (typeof process.argv[2] !== 'undefined') {
    TICKER = process.argv[2].toUpperCase();
  }
  else {
    TICKER = 'ETH'
  }

  // Get update interval from args, default to 1 minute if unpopulated
  if (typeof process.argv[3] !== 'undefined') {
    UPDATE_INTERVAL = process.argv[3];
  }
  else {
    UPDATE_INTERVAL = 60000;
  }

  // Rotate price between $, ⟠ and ₿ every 10 seconds if populated
  if (typeof process.argv[5] !== 'undefined') {
    ROTATE_PRICE = true;
  }
  else {
    ROTATE_PRICE = false;
  }

  getPrice();
  setInterval(getPrice, UPDATE_INTERVAL);

  if (ROTATE_PRICE) {
    setInterval(showPrice, ROTATE_PRICE_INTERVAL_MS);
  }
});

async function getPrice() {
  if (TICKER === 'ETHEREUMGASTICKER' || TICKER === '⛽') {
    getGas();
    return;
  }

  let data = await coinGeckoCmds.getPrice(ROTATE_PRICE ? [TICKER, 'ETH', 'BTC'] : [TICKER]);
  priceData = { showPriceType: '$' };
  let foundTokenKeys = Object.keys(data.found);
  foundTokenKeys.forEach(key => {
    let tokenData = data.found[key];

    if (TICKER === 'ETH' || TICKER === 'BTC') {
      priceData.ticker = TICKER
    } else {
      if (key !== 'ETH' && key !== 'BTC') {
        priceData.ticker = key;
      }
    }
    
    priceData[key] = {
      currPrice: tokenData.usd,
      pastPrice: tokenData.usd / ((100 + tokenData.usd_24h_change) / 100),
      change24H: Math.ceil(tokenData.usd_24h_change * 100) / 100,
      changeArrow: tokenData.usd_24h_change > 0 ? '(↗)' : (tokenData.usd_24h_change < 0 ? '(↘)' : '(→)')
    };
  });

  if (ROTATE_PRICE) {
    ['ETH', 'BTC'].forEach(comparison => {
      let currPrice = priceData[priceData.ticker].currPrice / priceData[comparison].currPrice;
      let pastPrice = priceData[priceData.ticker].pastPrice / priceData[comparison].pastPrice;
      let change24H = ((currPrice - pastPrice) / pastPrice * 100).toFixed(2);
      if (comparison === 'BTC' && currPrice < 0.00001) {
        currPrice = (currPrice * 100000000).toFixed(0) + 'sat';
      } else {
        currPrice = currPrice.toFixed(5);
      }
      priceData[priceData.ticker + comparison] = {
        currPrice: currPrice,
        pastPrice: pastPrice,
        change24H: change24H,
        changeArrow: change24H > 0 ? '(↗)' : (change24H < 0 ? '(↘)' : '(→)')
      };
    })
  }
  else {
    showPrice();
  }
}

function showPrice() {
  if (!priceData) {
    return;
  }

  let priceKey;
  let showPriceType = priceData.showPriceType + '';

  switch(priceData.showPriceType) {
    case '$':
      priceKey = priceData.ticker;
      if (ROTATE_PRICE) {
        priceData.showPriceType = '⟠';
      }
      break;
    case '⟠':
      priceKey = priceData.ticker + 'ETH';
      priceData.showPriceType = '₿';
      break;
    case '₿':
      priceKey = priceData.ticker + 'BTC';
      priceData.showPriceType = '$';
      break;
    default:
      break
  }

  if (!(priceData.ticker === 'ETH' && showPriceType === '⟠') && !(priceData.ticker === 'BTC' && showPriceType === '₿')) {
    guildMeCache.forEach(guildMe => guildMe.setNickname(`${priceData.ticker} ${showPriceType}${priceData[priceKey].currPrice} ${priceData[priceKey].changeArrow}`));
    bot.user.setActivity(`${showPriceType} 24h: ${priceData[priceKey].change24H}%`);
    //console.log(`${priceData.ticker} $${priceData[priceKey].currPrice} ${priceData[priceKey].change24H}%`);
  }
}

function getGas() {
  rp(`https://www.gasnow.org/api/v3/gas/price?utm_source=:${auth.appName}`)
    .then(res => {
      try {
        const parsedData = JSON.parse(res);
        const rapid = parsedData.data.rapid / 1000000000;
        const standard = parsedData.data.standard / 1000000000;
        const slow = parsedData.data.slow / 1000000000;
        guildMeCache.forEach(guildMe => guildMe.setNickname(`⚡${rapid.toFixed(0)} gwei`));
        bot.user.setActivity(`🚶${standard.toFixed(0)} 🐢${slow.toFixed(0)}`);
      } catch (e) {
        console.error(e.message);
      }
    }).catch((e) => {
      console.error(`Got error: ${e.message}`);
    });
}

// Get token index from args, default to 0
if (typeof process.argv[4] !== 'undefined') {
  TOKEN_INDEX = process.argv[4];
}
else {
  TOKEN_INDEX = 0;
}

// New server join event that causes the guild cache to refresh
bot.on('guildCreate', guild => {
  bot.guilds.cache.each(guild => guildMeCache.push(guild.me));
  console.log(`New server has added the bot! Name: ${guild.name}`);
});

bot.login(auth.discordBotTokens[TOKEN_INDEX]);