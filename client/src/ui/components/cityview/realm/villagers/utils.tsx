export const scrollToElement = (bottomRef: React.RefObject<HTMLDivElement>) => {
  setTimeout(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 1);
};
