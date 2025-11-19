import { Clock } from "lucide-react";
import { useState, useEffect } from "react";

export const Footer = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="relative border-t border-border/50 bg-background/95 backdrop-blur-lg py-8">
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center gap-4">
          {/* Live countdown display */}
          <div className="flex items-center gap-3 text-center">
            <Clock className="w-5 h-5 text-accent animate-glow-pulse" />
            <div className="font-mono text-2xl font-bold text-accent animate-countdown-glow">
              {currentTime.toLocaleTimeString()}
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Every second brings you closer to your future revelations
          </p>

          <div className="flex items-center gap-6 text-xs text-muted-foreground pt-4">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="#" className="hover:text-primary transition-colors">
              How FHE Works
            </a>
            <span>•</span>
            <a href="#" className="hover:text-primary transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
