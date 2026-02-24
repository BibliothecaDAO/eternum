export const generateUserCredentials = (username: string) => {
  const hash = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      h = (h << 5) - h + char;
      h = h & h;
    }
    return Math.abs(h).toString();
  };
  const userId = hash(username);
  const token = `${userId}-jwt-token-${hash(username + 'salt')}`;
  return {userId, token};
};
