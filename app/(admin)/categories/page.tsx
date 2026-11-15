import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { CategoryManagement } from '@/features/categories/components/category-management';

export const metadata: Metadata = { title: 'Categories' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function CategoriesPage() {
  return (
    <ModuleGate slug="categories">
      <CategoryManagement />
    </ModuleGate>
  );
}
