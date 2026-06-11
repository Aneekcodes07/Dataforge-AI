import HeroSection from './components/HeroSection';
import HowItWorks from './components/HowItWorks';
import FeaturesGrid from './components/FeaturesGrid';
import AgentPreview from './components/AgentPreview';
import FooterSection from './components/FooterSection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <AgentPreview />
      <HowItWorks />
      <FeaturesGrid />
      <FooterSection />
    </div>
  );
}
