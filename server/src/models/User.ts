import { Schema, model, type HydratedDocument } from 'mongoose';

/** Local record of a Clerk account. Clerk owns sign-in; we keep what diagrams need to reference. */
export interface IUser {
  clerkId?: string;
  name: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    // Missing only on seeded/legacy users that haven't been claimed by a Clerk sign-in yet.
    clerkId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => ({
        id: ret._id,
        name: ret.name,
        email: ret.email,
        createdAt: ret.createdAt,
      }),
    },
  }
);

export const User = model<IUser>('User', userSchema);
