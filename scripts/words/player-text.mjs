export const CODE_ATTRIBUTES =
  /^(className|class|style|key|id|type|href|src|to|role|name|data-(?!tip$)[\w-]+|htmlFor|target|rel)$/;

export const CODE_CALLS =
  /^(cn|clsx|classNames|twMerge|cva|require|import|querySelector\w*|getElementById|addEventListener|console\.\w+)$/;

export const LOG_CALL = /^(console\.\w+|verboseLog|trace\w*|logger\.\w+)$/;

export const CODE_TOKEN = /^[\w.$-]*[-_./:][\w.$/:-]*$/;

export const ERROR_CONSTRUCTOR = /Error$/;
