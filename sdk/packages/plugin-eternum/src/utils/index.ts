import { EternumState } from "../types";

export const composeContext = ({ state, template }: { state: EternumState; template: string }) => {
  // @ts-expect-error match isn't working as expected
  return template.replace(/{{\w+}}/g, (match) => {
    return state[match.replace(/{{|}}/g, "")] ?? "";
  });
};
