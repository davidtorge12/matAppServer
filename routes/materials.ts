import express from "express";
import { listMaterialNames } from "../lib/materialNames.js";
import { parsePrice } from "../lib/price.js";
import { badRequest, route } from "../lib/route.js";
import Material from "../schemas/Material.js";

const router = express.Router();

/** Ceiling so a bloated catalogue cannot dump the whole collection into the typeahead. */
const MAX_CATALOGUE_NAMES = 2000;

type GetPricesBody = { obj?: Record<string, unknown> };
type SetPriceBody = { material?: unknown; price?: unknown };

router.get(
  "/materials",
  route(async (_req, res) => {
    const found = await Material.find({}, { material: 1, _id: 0 })
      .sort({ material: 1 })
      .limit(MAX_CATALOGUE_NAMES)
      .lean();

    res.json({ items: listMaterialNames(found) });
  }),
);

/**
 * Prices for a whole materials list. One `$in` query, where the previous version
 * ran a separate `find` for every name — a 40-material job meant 40 round trips
 * before the list could render a single price.
 *
 * Answers with numbers. `.lean()` skips Mongoose casting, so a row still holding a
 * legacy string is read as raw and normalised by `parsePrice` — the endpoint
 * behaves the same before and after the price migration.
 */
router.post(
  "/get-prices",
  route(async (req, res) => {
    const requested = (req.body as GetPricesBody | undefined)?.obj;
    if (!requested || typeof requested !== "object") {
      throw badRequest("expected { obj: { [material]: units } }");
    }

    const names = Object.keys(requested).filter((name) => name.trim());
    if (!names.length) {
      return res.json({});
    }

    const found = await Material.find(
      { material: { $in: names } },
      { material: 1, price: 1 },
    ).lean();

    const prices: Record<string, number> = {};
    for (const row of found) {
      prices[row.material] = parsePrice(row.price);
    }

    res.json(prices);
  }),
);

router.post(
  "/set-price",
  route(async (req, res) => {
    const { material, price } = (req.body ?? {}) as SetPriceBody;
    const name = typeof material === "string" ? material.trim() : "";
    if (!name) {
      throw badRequest("material required");
    }

    const updated = await Material.findOneAndUpdate(
      { material: name },
      { price: parsePrice(price) },
      { upsert: true, new: true, lean: true },
    );

    if (!updated) {
      throw new Error("upsert returned no document");
    }

    res.json({ material: updated.material, price: parsePrice(updated.price) });
  }),
);

export default router;
