import mongoose from "mongoose";

const codesSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
  },
  description: { type: String, required: true },
  unit: String,
  price: String,
  createdAt: { type: Date, default: () => Date.now() },
  updatedAt: { type: Date, default: () => Date.now() },
  materials: String,
});

const CodesModel = mongoose.model("Codes", codesSchema);

export default CodesModel;
