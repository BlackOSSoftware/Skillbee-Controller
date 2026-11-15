/** `SiteSettings.toAdminObject()` — GET/PATCH /admin/site-settings. */
export interface SiteContact {
  companyName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  whatsappNumber: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  gstin: string;
  businessHours: string;
}

export interface SocialLinks {
  facebook: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  twitter: string;
  telegram: string;
  whatsapp: string;
}

export interface SiteSettingsAdmin {
  id: string;
  contact: Partial<SiteContact>;
  socialLinks: Partial<SocialLinks>;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `SiteSettings.toPublicObject()` — GET /site-settings (read-only verification). */
export interface PublicSiteSettings {
  contact: SiteContact;
  socialLinks: SocialLinks;
}

export interface UpdateSiteSettingsInput {
  contact?: Partial<SiteContact>;
  socialLinks?: Partial<SocialLinks>;
}
