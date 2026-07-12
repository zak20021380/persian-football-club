import { Schema, model } from 'mongoose';
export interface ISponsorEvent { sponsorId: Schema.Types.ObjectId; userId: Schema.Types.ObjectId; kind: 'impression'|'click'; entityKey: string; occurredAt: Date; }
const schema = new Schema<ISponsorEvent>({ sponsorId: { type: Schema.Types.ObjectId, ref: 'Sponsor', required: true, index: true }, userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, kind: { type: String, enum: ['impression','click'], required: true }, entityKey: { type: String, required: true }, occurredAt: { type: Date, default: Date.now } });
schema.index({ sponsorId: 1, userId: 1, kind: 1, entityKey: 1 }, { unique: true });
export const SponsorEvent = model<ISponsorEvent>('SponsorEvent', schema);
