import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const chain = import.meta.env.VITE_PUBLIC_CHAIN;

  const ctas = [
    {
      text: chain === "sepolia" ? "Play Now [Sepolia]" : "Play Now [Mainnet]",
      imageUrl: "/images/covers/01.png",
      linkUrl: chain === "sepolia" ? "https://next-eternum.realms.world" : "https://eternum.realms.world",
      heightClass: "h-72", // Keep the specific height for the first item
    },
    {
      text: "View Realms & Claim Season Passes",
      imageUrl: "/images/covers/02.png",
      linkUrl: "/mint",
      heightClass: "h-72",
    },
    {
      text: "Manage your Season Passes",
      imageUrl: "/images/covers/03.png",
      linkUrl: "/season-passes",
      heightClass: "h-72",
    },
    {
      text: "Buy a Season Pass",
      imageUrl: "/images/covers/04.png",
      linkUrl: "https://element.market/collections/eternum-season-1?search[toggles][0]=ALL",
      heightClass: "h-72",
    },
  ];

  // Framer Motion variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1, // Stagger animation of children
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="p-4 flex flex-col items-center">
      {/* Title might also be animated if desired */}
      <h1 className="text-5xl mb-6 text-center">Welcome to Eternum Empire!</h1>
      <p className="text-xl text-center mb-12 max-w-2xl">Explore, conquer, and build your legacy.</p>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {ctas.map((cta) => {
          const MotionLink = motion(Link); // Create a motion component for Link

          // Conditionally apply entrance animation
          const shouldAnimateEntrance = !["/mint", "/season-passes"].includes(cta.linkUrl);
          const commonAnimProps = {
            ...(shouldAnimateEntrance && { variants: itemVariants }), // Apply entrance animation variant conditionally
            whileHover: { scale: 1.03 }, // Keep scale up slightly on hover
          };

          const commonProps = {
            className: `relative ${cta.heightClass} bg-cover bg-center rounded-lg shadow-lg overflow-hidden cursor-pointer opacity-75 hover:opacity-100 transition-opacity duration-300 block border border-gold/40`,
            style: { backgroundImage: `url('${cta.imageUrl}')` },
          };
          const content = (
            <div className="absolute inset-0 bg-black bg-opacity-10 flex items-center justify-center">
              <span className="text-white text-2xl border px-4 py-2 border-gold rounded-md uppercase font-serif text-center">
                {cta.text}
              </span>
            </div>
          );

          return cta.linkUrl.startsWith("http") ? (
            <motion.div
              key={cta.text}
              {...commonProps}
              {...commonAnimProps}
              onClick={() => (window.location.href = cta.linkUrl)}
            >
              {content}
            </motion.div>
          ) : (
            <MotionLink key={cta.text} to={cta.linkUrl} preload="intent" {...commonProps} {...commonAnimProps}>
              {content}
            </MotionLink>
          );
        })}
      </motion.div>
    </div>
  );
}
