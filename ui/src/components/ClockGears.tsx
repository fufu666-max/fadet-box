export const ClockGears = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Large gear */}
      <svg
        className="absolute w-64 h-64 text-primary/20 animate-gear-spin"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <path d="M50,10 L55,20 L65,15 L60,25 L70,25 L65,35 L75,40 L65,45 L70,55 L60,50 L65,65 L55,60 L50,70 L45,60 L35,65 L40,55 L30,50 L35,40 L25,35 L35,30 L30,20 L40,25 L35,15 L45,20 Z">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 50 50"
            to="360 50 50"
            dur="20s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="50" cy="50" r="15" fill="currentColor" />
      </svg>

      {/* Medium gear */}
      <svg
        className="absolute w-40 h-40 text-accent/20 animate-gear-spin-reverse"
        style={{ left: "60%", top: "20%" }}
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <path d="M50,15 L53,22 L60,20 L57,27 L64,29 L59,35 L66,39 L59,43 L64,50 L57,52 L60,59 L53,57 L50,64 L47,57 L40,59 L43,52 L36,50 L41,43 L34,39 L41,35 L36,29 L43,27 L40,20 L47,22 Z">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="360 50 50"
            to="0 50 50"
            dur="15s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="50" cy="50" r="12" fill="currentColor" />
      </svg>

      {/* Small gear */}
      <svg
        className="absolute w-24 h-24 text-primary/20 animate-gear-spin"
        style={{ left: "20%", top: "60%" }}
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <path d="M50,20 L52,25 L57,24 L55,29 L60,31 L56,35 L61,38 L56,41 L60,46 L55,47 L57,52 L52,51 L50,56 L48,51 L43,52 L45,47 L40,46 L44,41 L39,38 L44,35 L40,31 L45,29 L43,24 L48,25 Z">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 50 50"
            to="360 50 50"
            dur="10s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="50" cy="50" r="10" fill="currentColor" />
      </svg>
    </div>
  );
};
