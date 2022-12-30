const config = require("../config")
const { MessageEmbed, DataResolver, EmbedBuilder } = require('discord.js');
const fs = require('fs')

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Get id of mentioned role in a message
        // ToDo check all mentioned roles/not just the first
        const mentionedRoleId = message.mentions.roles.keys().next().value
        const channelId = message.channelId

        const roleRules = await config.MENTION_ROLE_RULES(mentionedRoleId);

        // Check if rules are existing and channel id the set one from config
        if (!roleRules || channelId != roleRules.channelId) return

        // React with all emojis given in config
        roleRules.reactions.forEach((currentEmoji) => {
            message.react(currentEmoji)
        })

        // Ask for notification if enabled
        if (config.NOTIFICATION_RULES.askForNotifications == false) return

        const selfdestructionTimer = config.NOTIFICATION_RULES().askForNotificationsTimout
        const embed = getNotificationEmbed(selfdestructionTimer)


        let replyMessage = await message.reply({ embeds: [embed] })
        roleRules.reactions.forEach(async (currentEmoji) => {
            replyMessage.react(currentEmoji)
        })

        const filter = (reaction, user) => user.id == message.author.id

        // Save reactions where the bot should notify the users
        let notifyOnEmojis = []
        let collector = replyMessage.createReactionCollector({ filter, time: selfdestructionTimer })
        collector.on('collect', (reaction, collector) => {
            notifyOnEmojis.push(reaction._emoji.name)
        });
        collector.on('end', async collected => {
            replyMessage.delete()
            if (notifyOnEmojis.length > 0) {
                message.react("🗑️")
                let notificationMessage = await message.reply(
                    `<@${message.author.id}> ich werde dich bei ${notifyOnEmojis.join(", ")} benachrichtigen. Um die 
					Benachrichtigungen abzuschalten, hit that :wastebasket: in deiner Nachricht`
                )
                setTimeout(() => {
                    notificationMessage.delete()
                }, selfdestructionTimer)

                // To have a full list of all users who reacted to the message
                // ToDo Users should be removed from this list if they revoke their reaction
                let reactionsWithUsers = {}
                notifyOnEmojis.forEach(emoji => {
                    reactionsWithUsers[emoji] = []
                })

                // Actually wait for the reactions and notify the user if reactions are added
                let notifyUser = true
                const notificationTimeout = config.NOTIFICATION_RULES().timeoutForNotifications
                let notifyCollector = message.createReactionCollector({ time: notificationTimeout })

                notifyCollector.on('collect', (reaction, user) => {
                    if (user.id == message.author.id && reaction._emoji.name == "🗑️") {
                        notifyUser = false
                        message.author.send("Benachrichtungen deaktiviert!")
                    }

                    if (!notifyUser) return

                    // This prevents users from spamming with readding their reaction
                    if (!notifyOnEmojis.includes(reaction._emoji.name) || (reactionsWithUsers[reaction._emoji.name].includes(user.id))) return

                    reactionsWithUsers[reaction._emoji.name].push(user.id)
                    const reportEmbed = getReportEmbed(reaction, user, message, reactionsWithUsers, mentionedRoleId)
                    message.author.send({ embeds: [reportEmbed] })


                })
            }
        });

    },
};


function getNotificationEmbed(timeout) {
    const embed = new EmbedBuilder()
        .setColor('#141014')
        .setTitle('Benachrichtigung bei Reactions')
        .setDescription('Möchtest du benachrichtigt werden wenn jemand auf deine Nachricht reagiert?')
        .addFields(
            { name: "Yes", value: 'Reagiere auf mit dem Emoji bei dem du benachrichtigt werden möchtest', inline: false},
            { name: "No", value: 'Ignorier mich halt einfach, pf', inline: false},
        )
        .setFooter({text: `Selbstzerstörung aktiv: ${timeout / 1000}s`});

    return embed


}

function getReportEmbed(reaction, collector, message, reactionsWithUsers, roleID) {
    const messageContent = message.content.replace(`<\@\&${roleID}>`, "@some-role") // Removes that @deleted-role from notification messages

    const embed = new EmbedBuilder()
        .setColor('#141014')
        .addFields(
            { name: 'Jemand reagierte auf deine Nachricht', value: `<@${collector.id}> reagierte mit ${reaction._emoji.name}`, inline: false},
            { name: "Deine Nachricht", value: `\> ${messageContent}`}
        )
        .setFooter({ text: "Captain Coalition", iconURL: "https://cdn.discordapp.com/icons/329211845720276992/52734b508929961e0731c00dd2c9f4ae.webp?size=96"})

    Object.keys(reactionsWithUsers).forEach(currentEmoji => {
        if (reactionsWithUsers[currentEmoji].length == 0) return

        let usersString = ""
        for (let i = 0; i <= reactionsWithUsers[currentEmoji].length - 1; i++) {
            usersString = usersString + `<@${reactionsWithUsers[currentEmoji][i]}>`

            // only add ", " if current user isnt the last one
            if (!(i == reactionsWithUsers[currentEmoji].length - 1)) {
                usersString = usersString + ", "
            }
        }

        embed.addFields({
            name: `Reaktionen mit ${currentEmoji}`, value: `${usersString}`
        })
    })

    return embed
}
