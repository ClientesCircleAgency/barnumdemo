import { RevenueChart } from '@/components/admin/RevenueChart';
import { PageHeader } from '@/components/admin/PageHeader';

export default function BillingPage() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader 
        title="Faturação" 
        subtitle="Acompanhe a faturação estimada da clínica" 
      />

      <RevenueChart />
    </div>
  );
}