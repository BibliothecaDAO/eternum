import { useEffect, useState } from "react";
import { Notification } from "../elements/Notification";
import clsx from "clsx";
import Button from "../elements/Button";
import { EventType, NotificationType } from "../hooks/notifications/useNotifications";
import { useChat } from "../ChatContext";
import { getUserInfoRequest } from "@web3mq/client";
import { getShortAddress } from "./chat/GuildTabs";

type NotificationsComponentProps = {
  className?: string;
} & React.ComponentPropsWithRef<"div">;

export const ChatNotificationsComponent = ({ className }: NotificationsComponentProps) => {
  const [showNotifications, setShowNotifications] = useState(true);

  const [closedNotifications, setClosedNotifications] = useState<Record<string, boolean>>({});
  const { client } = useChat();

  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  const formatNotificationData = async (data: any) => {
    if (data.type === "system.group.join_request") {
      // someone want to join your guild
      const { data: userInfo } = await getUserInfoRequest({
        did_type: "web3mq",
        did_value: data.metadata.userid,
        timestamp: Date.now(),
      });
      const nickname = userInfo
        ? userInfo?.nickname ||
          getShortAddress(userInfo?.wallet_address || "") ||
          getShortAddress(userInfo?.userid || "", 8, 4)
        : getShortAddress(data.metadata.userid, 8, 4);
      const groups = await client.channel.queryGroups([data.metadata.groupid]);

      const title = "Apply to join a guild";
      const content = `User ${nickname} wants to join your guild ${
        groups.length > 0 ? " : " + groups[0].group_name : ""
      }`;
      const reason = data?.reason || "";
      return [title, content, reason, JSON.stringify(data)];
    }
    if (data.type === "system.group.agree_join_request") {
      const groups = await client.channel.queryGroups([data.metadata.groupid]);
      const title = "Guild notifications";
      const content = `You have joined the guild ${groups.length > 0 ? " : " + groups[0].group_name : ""} `;
      const reason = "";
      return [title, content, reason, JSON.stringify(data)];
    }
    if (data.type === "system.group.reject_join_request") {
      const groups = await client.channel.queryGroups([data.metadata.groupid]);
      const title = "Guild notifications";
      const content = `Your membership application has been rejected by the guild ${
        groups.length > 0 ? " : " + groups[0].group_name : ""
      }`;
      const reason = "";
      return [title, content, reason, JSON.stringify(data)];
    }
    return null;
  };

  const updateNotifications = async (eventData: any) => {
    if (eventData.messageId && eventData.read === false) {
      const tempNotifications: NotificationType[] = [];
      const keys = await formatNotificationData(eventData);
      if (keys) {
        tempNotifications.push({
          eventType: EventType.Chat,
          keys,
        });
      }
      setNotifications((prev) => {
        if (tempNotifications.length === 0) {
          return prev;
        }
        return [...tempNotifications, ...prev];
      });
    }
  };

  const handleEvent = async (data: any) => {
    if (data) {
      if (data.type === "notification.received") {
        if (data.data && data.data[0]) {
          await updateNotifications(data.data[0]);
        }
      }
      if (data.type === "notification.getList") {
        const list = client?.notify.notificationList || [];
        for (let i = 0; i < list.length; i++) {
          await updateNotifications(list[i]);
        }
      }
    }
  };

  useEffect(() => {
    if (client) {
      client?.notify.queryNotifications({
        page: 1,
        size: 100,
      });
      client?.on("notification.received", handleEvent);
      client?.on("notification.getList", handleEvent);
    }
  }, [client]);

  const handleCloseNotification = async (messageId: string) => {
    setClosedNotifications((prev) => ({ ...prev, [messageId]: true }));
    // read web3mq notification
    const findItem = notifications.find((item, index) => {
      const { keys } = item;
      const metadata = JSON.parse(keys[3]);
      const id = metadata.messageId || index.toString();
      return id === messageId;
    });
    if (findItem) {
      const { keys } = findItem;
      const metadata = JSON.parse(keys[3]);
      if (metadata) {
        if (["system.group.agree_join_request", "system.group.reject_join_request"].includes(metadata.type)) {
          await client.notify.changeNotificationStatus([messageId], "read");
        }
      }
    }
  };
  return (
    // TODO: handle overflow of the notifications
    <div
      className={clsx(
        "flex flex-col space-y-2 fixed right-4 bottom-4 top-4 overflow-auto pointer-events-none",
        className,
      )}
    >
      <Button variant="primary" className="pointer-events-auto" onClick={() => setShowNotifications((prev) => !prev)}>
        {showNotifications ? "Hide notifications" : "Show notifications"}
      </Button>
      {showNotifications &&
        notifications.map((notification: NotificationType, index) => {
          const { keys } = notification;
          const metadata = JSON.parse(keys[3]);
          console.log(metadata, "metadata");
          const id = metadata.messageId || index.toString();
          return (
            <Notification
              closedNotifications={closedNotifications}
              notification={notification}
              key={`${id}_${index}`}
              id={id}
              onClose={() => handleCloseNotification(id)}
            ></Notification>
          );
        })}
    </div>
  );
};
