import { createStore, Store } from 'redux';
import { getLocal, Mockttp } from 'mockttp';
import { MockttpRequest } from '../types';

export interface StoreModel {
    server: Mockttp,
    serverStatus: ServerStatus,
    requests: MockttpRequest[]
}

export enum ServerStatus {
    Connecting,
    Connected,
    AlreadyInUse,
    UnknownError
}

export type Action =
    { type: 'UpdateServerStatus', value: ServerStatus } |
    { type: 'RequestReceived', request: MockttpRequest };

const reducer = (state: StoreModel, action: Action): StoreModel => {
    switch (action.type) {
        case 'RequestReceived':
            return Object.assign({}, state, { requests: state.requests.concat(action.request) });
        case 'UpdateServerStatus':
            return Object.assign({}, state, { serverStatus: action.value });
        default:
            return state;
    }
}

export async function getStore(): Promise<Store<StoreModel>> {
    const server = getLocal();

    const store = createStore<StoreModel>(reducer, {
        server: server,
        serverStatus: ServerStatus.Connecting,
        requests: []
    });

    server.start(8000).then(async () => {
        await server.get('/').thenReply(200, 'Running!');
        await server.anyRequest().always().thenPassThrough();

        console.log(`Server started on port ${server.port}`);

        store.dispatch<Action>({
            type: 'UpdateServerStatus',
            value: ServerStatus.Connected
        });

        server.on('request', (req) => store.dispatch<Action>({
            type: 'RequestReceived',
            request: req
        }));
    }).catch((err) => {
        // If we got a conflict response, then 
        if (err.response && err.response.status === 409) {
            console.info('Server already in use');
            store.dispatch<Action>({
                type: 'UpdateServerStatus',
                value: ServerStatus.AlreadyInUse
            });
        } else {
            store.dispatch<Action>({
                type: 'UpdateServerStatus',
                value: ServerStatus.UnknownError
            });
            console.error(err);
        }
    });

    return store;
}