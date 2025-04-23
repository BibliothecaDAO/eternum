import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const ctas = [
    {
      text: "Play Now",
      imageUrl: "/images/covers/01.png",
      linkUrl: "https://next-eternum.realms.world",
      heightClass: "h-72", // Keep the specific height for the first item
    },
    {
      text: "Claim Season Pass",
      imageUrl: "/images/covers/02.png",
      linkUrl: "/mint",
      heightClass: "h-72",
    },
    {
      text: "Transfer Pass",
      imageUrl: "/images/covers/03.png",
      linkUrl: "/transfer",
      heightClass: "h-72",
    },
    {
      text: "Buy Pass",
      imageUrl: "/images/covers/04.png",
      linkUrl:
        "https://market.realms.world/collection/0x057675b9c0bd62b096a2e15502a37b290fa766ead21c33eda42993e48a714b80",
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
      {/* <h1 className="text-5xl font-extrabold mb-12">Welcome to the Game!</h1> */}

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {ctas.map((cta) => {
          const MotionLink = motion(Link); // Create a motion component for Link
          const commonAnimProps = {
            variants: itemVariants,
            whileHover: { scale: 1.03 }, // Scale up slightly on hover
          };
          const commonProps = {
            className: `relative ${cta.heightClass} bg-cover bg-center rounded-lg shadow-lg overflow-hidden cursor-pointer opacity-75 hover:opacity-100 transition-opacity duration-300 block border border-gold/40`,
            style: { backgroundImage: `url('${cta.imageUrl}')` },
          };
          const content = (
            <div className="absolute inset-0 bg-black bg-opacity-10 flex items-center justify-center">
              <span className="text-white text-2xl border px-4 py-2 border-gold rounded-md uppercase font-serif">
                {cta.text}
              </span>
            </div>
          );

          return cta.linkUrl.startsWith("http") ? (
            <motion.div
              key={cta.text}
              {...commonProps}
              {...commonAnimProps} // Apply animation props
              onClick={() => (window.location.href = cta.linkUrl)}
            >
              {content}
            </motion.div>
          ) : (
            <MotionLink
              key={cta.text}
              to={cta.linkUrl}
              {...commonProps}
              {...commonAnimProps} // Apply animation props
            >
              {content}
            </MotionLink>
          );
        })}
      </motion.div>
    </div>
  );
}
