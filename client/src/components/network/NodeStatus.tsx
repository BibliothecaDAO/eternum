import { BaseContainer } from "../../containers/BaseContainer"

const NodeStatus = () => {
    return (
        <BaseContainer className="w-3/5 mt-1 ml-auto border-r-0 rounded-r-none">
            <div className="flex justify-between text-xs text-white/70">
                <div className="uppercase">
                    dojo-node-wed.xyz
                </div>
                <div className="flex items-center justify-center uppercase">
                    1000
                    <span className="block w-1 h-1 ml-2 bg-green-600 rounded-full ring-2 ring-green-400"></span>
                </div>
            </div>
        </BaseContainer>
    )
}

export default NodeStatus