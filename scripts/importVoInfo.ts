import { config } from "dotenv";
import mongoose from "mongoose";
import Codes from "../schemas/Codes.js";
import fs from "fs";

config();

async function importVoInfo(): Promise<void> {
  const mongoUrl = process.env.MONGO_DB_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_DB_URL is not set");
  }

  await mongoose.connect(mongoUrl);

  try {
    const data = fs.readFileSync("voDbUpdated.text", "utf-8");
    const lines = data.split("\n");

    await Codes.updateMany({}, { info: "" });
    for (const line of lines) {
      const [code, description] = line.split(" x ");

      if (code && description) {
        const existingCode = await Codes.findOne({ code });

        if (existingCode) {
          existingCode.info = description;
          await existingCode.save();
        }
      }
    }

    console.log("Data inserted successfully");
  } finally {
    await mongoose.disconnect();
  }
}

importVoInfo().catch((error: unknown) => {
  console.error("Error inserting data:", error);
  process.exit(1);
});
