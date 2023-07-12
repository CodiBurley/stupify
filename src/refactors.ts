import viewModelPrompt from "./prompt/view-model.txt";

export const ViewModelRefactor = viewModelPrompt;

/**
 * @returns All refactor options: system defined as well as user defined
 */
export function getAllRefactors() {
  return {
    ["View Model"]: ViewModelRefactor,
    ["Compliment"]: "Tell me I'm pretty",
  };
}
