import { colors } from "./styles";

const sponsorsData = [
  {
    name: "Realms World",
    link: "https://realms.world",
    image: "/images/logos/RealmsWorld.png",
    description:
      "Realms.World is the gateway to the Realms Autonomous World, seamlessly integrating gaming ecosystems, marketplace features, and developer tools into one comprehensive platform.",
  },
  {
    name: "Dojo",
    link: "https://dojoengine.com/",
    image: "/images/logos/Dojo.svg",
    description:
      "Dojo is a cutting-edge open-source toolchain for creating provable onchain games and autonomous worlds. It empowers developers to design games with fully onchain state and logic, ensuring unparalleled transparency and trust.",
  },
  {
    name: "Cartridge",
    link: "https://cartridge.gg/",
    image: "/images/logos/Cartridge.png",
    description:
      "Cartridge is a platform redefining Web3 gaming, offering players a secure and immersive space to discover, play, and engage with blockchain-based games in a decentralized ecosystem.",
  },
  {
    name: "Starknet",
    link: "https://www.starknet.io/",
    image: "/images/logos/Starknet.png",
    description:
      "Starknet is a decentralized Layer 2 network built on Ethereum, harnessing ZK-Rollup technology to deliver high scalability and low-cost transactions, all while maintaining Ethereum's robust security and trustless guarantees.",
  },
];

const styles = {
  container: {
    display: "grid",
    gap: "1.5rem",
  },
  sponsorLink: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0.5rem",
    transition: "background-color 0.2s",
    borderRadius: "0.5rem",
    border: `1px solid ${colors.border}`,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    textDecoration: "none",
  },
  sponsorLinkHover: {
    backgroundColor: colors.background.dark,
  },
  imageContainer: {
    flexShrink: 0,
    width: "6rem",
    height: "6rem",
    borderRadius: "0.375rem",
  },
  image: {
    objectFit: "contain" as const,
    width: "100%",
    height: "100%",
    padding: "0.5rem",
  },
  contentContainer: {
    display: "flex",
    flexDirection: "column" as const,
  },
  title: {
    fontSize: "1.125rem",
    fontWeight: "bold",
    color: colors.text.light,
  },
  description: {
    fontSize: "0.875rem",
    color: colors.text.muted,
  },
};

const Collaborators = () => {
  return (
    <div style={styles.container}>
      {sponsorsData.map((sponsor) => (
        <a
          key={sponsor.name}
          href={sponsor.link}
          style={styles.sponsorLink}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = styles.sponsorLinkHover.backgroundColor;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
          }}
        >
          <div style={styles.imageContainer}>
            <img src={sponsor.image} alt={sponsor.name} style={styles.image} />
          </div>
          <div style={styles.contentContainer}>
            <h4 style={styles.title}>{sponsor.name}</h4>
            <p style={styles.description}>{sponsor.description}</p>
          </div>
        </a>
      ))}
    </div>
  );
};

export default Collaborators;
