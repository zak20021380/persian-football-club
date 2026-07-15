import { Schema, model, type Types } from 'mongoose';

export type PlayerPosition = 'GK'|'RB'|'CB'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST';

export interface IPlayerTransferListing {
  isListed: boolean;
  askingPrice?: number;
  status?: 'active'|'negotiable'|'paused'|'sold'|'expired';
  expiresAt?: Date;
  sellerId?: Types.ObjectId;
}

export interface IClubPlayer {
  ownerId: Types.ObjectId;
  fantasyPlayerId?: Types.ObjectId;
  name: string;
  position: PlayerPosition;
  overall: number;
  photoUrl?: string;
  nationality?: string;
  club?: string;
  marketValue?: number;
  shirtNumber?: number;
  contractStatus?: string;
  contractEndsAt?: Date;
  transferListing?: IPlayerTransferListing;
  createdAt: Date;
  updatedAt: Date;
}

const listingSchema = new Schema<IPlayerTransferListing>({
  isListed: { type: Boolean, required: true, default: false },
  askingPrice: { type: Number, min: 0 },
  status: { type: String, enum: ['active','negotiable','paused','sold','expired'] },
  expiresAt: { type: Date },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const schema = new Schema<IClubPlayer>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fantasyPlayerId: { type: Schema.Types.ObjectId, ref: 'FantasyPlayer', index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  position: { type: String, enum: ['GK','RB','CB','LB','DM','CM','AM','RW','LW','ST'], required: true },
  overall: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
  photoUrl: { type: String, trim: true, maxlength: 500 },
  nationality: { type: String, trim: true, maxlength: 60 },
  club: { type: String, trim: true, maxlength: 80 },
  marketValue: { type: Number, min: 0 },
  shirtNumber: { type: Number, min: 1, max: 99, validate: Number.isInteger },
  contractStatus: { type: String, trim: true, maxlength: 80 },
  contractEndsAt: { type: Date },
  transferListing: { type: listingSchema }
}, { timestamps: true });

schema.index({ ownerId: 1, createdAt: 1 });
export const ClubPlayer = model<IClubPlayer>('ClubPlayer', schema);
