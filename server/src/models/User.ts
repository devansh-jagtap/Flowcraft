import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export interface IUser {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, UserMethods>;

const userSchema = new Schema<IUser, Model<IUser, object, UserMethods>, UserMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
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

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});

userSchema.method('comparePassword', function comparePassword(this: IUser, candidate: string) {
  return bcrypt.compare(candidate, this.password);
});

export const User = model<IUser, Model<IUser, object, UserMethods>>('User', userSchema);
