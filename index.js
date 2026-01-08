import * as dotenv from "dotenv";
dotenv.config();

import express from 'express';
import http from "http";
import cors from 'cors';

import ApiError from "./errors/errors.js";
import errorHandler from "./middleware/errorHandler.js";
import { validateApiKey } from './middleware/apiKey.js';
import connectDB from "./config/mongo.js";

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(validateApiKey);

app.use('/api', (req, res) => {
  res.send("Hello World");
});

app.use((req, res, next) => next(ApiError.notFound("Route not found")));
  
app.use(errorHandler);

connectDB().then(() => {
  server.listen(port, () => {
    console.log(`Server is running on port ${port}...`);
  });
});