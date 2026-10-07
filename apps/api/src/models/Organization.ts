import { Schema, model, type HydratedDocument } from 'mongoose';
import { FINISHING_IDS, type DefaultDelivery, type OrganizationPreferences, type OrganizationView } from '@tesseract/shared';
import { transformOutput, uuidId } from './schema.js';

export interface IOrganization {
  _id: string;
  name: string;
  billingEmail?: string;
  defaultDelivery: DefaultDelivery;
  preferences: OrganizationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    _id: uuidId,
    name: { type: String, required: true, trim: true },
    billingEmail: { type: String, trim: true, lowercase: true },
    defaultDelivery: {
      recipientName: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      area: { type: String, trim: true, default: '' }
    },
    preferences: {
      notifyOnDispatch: { type: Boolean, default: true },
      notifyOnDelivery: { type: Boolean, default: true },
      defaultFinishing: { type: String, enum: FINISHING_IDS, default: 'none' },
      defaultColour: { type: String, enum: ['mono', 'colour'], default: 'mono' }
    }
  },
  { timestamps: true, toJSON: { transform: transformOutput() } }
);

export type OrganizationDocument = HydratedDocument<IOrganization>;
export const Organization = model<IOrganization>('Organization', organizationSchema);

export function toOrganizationView(org: OrganizationDocument): OrganizationView {
  return {
    id: org._id,
    name: org.name,
    billingEmail: org.billingEmail ?? '',
    defaultDelivery: {
      recipientName: org.defaultDelivery?.recipientName ?? '',
      phone: org.defaultDelivery?.phone ?? '',
      address: org.defaultDelivery?.address ?? '',
      area: org.defaultDelivery?.area ?? ''
    },
    preferences: {
      notifyOnDispatch: org.preferences?.notifyOnDispatch ?? true,
      notifyOnDelivery: org.preferences?.notifyOnDelivery ?? true,
      defaultFinishing: org.preferences?.defaultFinishing ?? 'none',
      defaultColour: org.preferences?.defaultColour ?? 'mono'
    }
  };
}
