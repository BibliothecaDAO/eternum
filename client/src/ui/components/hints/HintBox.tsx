export const HintBox = ({ title, content }: { title: string; content: string }) => {
  return (
    <div className="p-8 border">
      <h5>{title}</h5>

      <p>{content}</p>
    </div>
  );
};
