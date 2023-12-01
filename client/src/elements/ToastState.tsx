import Button from "./Button";
export type ToastStateType = {
  btnText: string;
  content: string;
  handler: any;
  icon: any;
};

export const ToastState = (props: ToastStateType) => {
  const { btnText, content, handler, icon } = props;
  return (
      <div className=" bg-gray w-full h-full p-4 absolute items-center flex flex-col gap-3 justify-between">
        <div className="flex flex-col justify-center items-center gap-3 h-full">
          <h1>{icon}</h1>
          <div className="text-xs !text-gold">{content}</div>
        </div>
        <Button
            onClick={handler}
            variant="outline"
            className="text-xxs !py-1 !px-2 mr-auto w-full"
        >
          {btnText}
        </Button>
      </div>
  );
};
