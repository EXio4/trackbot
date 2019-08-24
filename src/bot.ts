
import TelegramBot, { Message } from 'node-telegram-bot-api'
import { IUser, ITransaction } from './types'
import config from '../config.json'

import * as db from './db'
import * as TG from './types'

const conn = new TelegramBot(config.apiKey, {
    polling: true,
})

const unconfirmed: {
    [x: string]: {
        sender: IUser,
        chatId: number,
        transaction: TG.ITransaction,
        message: Message,
        confirmed: IUser[],
    }
} = {}

conn.onText(/\/register/, async (msg, match) => {
    const chatId = msg.chat.id
    const senderId = msg.from
    if (!senderId) {
        return conn.sendMessage(chatId, `senderId missing`)
    }
    let ret = false
    try {
        ret = db.registerChat(chatId, TG.toUser(senderId))
    } catch (err) {
        console.warn(err)
    }
    return conn.sendMessage(chatId, ret ? 'Registered channel!' : 'Error registering channel, might be already registered')
})

conn.onText(/\/addme/, async (msg, match) => {
    const chatId = msg.chat.id
    const senderId = msg.from
    if (!senderId) {
        return conn.sendMessage(chatId, `senderId missing`)
    }
    if (!db.registered(chatId)) {
        return conn.sendMessage(chatId, `group not registered`)
    }

    try {
        const ret = db.registerUser(chatId, TG.toUser(senderId))
        return conn.sendMessage(chatId, ret ? `registered you in the group ❤️` : `you already in bby`)
    } catch (err) {
        console.error(err)
    }
    return conn.sendMessage(chatId, `something failed 😢`)
})

conn.onText(/\/balance/, async (msg, match) => {
    const chatId = msg.chat.id
    const senderId = msg.from
    if (!senderId) {
        return conn.sendMessage(chatId, `senderId missing`)
    }
    if (!db.registered(chatId)) {
        return conn.sendMessage(chatId, `group not registered`)
    }

    try {
        const balance = db.getBalance(chatId)
        let balanceText = 'Balances:\n\n'
        for (const blc of balance) {
            balanceText += `*${blc.username}*: _${blc.balance} ARS_\n\n`
        }
        conn.sendMessage(chatId, balanceText, {
            parse_mode: 'Markdown',
        })
    } catch (err) {
        console.error(err)
    }
})

conn.onText(/\/paid ([0-9]+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const resp = Number(match && match[1])
    const sender = msg.from
    if (!sender) {
        conn.sendMessage(chatId, `senderId missing`)
        return
    }
    const user = TG.toUser(sender)
    if (isNaN(resp)) {
        return conn.sendMessage(chatId, `value must be integer`)
    }
    if (resp <= 0) {
        return conn.sendMessage(chatId, `must be positive`)
    }
    if (!db.registered(chatId, user)) {
        return conn.sendMessage(chatId, `group not registered`)
    }

    const act = await conn.sendMessage(chatId, `${sender.username || sender.first_name} paid ${resp} ARS, is this right?`, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '👍', callback_data: 'paid:confirm' },
                    { text: '👎', callback_data: 'paid:cancel'  },
                ],
            ],
        },
    })

    unconfirmed[act.message_id] = {
        sender: user,
        chatId,
        transaction: {
            date: Math.floor(+new Date() / 1000),
            from: {
                type: 'entity',
                id: 0,
                name: 'In-Money',
            },
            to: user,
            amount: resp,
        },
        message: act,
        confirmed: [],
    }

})

conn.on('callback_query', async (query) => {
    const msg = query.message
    const data = query.data
    const sender = query.from
    if (!sender) {
        console.error(`from missing in query`, query)
        return
    }
    const user = TG.toUser(sender)
    if (!msg) {
        console.error(`msg not defined in query`, query)
        return
    }
    if (!data) {
        console.error(`data not defined in query`, query)
        return
    }
    const matchingIx = unconfirmed[msg.message_id]
    if (!matchingIx) {
        console.error(`invalid callback`)
        return
    }

    if (!db.partOf(matchingIx.chatId, user)) {
        conn.answerCallbackQuery(query.id, {
            text: 'you are not part of this group, add yourself with /addme',
        })
        return
    }

    if (data === 'paid:confirm') {
        const existingUser = matchingIx.confirmed.findIndex((x) => x.id === user.id)
        if (existingUser >= 0) {
            conn.answerCallbackQuery(query.id, {
                text: 'you already confirmed this action',
            })
            return
        }
        unconfirmed[msg.message_id].confirmed.push(user)
        const list = unconfirmed[msg.message_id].confirmed
        if (db.fullyConfirmed(matchingIx.chatId, list)) {
            db.addTransaction(matchingIx.chatId, matchingIx.transaction)
            await conn.deleteMessage(matchingIx.message.chat.id, matchingIx.message.message_id as any)
            await conn.sendMessage(matchingIx.message.chat.id, `
                transaction finished: ${matchingIx.sender.username} paid ${matchingIx.transaction.amount}
            `)
            delete unconfirmed[msg.message_id]
            conn.answerCallbackQuery(query.id, {
                text: 'you finished the transaction, congrats!',
            })
        } else {
            conn.answerCallbackQuery(query.id, {
                text: 'confirmed transaction',
            })
        }
    } else if (data === 'paid:cancel') {
        await conn.deleteMessage(matchingIx.message.chat.id, matchingIx.message.message_id as any)
        await conn.sendMessage(matchingIx.message.chat.id, `
            transaction cancelled: ${matchingIx.sender.username}'s ${matchingIx.transaction.amount} ARS payment denied by ${user.username}
        `)
        delete unconfirmed[msg.message_id]
        conn.answerCallbackQuery(query.id, {
            text: 'guess that was not right',
        })
    }
})
