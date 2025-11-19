import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { CreateCapsule } from "@/components/CreateCapsule";
import { CapsuleVault } from "@/components/CapsuleVault";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <CreateCapsule />
      <CapsuleVault />
      <Footer />
    </div>
  );
};

export default Index;
