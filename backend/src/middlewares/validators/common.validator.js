import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectId = (message = "Invalid id") =>
  z.string().regex(objectIdRegex, message);

export { objectIdRegex };
