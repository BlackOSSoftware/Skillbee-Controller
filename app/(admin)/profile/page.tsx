import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { ProfileDetails } from '@/features/auth/components/profile-details';

export const metadata: Metadata = { title: 'Profile & Settings' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile & Settings" description="Your signed-in account from /auth/me." />
      <ProfileDetails />
    </>
  );
}
