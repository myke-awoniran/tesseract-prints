import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, type PublicUser, type Role } from '@tesseract/shared';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  organization: Types.ObjectId | null;
  active: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  setPassword(password: string): Promise<void>;
  verifyPassword(password: string): Promise<boolean>;
  toPublic(): PublicUser;
}

type UserModel = Model<IUser, object, IUserMethods>;
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    active: { type: Boolean, default: true },
    lastLoginAt: Date
  },
  { timestamps: true }
);

userSchema.method('setPassword', async function setPassword(this: UserDocument, password: string) {
  this.passwordHash = await bcrypt.hash(password, 12);
});

userSchema.method('verifyPassword', function verifyPassword(this: UserDocument, password: string) {
  return bcrypt.compare(password, this.passwordHash);
});

userSchema.method('toPublic', function toPublic(this: UserDocument): PublicUser {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    organization: this.organization ? this.organization.toString() : null,
    lastLoginAt: this.lastLoginAt?.toISOString()
  };
});

export const User = model<IUser, UserModel>('User', userSchema);
