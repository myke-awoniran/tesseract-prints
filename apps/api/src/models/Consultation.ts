import { Schema, model } from 'mongoose';

export interface IConsultation {
  name: string;
  institution: string;
  email: string;
  phone: string;
  documentType: string;
  message: string;
  status: 'new' | 'contacted' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const consultationSchema = new Schema<IConsultation>(
  {
    name: { type: String, required: true, trim: true },
    institution: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    documentType: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' }
  },
  { timestamps: true }
);

export const Consultation = model<IConsultation>('Consultation', consultationSchema);
