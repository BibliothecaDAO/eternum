export const CODE_ATTRIBUTES =
  /^(className|class|style|key|id|type|href|src|to|role|name|data-(?!tip$)[\w-]+|htmlFor|target|rel)$/;

export const CODE_CALLS =
  /^(cn|clsx|classNames|twMerge|cva|require|import|querySelector\w*|getElementById|addEventListener|console\.\w+)$/;

export const LOG_CALL = /^(console\.\w+|verboseLog|trace\w*|logger\.\w+)$/;

export const CODE_TOKEN =
  /^(?:(?:@\/|\.\.?\/|\/)[\w.$/:-]*|\.[a-z0-9]{1,6}|[a-z0-9_$-]+(?:[_./:][a-z0-9_$-]+)+|[a-z0-9]+-[a-z0-9-]+)$/;

export const ERROR_CONSTRUCTOR = /Error$/;
