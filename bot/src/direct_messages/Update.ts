import { container } from "@sapphire/framework";

export async function sendDirectMessage(userId: string, content: string): Promise<boolean> {
  try {
    const user = await container.client.users.fetch(userId);
    await user.send(content);
    return true;
  } catch (error) {
    console.error(`Failed to send DM to user ${userId}:`, error);
    return false;
  }
}
