import { Schema, model } from 'mongoose';
export interface IAppSetting { key: string; value: unknown; description?: string; updatedAt: Date; createdAt: Date; }
const schema = new Schema<IAppSetting>({ key: { type: String, required: true, unique: true, index: true }, value: { type: Schema.Types.Mixed, required: true }, description: String }, { timestamps: true });
export const AppSetting = model<IAppSetting>('AppSetting', schema);
