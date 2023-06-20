import CircleButton from "../../elements/CircleButton"

const WorldMapLayersComponent = () => {
    const layers = ["R", "A", "T"]
    return (
        <div className="flex space-x-3">
            {layers.map((layer, index) => (<CircleButton size="md" key={index}>{layer}</CircleButton>))}
        </div>
    )
}

export default WorldMapLayersComponent