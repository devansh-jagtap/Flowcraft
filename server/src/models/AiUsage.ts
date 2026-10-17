import { Schema, model } from 'mongoose';

/** How many free AI generations a visitor (signed-in user or guest IP) has used in the current window. */
export interface IAiUsage {
  /** "user:<id>" for signed-in users, "ip:<address>" for guests. */
  key: string;
  count: number;
  resetsAt: Date;
}

const aiUsageSchema = new Schema<IAiUsage>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0, min: 0 },
  // MongoDB deletes the record shortly after the window ends; the quota code also treats it as reset.
  resetsAt: { type: Date, required: true, expires: 0 },
});

export const AiUsage = model<IAiUsage>('AiUsage', aiUsageSchema);
