import express, { Application } from "express";
import socketIO, { Server as SocketIOServer } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import * as path from 'path';

export class Server {
    private httpServer: HTTPServer;
    private app: Application;
    private io: SocketIOServer;

    private readonly DEFAULT_PORT = 5000;

    // Store sockets
    private userSockets: string[] = [];
    private carriSocket: string;
    private driverSocket: string;

    constructor() {
        this.initialize();

        this.handleRoutes();
        this.configureApp();
        this.handleSocketConnection();
    }

    private initialize(): void {
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = socketIO(this.httpServer);
    }

    private configureApp(): void {
        this.app.use(express.static(path.join(__dirname, "../public")));
    }

    private handleRoutes(): void {
        /*this.app.get("/", (req, res) => {
          res.send(`<h1>Hello World</h1>`); 
        });*/
    }

    private handleSocketConnection(): void {
        // Set up a callback for each time a socket is called
        this.io.on("connection", socket => {
            // The set-type message identifies who the connected socket is
            // This is used for verification and sending to other clients so they can interact with those
            socket.on("set-type", (data: any) => {
                console.log("Socket " + socket.id + " says it is " + data.type)
                // todo verify key/token
                if (data.type === "carri") {
                    this.carriSocket = socket.id;
                    // Tell CARRI that we have a driver
                    if (this.driverSocket) {
                        socket.emit("driver-connect", this.driverSocket);
                        socket.to(this.driverSocket).emit("carri-connect", this.carriSocket);
                    }
                }
                else if (data.type === "driver") {
                    this.driverSocket = socket.id;
                    // Reset "room"
                    // Whenever the driver connects, get rid of all the user sockets because this is when a new care session starts
                    // Probably will rework this to be more robust at some point
                    this.userSockets = [];
                    // Tell CARRI that the driver connected
                    if (this.carriSocket) {
                        socket.to(this.carriSocket).emit("driver-connect", socket.id);
                        socket.emit("carri-connect", this.carriSocket);
                    }
                }
                else if (data.type === "user") {
                    if (this.driverSocket) {
                        // Tell all current users that a user connected
                        socket.to(this.driverSocket).emit("user-connect", socket.id);
                        if (this.carriSocket) {
                            socket.to(this.carriSocket).emit("user-connect", socket.id);
                        }
                        this.userSockets.forEach(user => {
                            socket.to(user).emit("user-connect", socket.id);
                        });

                        this.userSockets.push(socket.id);
                    }
                    // Can't connect because we don't have a driver
                }
            });

            // These events basically forward data to other clients
            socket.on("offer", (data: any) => {
                socket.to(data.to).emit('offer', {from: socket.id, offer: data.offer});
            });

            socket.on("answer", (data: any) => {
                socket.to(data.to).emit('answer', {from: socket.id, answer: data.answer});
            });

            socket.on("ice", (data: any) => {
                socket.to(data.to).emit('ice', {from: socket.id, candidate: data.candidate});
            });
            
            // When a socket disconnects, handle it gracefully
            socket.on('disconnect', () => {
                if (this.carriSocket == socket.id) {
                    this.carriSocket = null;
                }
                if (this.driverSocket == socket.id) {
                    this.driverSocket = null;
                }
                if (socket.id in this.userSockets) {
                    delete this.userSockets[this.userSockets.indexOf(socket.id)];
                }
            });
        });
    }

    public listen(callback: (port: number) => void): void {
        this.httpServer.listen(this.DEFAULT_PORT, () =>
            callback(this.DEFAULT_PORT)
        );
    }
}