import ProgressBar from "../../elements/ProgressBar"

const EpochCountdown = () => {
    const segments = 12
    return (
        <div className="absolute left-0 right-0 flex items-center h-2 px-1 mx-4 space-x-1 bg-black rounded-full bottom-5">
            {[...Array(segments)].map((_, i) => (
                <ProgressBar progress={i < 9 ? 100 : i > 9 ? 0 : 46} key={i} className="flex-1" />
            ))}
        </div>
    )
}

export default EpochCountdown