// Function to generate deterministic userID and token from username
export const generateUserCredentials = (username: string) => {
  // Simple hash function to convert username to a numeric value
  const hash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  };

  const userId = hash(username);
  const token = `${userId}-jwt-token-${hash(username + "salt")}`;

  return { userId, token };
};

// Default values for initial state (will be replaced once username is set)
export const initialUserId = "";
export const initialToken = "";
