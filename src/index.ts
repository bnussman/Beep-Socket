import { Server, Socket } from "socket.io";
import * as r from "rethinkdb";
import * as Sentry from "@sentry/node";
import { Cursor } from "rethinkdb";
import { isTokenValid, formulateUserUpdateData } from "./utils/helpers";
import { makeJSONError } from "./utils/json";
import { initializeSentry } from "./utils/sentry";
import database from "./utils/db";

const server = new Server({
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

initializeSentry();

server.on("connection", function (socket: Socket) {

    socket.on('getRiderStatus', async function (beepersID: string) {
        r.table(beepersID).changes({ squash: true }).run((await database.getConnQueues()), function(error: Error, cursor: Cursor) {
            if (error) {
                Sentry.captureException(error);
            }
           
            cursor.on("data", function() {
                server.to(socket.id).emit('updateRiderStatus');
            });

            socket.on('stopGetRiderStatus', function stop() {
                cursor.close();
                socket.removeListener("stopGetRiderStatus", stop);
            });
        });
    });

    socket.on('getQueue', async function (userid: string) {
        r.table(userid).changes({ includeInitial: false, squash: true }).run((await database.getConnQueues()), function(error: Error, cursor: Cursor) {
            if (error) {
                Sentry.captureException(error);
            }

            cursor.on("data", function() {
                server.to(socket.id).emit('updateQueue');
            });

            socket.on('stopGetQueue', function stop() {
                cursor.close();
                socket.removeListener("stopGetQueue", stop);
            });
        });
    });

    socket.on('getUser', async function (authtoken: string) {

        const userid = await isTokenValid(authtoken);

        if (!userid) {
            server.to(socket.id).emit('updateUser', makeJSONError("Your token is not valid."));
            return;
        }

        //@ts-ignore
        r.table("users").get(userid).changes({ includeInitial: true, squash: true }).run((await database.getConn()), function(error: Error, cursor: any) {
            if (error) {
                Sentry.captureException(error);
            }

            cursor.on("data", function(data: any) {
                server.to(socket.id).emit('updateUser', formulateUserUpdateData(data));
            });

            socket.on('stopGetUser', function stop() {
                cursor.close();
                socket.removeListener("stopGetUser", stop);
            });
        });
    });
});

database.connect(() => {
    server.listen(3000);
    console.log("Running Beep Socket on http://0.0.0.0:3000");
});
