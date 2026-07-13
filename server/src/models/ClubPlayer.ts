import { Schema, model, type Types } from 'mongoose';

export type PlayerPosition = 'GK'|'RB'|'CB'|'LB'|'DM'|'CM'|'AM'|'RW'|'LW'|'ST';

export interface IPlayerTransferOffer {
  _id: Types.ObjectId;
  amount: number;
  createdAt: Date;
  expiresAt?: Date;
  status: 'active'|'accepted'|'rejected'|'expired';
}

export interface IPlayerTransferListing {
  isListed: boolean;
  askingPrice?: number;
  status?: 'active'|'paused'|'sold'|'expired';
  expiresAt?: Date;
}

export interface IClubPlayer {
  ownerId: Types.ObjectId;
  name: string;
  position: PlayerPosition;
  overall: number;
  photoUrl?: string;
  nationality?: string;
  club?: string;
  marketValue?: number;
  contractStatus?: string;
  transferListing?: IPlayerTransferListing;
  transferOffers: IPlayerTransferOffer[];
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<IPlayerTransferOffer>({
  amount: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date },
  status: { type: String, enum: ['active','accepted','rejected','expired'], default: 'active', required: true }
});

const listingSchema = new Schema<IPlayerTransferListing>({
  isListed: { type: Boolean, required: true, default: false },
  askingPrice: { type: Number, min: 0 },
  status: { type: String, enum: ['active','paused','sold','expired'] },
  expiresAt: { type: Date }
}, { _id: false });

const schema = new Schema<IClubPlayer>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  position: { type: String, enum: ['GK','RB','CB','LB','DM','CM','AM','RW','LW','ST'], required: true },
  overall: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
  photoUrl: { type: String, trim: true, maxlength: 500 },
  nationality: { type: String, trim: true, maxlength: 60 },
  club: { type: String, trim: true, maxlength: 80 },
  marketValue: { type: Number, min: 0 },
  contractStatus: { type: String, trim: true, maxlength: 80 },
  transferListing: { type: listingSchema },
  transferOffers: { type: [offerSchema], default: [] }
}, { timestamps: true });

schema.index({ ownerId: 1, createdAt: 1 });
export const ClubPlayer = model<IClubPlayer>('ClubPlayer', schema);
