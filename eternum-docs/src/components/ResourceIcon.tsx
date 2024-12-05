import { resources } from "../utils/constants";

type Props = {
  name: string;
  id: number | undefined;
  size?: number;
};

export default function ResourceIcon({ name, id, size = 50 }: Props) {
  const imgPath = resources.find((r) => r.id === id)?.img;
  return (
    <div className="flex self-center justify-center">
      <img src={`/resources` + imgPath} alt={name} title={name} width={size} height={size} />
    </div>
  );
}
