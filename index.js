import express from "express";
import { config } from "dotenv";
import { applyCors, requireApiKey } from "./middleware/security.js";
import { connectDb } from "./lib/db.js";
import codesRouter from "./routes/codes.js";
import materialsRouter from "./routes/materials.js";
import voRouter from "./routes/vo.js";

config();

if (!process.env.API_KEY) {
  console.error("API_KEY is not set. Refusing to start an open API.");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || process.env.PROT || 3000;

applyCors(app);
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("home");
});

app.use(requireApiKey);
app.use(codesRouter);
app.use(materialsRouter);
app.use(voRouter);

async function start() {
  try {
    await connectDb(process.env.MONGO_DB_URL);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

start();
