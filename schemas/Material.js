import mongoose from "mongoose";

const materialSchema = new mongoose.Schema({
  material: {
    type: String,
    required: true,
    unique : true,
    dropDups: true,
  },
  price: {
    type: String, 
    default: '0'
  },
  createdAt: { type: Date, default: () => Date.now() },
  updatedAt: { type: Date, default: () => Date.now() },
});

const MaterialModel = mongoose.model("Material", materialSchema);

export default MaterialModel;
