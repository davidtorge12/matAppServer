import mongoose, { type InferSchemaType } from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    material: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    /**
     * A number, not a string. Prices were stored as strings, which meant a bad
     * row (`""`, `"n/a"`) became `NaN` on the client and silently poisoned a
     * quote total.
     *
     * Every read path uses `.lean()`, which skips Mongoose casting, and coerces
     * through `parsePrice` instead — so a row still holding a legacy string is
     * read correctly whether or not `npm run migrate:prices` has been run yet.
     * The order of the migration and the deploy does not matter.
     */
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

export type MaterialDoc = InferSchemaType<typeof materialSchema>;

const MaterialModel = mongoose.model("Material", materialSchema);

export default MaterialModel;
