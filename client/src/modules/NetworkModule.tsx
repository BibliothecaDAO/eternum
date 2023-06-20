import { SettingsComponent } from "../components/SettingsComponent"
import EpochCountdown from "../components/network/EpochCountdown"
import NodeStatus from "../components/network/NodeStatus"

const NetworkModule = () => {
    return (
        <div className="flex mb-3">
            <SettingsComponent />
        </div>
    )
}

export default NetworkModule