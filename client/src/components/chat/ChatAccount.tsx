import { useChat } from "../../ChatContext";
import Button from "../../elements/Button";

export const ChatAccount = () => {
    const {

        client,

    } = useChat();

    return (
        <div className="pt-10">
            <Button variant="outline"
                onClick={async () => {
                    const data = await client?.user.updateMyProfile(
                        'loaf',
                        'avatar_url'
                    );
                    console.log(data);
                }}>
                Update My Profile
            </Button>
        </div>
    )
}