import { Server, Socket } from "socket.io";
import * as Sentry from "@sentry/node";
import { isTokenValid } from "./utils/helpers";
import { makeJSONError } from "./utils/json";
import { initializeSentry } from "./utils/sentry";
import db from "./utils/db";
import { ObjectId } from "mongodb";

class QueueItem {
    public rider: string;
    public origin: string;
    public destination: string;
    public groupSize: number;
    public isAccepted: boolean;
    public state: number;
    public timestamp: number;

    constructor(rider: string, origin: string, destination: string, groupSize: number) {
        this.rider = rider;
        this.origin = origin;
        this.destination = destination;
        this.groupSize = groupSize;
        this.isAccepted = false;
        this.state = 0;
        this.timestamp = Date.now();
    }
}

export class Queue {
    private queue: QueueItem[]

    constructor() {
        this.queue = [];
    }

    public join(entry: QueueItem) {
        this.queue.push(entry);
    }
    
    public accept(rider: string) {
        for (let i = 0; i < this.queue.length; i++) {
            if (this.queue[i].rider === rider) {
                this.queue[i].isAccepted = true;
            }
        }
    }
}

export class QueueManger {

    private queues: Map<string, Queue>;

    constructor() {
        this.queues = new Map();
    }

    public create(beeper: string) {
       this.queues.set(beeper, new Queue()); 
    }

    public get(beeper: string): Queue | undefined {
        return this.queues.get(beeper);
    }

    public remove(beeper: string): boolean {
        return this.queues.delete(beeper);
    }
}


const server = new Server();
const manager = new QueueManger();
const clients: Map<string, Socket> = new Map();
const userToSocketMapping: Map<string, string> = new Map();

server.on('connection', function (socket: Socket) {

    socket.on('auth', async function (authToken: string) {
        const userId = await isTokenValid(authToken);

        if (!userId) return console.log("Auth Failed");

        userToSocketMapping.set(socket.id, userId);

        clients.set(userId, socket);
    });

    socket.on('disconnect', () => {
        const userId = userToSocketMapping.get(socket.id);

        if (!userId) throw new Error("User not found in userToSocketMapping");

        clients.delete(userId);
    });
});


db.connect(() => {
    server.listen(3000);
    console.log("Running Beep Socket on http://0.0.0.0:3000");
});
