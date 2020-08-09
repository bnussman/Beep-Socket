import * as r from 'rethinkdb';
import { Connection, ConnectionOptions } from 'rethinkdb';

const connQueuesOptions: ConnectionOptions = ({
    host: '192.168.1.116',
    port: 28015,
    db: 'beepQueues'
});

let connQueues: Connection;

r.connect(connQueuesOptions).then((connection: Connection) => {
    connQueues = connection;
});

export { connQueues };
