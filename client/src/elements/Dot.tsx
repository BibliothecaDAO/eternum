type DotProps = {
    colorClass: string;
}

export const Dot = ({ colorClass }: DotProps) => (
    <div className={`w-1 h-1 rounded-full ${colorClass}`} />
);