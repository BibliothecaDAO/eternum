const sponsorsData = [
  {
    name: "Realms World",
    link: "https://realms.world",
    image: "/logos/RealmsWorld.png",
    description:
      "Realms.World is the gateway to the Realms Autonomous World, seamlessly integrating gaming ecosystems, marketplace features, and developer tools into one comprehensive platform.",
  },
  {
    name: "Dojo",
    link: "https://dojoengine.com/",
    image: "/logos/Dojo.svg",
    description:
      "Dojo is a cutting-edge open-source toolchain for creating provable onchain games and autonomous worlds. It empowers developers to design games with fully onchain state and logic, ensuring unparalleled transparency and trust.",
  },
  {
    name: "Cartridge",
    link: "https://cartridge.gg/",
    image: "/logos/Cartridge.png",
    description:
      "Cartridge is a platform redefining Web3 gaming, offering players a secure and immersive space to discover, play, and engage with blockchain-based games in a decentralized ecosystem.",
  },
  {
    name: "Starknet",
    link: "https://www.starknet.io/",
    image: "/logos/Starknet.png",
    description:
      "Starknet is a decentralized Layer 2 network built on Ethereum, harnessing ZK-Rollup technology to deliver high scalability and low-cost transactions, all while maintaining Ethereum’s robust security and trustless guarantees.",
  },
];

const Collaborators = () => {
  return (
    <div className="grid gap-6">
      {sponsorsData.map((sponsor) => (
        <a
          key={sponsor.name}
          href={sponsor.link}
          className="flex items-center gap-4 p-2 transition hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5"
        >
          <div className="flex-shrink-0 w-24 h-24 rounded-md ">
            <img src={sponsor.image} alt={sponsor.name} className="object-contain w-full h-full p-2" />
          </div>
          <div>
            <h4 className="text-lg font-bold">{sponsor.name}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">{sponsor.description}</p>
          </div>
        </a>
      ))}
    </div>
  );
};

export default Collaborators;
