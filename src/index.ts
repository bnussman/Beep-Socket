import * as r from "rethinkdb";
import { Cursor } from "rethinkdb";
import { conn, connQueues } from "./utils/db";
import * as io from 'socket.io';
import { Socket } from 'socket.io';
import Logger from "beep-logger-client";
import { isTokenValid, formulateUserUpdateData } from "./utils/helpers";

const logger = new Logger();
const server = io();

server.on("connection", function (socket: Socket) {
    console.log("connected");
    socket.on('getRiderStatus', function (beepersID: string) {
        r.table(beepersID).changes({squash: true}).run(connQueues, function(error: Error, cursor: Cursor) {
            if (error) {
                logger.error(error);
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

    socket.on('getQueue', function (userid: string) {
        r.table(userid).changes({includeInitial: false, squash: true}).run(connQueues, function(error: Error, cursor: Cursor) {
            if (error) {
                logger.error(error);
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

        console.log("User", userid, "wants to get their user with token", authtoken);

        if (!userid) {
            console.log("user not authenitcated");
            return;
        }

        //@ts-ignore
        r.table("users").get(userid).changes({includeInitial: true, squash: true}).run(conn, function(error: Error, cursor: any) {
            if (error) {
                logger.error(error);
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

server.listen(3000);
console.log("Running Beep Socket on 0.0.0.0:3000");
