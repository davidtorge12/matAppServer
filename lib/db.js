import mongoose from "mongoose";

export async function connectDb(mongoUrl) {
  if (!mongoUrl) {
    throw new Error("MONGO_DB_URL is not set");
  }

  await mongoose.connect(mongoUrl);
  console.log("MongoDB connected");
}
