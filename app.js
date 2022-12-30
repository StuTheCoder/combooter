const {Client, GatewayIntentBits} = require('discord.js')
const fs = require("fs")
const client = new Client({
    intents:[
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions
    ]
})
const config = require("./config")
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
}

require('dotenv').config();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`)
})

client.login(process.env.TOKEN)