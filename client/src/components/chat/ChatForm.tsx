import { useState } from "react";
import TextInput from "../../elements/TextInput";
import Button from "../../elements/Button";
import Avatar from "../../elements/Avatar";
import { useChat } from "../../ChatContext";
import { addressToNumber } from "../../utils/utils";
import { useDojo } from "../../DojoContext";

const ChatForm = () => {
  const [message, setMessage] = useState<string>("");

  const { client } = useChat();

  const handleSendMessage = () => {
    client?.message.sendMessage(message);
    setMessage("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && message.trim() !== "") {
      handleSendMessage();
    }
  };

  const {
    account: { account },
  } = useDojo();

  return (
    <div className="flex items-center mt-auto rounded-b-xl bg-gradient-to-b from-black to-[#151515] -m-2 p-2 border-t-[1px] border-gold">
      <Avatar src={`/images/avatars/${addressToNumber(account.address)}.png`} size="md" />
      <TextInput placeholder="Write something..." value={message} onChange={setMessage} onKeyDown={handleKeyDown} />
      <Button className="ml-2 bg-transparent" onClick={() => handleSendMessage()}>
        <svg width="17" height="18" viewBox="0 0 17 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5.25309 13.7938C5.0846 13.6254 5.02245 13.4417 5.06664 13.2428C5.11084 13.0494 5.19923 12.8285 5.33181 12.5799L6.83165 9.77908C6.91451 9.6244 7.00014 9.51391 7.08853 9.44762C7.17691 9.38133 7.29569 9.34542 7.44484 9.3399L15.723 9.05816C15.7699 9.0554 15.8058 9.04159 15.8307 9.01673C15.8583 8.98911 15.8694 8.95596 15.8638 8.91729C15.8638 8.88415 15.85 8.85376 15.8224 8.82614C15.7975 8.80128 15.763 8.78609 15.7188 8.78057L7.4407 8.52369C7.28878 8.5154 7.16863 8.47811 7.08024 8.41182C6.99461 8.34277 6.91175 8.23504 6.83165 8.08865L5.30695 5.22155C5.17989 4.98954 5.09703 4.77685 5.05836 4.5835C5.02245 4.39291 5.08736 4.21476 5.25309 4.04903C5.38843 3.91368 5.55416 3.85015 5.75027 3.85844C5.95191 3.86673 6.16321 3.92059 6.38418 4.02003L15.7561 8.19637C15.8721 8.25162 15.9743 8.30686 16.0627 8.3621C16.1539 8.41458 16.2298 8.47121 16.2906 8.53197C16.4094 8.65075 16.4687 8.77919 16.4687 8.91729C16.4715 9.05816 16.4135 9.18798 16.2947 9.30675C16.234 9.36752 16.1566 9.42553 16.0627 9.48077C15.9716 9.53877 15.868 9.59263 15.752 9.64235L6.42976 13.8021C6.1784 13.9154 5.95329 13.9748 5.75441 13.9803C5.55278 13.9886 5.38567 13.9264 5.25309 13.7938Z"
            fill="#E0AF65"
          />
        </svg>
      </Button>
    </div>
  );
};

export default ChatForm;
