import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const ChatPage = () => {
  return (
    <div className="container p-4">
      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent>{/* Chat content will go here */}</CardContent>
      </Card>
    </div>
  );
};
