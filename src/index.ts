import * as r from "rethinkdb";
import { Cursor } from "rethinkdb";
import { connQueues } from "./utils/db";
import * as io from 'socket.io';
import { Socket } from 'socket.io';

const server = io();

server.on("connection", function (socket: Socket) {

    socket.on('getRiderStatus', function (beepersID: string) {

        r.table(beepersID).changes({squash: true}).run(connQueues, function(error: Error, cursor: Cursor) {
            if (error) {
                throw error;
            }

            cursor.on("data", function() {
                server.to(socket.id).emit('updateRiderStatus');
            });

            socket.on('stopGetRiderStatus', function() {
                cursor.close();
            });

        });

    });

    socket.on('getQueue', function (userid: string) {

        r.table(userid).changes({includeInitial: false, squash: true}).run(connQueues, function(error: Error, cursor: Cursor) {
            if (error) {
                throw error;
            }

            cursor.on("data", function() {
                server.to(socket.id).emit('updateQueue');
            });

            socket.on('stopGetQueue', function() {
                cursor.close();
            });
        });

    });
});

server.listen(3000);
console.log("Running Beep Socket on 0.0.0.0:3000");
