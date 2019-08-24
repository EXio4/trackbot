
import { User } from 'node-telegram-bot-api'

export interface IUser {
    type: 'user',
    id: number,
    username: string,
}
export interface IEntity {
    type: 'entity',
    id: number,
    name: string,
}

export interface ITransaction {
    date: number,
    from: IUser | IEntity,
    to: IUser | IEntity,
    amount: number,
}
export interface IBalance {
    [x: string]: {
        balance: number,
    }
}

export interface IBalanceRet {
    username: string,
    balance: number,
}

export interface ITrackInfo {
    owner: IUser,
    peopleList: IUser[],
    transactions: ITransaction[],
    balance: IBalance,
}

export interface IDatabase {
    chats: {
        [x: string]: ITrackInfo,
    },
    /* entity ID matches attribute */
    entities: {
        [x: number]: IEntity,
    },
}

export const toUser = (x: User): IUser => ({
    type: 'user',
    id: x.id,
    username: x.username || x.first_name,
})
