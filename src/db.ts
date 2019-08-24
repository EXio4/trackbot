
import fs from 'fs'

import { IDatabase, ITrackInfo, IUser, ITransaction, IBalanceRet } from './types'

const fileName = '../db.json'
const fileNameOld = `${fileName}.old`
let db: IDatabase = {
    chats: {},
    entities: {
        [0]: {
            type: 'entity',
            id: 0,
            name: 'In-Money',
        },
        [-1]: {
            type: 'entity',
            id: -1,
            name: 'Out-Money',
        },
    },
}
let errorLoading = false

try {
    // tslint:disable-next-line: no-var-requires
    const file = fs.readFileSync(fileName, { encoding: 'utf8' })
    db = JSON.parse(file)
} catch (err) {
    console.warn(`error loading database, assuming empty state`, err)
    errorLoading = true
}

console.error(db)

export const save = () => {
    const txt = JSON.stringify(db)

    if (errorLoading) {
        try {
            fs.renameSync(fileName, fileNameOld)
        } catch (err) {
            console.warn(`error moving old file on error`, err)
        }
    }

    fs.writeFileSync(fileName, txt)
}

export const registerChat = (chatId: number, owner: IUser) => {
    if (!db.chats[chatId]) {
        db.chats[chatId] = {
            owner,
            peopleList: [owner],
            transactions: [],
            balance: {
                [owner.id]: {
                    balance: 0,
                },
            },
        }
        save()
        return true
    }
    return false
}

export const registerUser = (chatId: number, newUser: IUser) => {
    if (db.chats[chatId]) {
        const existing = db.chats[chatId].peopleList.findIndex((x) => x.id === newUser.id)
        console.warn(existing, db.chats[chatId].peopleList)
        if (existing === -1) {
            db.chats[chatId].peopleList.push(newUser)
            db.chats[chatId].balance[newUser.id] = {
                balance: 0,
            }
            save()
            return true
        }
    }
    return false
}

export const getInfo = (chatId: number): ITrackInfo | null => {
    if (!db.chats[chatId]) {
        return null
    } else {
        return db.chats[chatId]
    }
}

export const registered = (chatId: number, user?: IUser): boolean => {
    const chat = db.chats[chatId]
    if (!chat) {
        return false
    }
    if (user) {
        return chat.peopleList.findIndex((x) => x.id === user.id) >= 0
    }
    return true
}

export const fullyConfirmed = (chatId: number, userList: IUser[]): boolean => {
    const chat = db.chats[chatId]
    if (!chat) {
        return false
    }
    const users = chat.peopleList
    for (const usr of users) {
        if (userList.findIndex((x) => x.id === usr.id) === -1) {
            return false
        }
    }
    return true
}

export const addTransaction = (chatId: number, transaction: ITransaction) => {
    if (!db.chats[chatId]) {
        return
    }
    db.chats[chatId].transactions.push(transaction)

    if (transaction.from.type === 'user') {
        db.chats[chatId].balance[transaction.from.id].balance -= transaction.amount
    }

    if (transaction.to.type === 'user') {
        db.chats[chatId].balance[transaction.to.id].balance += transaction.amount
    }

    save()
}

export const getBalance = (chatId: number): IBalanceRet[] => {
    if (!db.chats[chatId]) {
        return []
    }
    const ret = []
    for (const user of db.chats[chatId].peopleList) {
        ret.push({
            username: user.username,
            balance: db.chats[chatId].balance[user.id].balance,
        })
    }
    return ret
}

export const partOf = (chatId: number, user: IUser) => {
    if (!db.chats[chatId]) {
        return false
    }
    return db.chats[chatId].peopleList.findIndex((x) => x.id === user.id) >= 0
}
