import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/types/api';
import type { PublicSiteSettings, SiteSettingsAdmin, UpdateSiteSettingsInput } from '@/types/site-settings';

export const siteSettingsService = {
  /** GET /admin/site-settings — full admin object. */
  async getAdmin(): Promise<SiteSettingsAdmin> {
    const res = await apiClient.get<ApiEnvelope<SiteSettingsAdmin>>('/admin/site-settings');
    return res.data.data;
  },
  /** PATCH /admin/site-settings — partial contact/socialLinks update. */
  async updateAdmin(input: UpdateSiteSettingsInput): Promise<SiteSettingsAdmin> {
    const res = await apiClient.patch<ApiEnvelope<SiteSettingsAdmin>>('/admin/site-settings', input);
    return res.data.data;
  },
  /** GET /site-settings — public read-only projection used to verify published values. */
  async getPublic(): Promise<PublicSiteSettings> {
    const res = await apiClient.get<ApiEnvelope<PublicSiteSettings>>('/site-settings');
    return res.data.data;
  },
};
