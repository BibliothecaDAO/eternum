import { BaseContainer } from "../containers/BaseContainer"
import Avatar from "../elements/Avatar"

const ContextComponent = () => {
    return (
        <BaseContainer className="relative w-12 p-1 rounded-b-3xl rounded-t-xl">
            <div className="mt-16"></div>
            <Avatar src="/images/avatars/1.png" className="absolute mt-10 -translate-x-1/2 w-9 h-9 bottom-1 left-1/2" />
        </BaseContainer>
    )
}

export default ContextComponent