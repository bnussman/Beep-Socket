import { Server, Socket } from "socket.io";
import * as r from "rethinkdb";
import * as Sentry from "@sentry/node";
import { Cursor } from "rethinkdb";
import { isTokenValid, formulateUserUpdateData } from "./utils/helpers";
import { makeJSONError } from "./utils/json";
import { initializeSentry } from "./utils/sentry";
import database from "./utils/db";

const server = new Server();

initializeSentry();

server.on("connection", function (socket: Socket) {

    let isBeeping = false;
    let isInRide = false;
    let isGettingUser = false;

    socket.on('getRiderStatus', async function (beepersID: string) {
        r.table(beepersID).changes({ squash: true }).run((await database.getConnQueues()), function(error: Error, cursor: Cursor) {
            if (error) {
                Sentry.captureException(error);
            }
           
            isInRide = true;

            cursor.on("data", function() {
                server.to(socket.id).emit('updateRiderStatus');
            });

            socket.on('stopGetRiderStatus', function stop() {
                isInRide = false;
                cursor.close();
                socket.removeListener("stopGetRiderStatus", stop);
            });
        });
    });

    socket.on('isInRide', function () {
        server.to(socket.id).emit("isInRideData", String(isInRide));
    });

    socket.on('getQueue', async function (userid: string) {
        r.table(userid).changes({ includeInitial: false, squash: true }).run((await database.getConnQueues()), function(error: Error, cursor: Cursor) {
            if (error) {
                Sentry.captureException(error);
            }

            isBeeping = true;

            cursor.on("data", function() {
                server.to(socket.id).emit('updateQueue');
            });

            socket.on('stopGetQueue', function stop() {
                isBeeping = false;
                cursor.close();
                socket.removeListener("stopGetQueue", stop);
            });
        });
    });

    socket.on('isBeeping', function () {
        server.to(socket.id).emit("isBeepingData", String(isBeeping));
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

            isGettingUser = true;

            cursor.on("data", function(data: any) {
                server.to(socket.id).emit('updateUser', formulateUserUpdateData(data));
            });

            socket.on('stopGetUser', function stop() {
                isGettingUser = false;
                cursor.close();
                socket.removeListener("stopGetUser", stop);
            });
        });
    });

    socket.on('isGettingUser', function () {
        server.to(socket.id).emit("isGettingUserData", String(isGettingUser));
    });
});

database.connect(() => {
    server.listen(3000);
    console.log("Running Beep Socket on http://0.0.0.0:3000");
});
