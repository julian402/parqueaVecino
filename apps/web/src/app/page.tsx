import { Benefits } from '@/features/home/components/benefits';
import { Hero } from '@/features/home/components/hero';
import { HowItWorks } from '@/features/home/components/how-it-works';
import { PartnersCta } from '@/features/home/components/partners-cta';
import { ShiftsSection } from '@/features/home/components/shifts-section';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ShiftsSection />
      <HowItWorks />
      <Benefits />
      <PartnersCta />
    </>
  );
}
