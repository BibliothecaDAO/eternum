const sponsorsData = [
  {
    name: "Realms World",
    link: "https://realms.world",
    image: "/logos/RealmsWorld.png",
  },
  {
    name: "Dojo",
    link: "https://dojoengine.com/",
    image: "/logos/Dojo.png",
  },
  {
    name: "Cartridge",
    link: "https://cartridge.gg/",
    image: "/logos/Cartridge.png",
  },
  {
    name: "Starknet",
    link: "https://www.starknet.io/",
    image: "/logos/Starknet.svg",
  },
];

const Collaborators = () => {
  return (
    <div className="flex justify-center gap-8">
      {sponsorsData.map((sponsor) => (
        <a
          key={sponsor.name}
          href={sponsor.link}
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:opacity-75"
        >
          <img src={sponsor.image} alt={sponsor.name} className="w-50 h-50 object-contain" />
        </a>
      ))}
    </div>
  );
};

export default Collaborators;
