import { Schema, model, type Types } from 'mongoose';

export type SquadFormation = '4-3-3'|'4-4-2'|'4-2-3-1';

export interface ISquad {
  userId: Types.ObjectId;
  formation: SquadFormation;
  starterIds: Array<Types.ObjectId|null>;
  substituteIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISquad>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  formation: { type: String, enum: ['4-3-3','4-4-2','4-2-3-1'], default: '4-3-3' },
  starterIds: {
    type: [{ type: Schema.Types.ObjectId, ref: 'ClubPlayer', default: null }],
    default: () => Array.from({ length: 11 }, () => null),
    validate: { validator: (value: unknown[]) => value.length === 11, message: 'ترکیب اصلی باید دقیقاً ۱۱ جایگاه داشته باشد' }
  },
  substituteIds: [{ type: Schema.Types.ObjectId, ref: 'ClubPlayer' }]
}, { timestamps: true });

export const Squad = model<ISquad>('Squad', schema);
