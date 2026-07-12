import { Schema, model, type Types } from 'mongoose';

export type SquadFormation = '4-3-3'|'4-4-2'|'4-2-3-1'|'3-5-2'|'3-4-3'|'5-3-2'|'4-1-4-1'|'custom';

export interface ISquadPosition {
  role: string;
  x: number;
  y: number;
}

export interface ISavedFormation {
  _id: Types.ObjectId;
  name: string;
  positions: ISquadPosition[];
  starterIds: Array<Types.ObjectId|null>;
}

export interface ISquad {
  userId: Types.ObjectId;
  formation: SquadFormation;
  starterIds: Array<Types.ObjectId|null>;
  substituteIds: Types.ObjectId[];
  customPositions: ISquadPosition[];
  savedFormations: ISavedFormation[];
  createdAt: Date;
  updatedAt: Date;
}

const positionSchema = new Schema<ISquadPosition>({
  role: { type: String, required: true, trim: true, minlength: 1, maxlength: 8 },
  x: { type: Number, required: true, min: 5, max: 95 },
  y: { type: Number, required: true, min: 5, max: 95 }
}, { _id: false });

const savedFormationSchema = new Schema<ISavedFormation>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 30 },
  positions: {
    type: [positionSchema],
    required: true,
    validate: { validator: (value: unknown[]) => value.length === 11, message: 'آرایش ذخیره‌شده باید ۱۱ جایگاه داشته باشد' }
  },
  starterIds: {
    type: [{ type: Schema.Types.ObjectId, ref: 'ClubPlayer', default: null }],
    required: true,
    validate: { validator: (value: unknown[]) => value.length === 11, message: 'ترکیب ذخیره‌شده باید ۱۱ جایگاه داشته باشد' }
  }
});

const schema = new Schema<ISquad>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  formation: { type: String, enum: ['4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2','4-1-4-1','custom'], default: '4-3-3' },
  starterIds: {
    type: [{ type: Schema.Types.ObjectId, ref: 'ClubPlayer', default: null }],
    default: () => Array.from({ length: 11 }, () => null),
    validate: { validator: (value: unknown[]) => value.length === 11, message: 'ترکیب اصلی باید دقیقاً ۱۱ جایگاه داشته باشد' }
  },
  substituteIds: [{ type: Schema.Types.ObjectId, ref: 'ClubPlayer' }],
  customPositions: {
    type: [positionSchema],
    default: [],
    validate: { validator: (value: unknown[]) => value.length === 0 || value.length === 11, message: 'آرایش دلخواه باید ۱۱ جایگاه داشته باشد' }
  },
  savedFormations: { type: [savedFormationSchema], default: [] }
}, { timestamps: true });

export const Squad = model<ISquad>('Squad', schema);
