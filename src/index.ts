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

    socket.on('getRiderStatus', async function (authToken: string, beepersID: string) {
        const userid = await isTokenValid(authToken);

        if (!userid) {
            server.to(socket.id).emit('updateRiderStatus', makeJSONError("Your token is not valid."));
            return;
        }

        if (!beepersID) {
            server.to(socket.id).emit('updateRiderStatus', makeJSONError("You did not provide a beeper's id"));
            return;
        }

        let locationCursor: Cursor | null;

        r.table("queues").filter({ beeperid: beepersID, riderid: userid }).changes({ includeInitial: false }).run((await database.getConn()), function(error: Error, cursor: Cursor) {
            if (error) {
                console.error(error);
                Sentry.captureException(error);
            }
           
            cursor.on("data", async function() {
                server.to(socket.id).emit('updateRiderStatus');
            });

            socket.on('stopGetRiderStatus', function stop() {
                cursor.close();
                if (locationCursor) locationCursor.close();
                socket.removeListener("stopGetRiderStatus", stop);
            });

            socket.on("disconnect", () => {
                cursor.close();
            });
        });

        r.table("locations").filter({ user: beepersID }).changes({ includeInitial: false }).run((await database.getConn()), async function(error: Error, cursor: Cursor) {
            if (error) {
                Sentry.captureException(error);
                console.log(error);
            }

            locationCursor = cursor;

            cursor.on("data", async function(locationValue) {
                console.log("Pushing Location update to riders:", locationValue.new_val);
                server.to(socket.id).emit('hereIsBeepersLocation', locationValue.new_val);
            });

            socket.on("disconnect", () => {
                cursor.close();
            });
        });
    });

    socket.on('getQueue', async function (userid: string) {
        r.table("queues").filter({ beeperid: userid }).changes({ includeInitial: false, squash: true }).run((await database.getConn()), function(error: Error, cursor: Cursor) {
            if (error) {
                console.error(error);
                Sentry.captureException(error);
            }

            cursor.on("data", function() {
                server.to(socket.id).emit('updateQueue');
            });

            socket.on('stopGetQueue', function stop() {
                cursor.close();
                socket.removeListener("stopGetQueue", stop);
            });

            socket.on("disconnect", () => {
                cursor.close();
            });
        });
    });

    socket.on('getUser', async function (authToken: string) {

        const userid = await isTokenValid(authToken);

        if (!userid) {
            server.to(socket.id).emit('updateUser', makeJSONError("Your token is not valid."));
            return;
        }

        //@ts-ignore
        r.table("users").get(userid).changes({ includeInitial: true, squash: true }).run((await database.getConn()), function(error: Error, cursor: any) {
            if (error) {
                console.error(error);
                Sentry.captureException(error);
            }

            cursor.on("data", function(data: any) {
                server.to(socket.id).emit('updateUser', formulateUserUpdateData(data));
            });

            socket.on('stopGetUser', function stop() {
                cursor.close();
                socket.removeListener("stopGetUser", stop);
            });

            socket.on("disconnect", () => {
                cursor.close();
                console.log("User", userid, "disconnected. Closing all RethinkDB Cursors for user!");
            });
        });
    });

    socket.on('updateUsersLocation', async function (authToken: string, latitude: number, longitude: number, altitude: number, accuracy: number, altitudeAccuracy: number, heading: number, speed: number) {
        const userid = await isTokenValid(authToken);

        if (!userid) {
            return console.log("Token is not valid. Just skipping this entry attempt");
        }

        const dataToInsert = {
            user: userid,
            latitude: latitude,
            longitude: longitude,
            altitude: altitude,
            accuracy: accuracy,
            altitudeAccuracy: altitudeAccuracy,
            heading: heading,
            speed: speed,
            timestamp: Date.now()
        };

        try {
            const result: r.WriteResult = await r.table("locations").insert(dataToInsert).run((await database.getConn()));
            if (result.inserted > 0) {
                console.log("Beeper", userid, "inserted a location update!");
            }
        } 
        catch (error) {
            Sentry.captureException(error);
            console.log(error);
        }
    });

    socket.on('getLocations', async function (authToken: string) {
        const userid = await isTokenValid(authToken);

        if (!userid) {
            return console.log("Token is not valid.");
        }

        r.table("locations").changes({ includeInitial: false }).run((await database.getConn()), async function(error: Error, cursor: Cursor) {
            if (error) {
                Sentry.captureException(error);
                console.log(error);
            }

            cursor.on("data", async function(data) {
                server.to(socket.id).emit('data', data);
            });

            socket.on("disconnect", () => {
                cursor.close();
            });
        });
    });
});

database.connect(() => {
    server.listen(3000);
    console.log("Running Beep Socket on http://0.0.0.0:3000");
});
