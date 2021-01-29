import { Server, Socket } from "socket.io";
import * as Sentry from "@sentry/node";
import { isTokenValid, formulateUserUpdateData } from "./utils/helpers";
import { makeJSONError } from "./utils/json";
import { initializeSentry } from "./utils/sentry";
import db from "./utils/db";
import {ObjectId} from "mongodb";

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

        //let locationCursor: Cursor | null;
        const filter = [{ $match: {'fullDocument.rider': userid } }];
        //const stream = db.beep().collection('queue-entry').watch(filter);
        const stream = db.beep().collection('queue-entry').watch(filter, { fullDocument: 'updateLookup' });

        stream.on("change", (changeEvent) => {
            console.log(changeEvent);

            server.to(socket.id).emit("updateRiderStatus");

            socket.on('stopGetRiderStatus', function stop() {
                stream.close();
                socket.removeListener("stopGetRiderStatus", stop);
            });

            socket.on("disconnect", () => {
                stream.close();
            });
        });

        /*
        r.table(beepersID).changes({ includeInitial: false }).run((await database.getConnLocations()), async function(error: Error, cursor: Cursor) {
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
        */
    });

    socket.on('getQueue', async function (userid: string) {
        const filter = [{ $match: {'fullDocument.beeper': new ObjectId(userid) } }];
        //const stream = db.beep().collection('queue-entry').watch(filter);
        const stream = db.beep().collection('queue-entry').watch(filter, { fullDocument: 'updateLookup' });

        stream.on("change", (changeEvent) => {
            console.log(changeEvent);

            server.to(socket.id).emit("updateQueue");

            socket.on('stopGetQueue', function stop() {
                stream.close();
                socket.removeListener("stopGetQueue", stop);
            });

            socket.on("disconnect", () => {
                stream.close();
            });
        });
    });

    socket.on('getUser', async function (authToken: string) {

        const userid = await isTokenValid(authToken);

        if (!userid) {
            server.to(socket.id).emit('updateUser', makeJSONError("Your token is not valid."));
            return;
        }

        const filter = [{ $match: { "fullDocument._id": userid}  }];
        const stream = db.beep().collection('user').watch(filter, { fullDocument: 'updateLookup' });

        stream.on("change", (changeEvent) => {
            console.log("user update", changeEvent);
            //@ts-ignore
            server.to(socket.id).emit('updateUser', formulateUserUpdateData(changeEvent));

            socket.on('stopGetQueue', function stop() {
                stream.close();
                socket.removeListener("stopGetQueue", stop);
            });

            socket.on("disconnect", () => {
                stream.close();
            });
        });

    });
    /*
    socket.on('updateUsersLocation', async function (authToken: string, latitude: number, longitude: number, altitude: number, accuracy: number, altitudeAccuracy: number, heading: number, speed: number) {
        const userid = await isTokenValid(authToken);

        if (!userid) {
            return console.log("Token is not valid. Just skipping this entry attempt");
        }

        const dataToInsert = {
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
            const result: r.WriteResult = await r.table(userid).insert(dataToInsert).run((await database.getConnLocations()));
            if (result.inserted > 0) {
                console.log("Beeper", userid, "inserted a location update!");
            }
        } 
        catch (error) {
            Sentry.captureException(error);
            console.log(error);
        }
    });
    */
});
db.connect(() => {
    server.listen(3000);
    console.log("Running Beep Socket on http://0.0.0.0:3000");
});
