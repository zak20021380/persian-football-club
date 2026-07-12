import { Schema, model, type Types } from 'mongoose';

export type PlayerPosition = 'GK'|'RB'|'CB'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST';

export interface IClubPlayer {
  ownerId: Types.ObjectId;
  name: string;
  position: PlayerPosition;
  overall: number;
  photoUrl?: string;
  nationality?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IClubPlayer>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  position: { type: String, enum: ['GK','RB','CB','LB','DM','CM','AM','RW','LW','ST'], required: true },
  overall: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
  photoUrl: { type: String, trim: true, maxlength: 500 },
  nationality: { type: String, trim: true, maxlength: 60 }
}, { timestamps: true });

schema.index({ ownerId: 1, createdAt: 1 });
export const ClubPlayer = model<IClubPlayer>('ClubPlayer', schema);
