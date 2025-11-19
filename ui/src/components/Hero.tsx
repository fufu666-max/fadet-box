import { ClockGears } from "./ClockGears";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
      
      {/* Floating gears background */}
      <div className="absolute inset-0 opacity-10">
        <ClockGears />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 animate-fade-in-up">
        <h1 className="text-6xl md:text-8xl font-bold mb-6 leading-tight">
          <span className="block text-foreground">Lock the Present.</span>
          <span className="block bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-glow-pulse">
            Reveal the Future.
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12">
          Encrypt your messages with FHE technology. Set a time lock. 
          Let the future unlock your secrets.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a 
            href="#create" 
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all hover:scale-105"
          >
            Create Time Capsule
          </a>
          <a 
            href="#vault" 
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl bg-secondary text-secondary-foreground border border-primary/30 hover:bg-secondary/80 transition-all hover:scale-105"
          >
            View Vault
          </a>
        </div>
      </div>
    </section>
  );
};
