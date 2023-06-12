// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Configuration, OpenAIApi } from "openai";
import systemPrompt from "./prompt/system.txt";
import userPrompt from "./prompt/user.txt";

function initializeOpenAI() {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY ?? "",
  });
  return new OpenAIApi(configuration);
}

let lastEdit = Promise.resolve(true);

async function appendTextToActiveEditor(text: string) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document = editor.document;
    const lastLine = document.lineAt(document.lineCount - 1);
    const range = new vscode.Range(lastLine.range.start, lastLine.range.end);
    const edit = vscode.TextEdit.insert(range.end, text);
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(document.uri, [edit]);

    // Chain the promise
    lastEdit = lastEdit.then(() => vscode.workspace.applyEdit(workspaceEdit));
    await lastEdit;
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "stupify" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "stupify.helloWorld",
    async () => {
      const openai = initializeOpenAI();
      const response = await openai.createChatCompletion(
        {
          model: "gpt-3.5-turbo",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        },
        { responseType: "stream" }
      );
      for await (const data of response.data as any) {
        const lines = data
          .toString("utf-8")
          .split("\n")
          .filter((line: string) => line.trim() !== "");
        for (const line of lines) {
          const message = line.replace(/^data: /, "");
          try {
            const parsed = JSON.parse(message);
            if (Boolean(parsed.choices[0]?.finish_reason)) {
              // finish logic here
              continue;
            }
            const content = parsed.choices[0]?.delta?.content;
            if (!content) {
              continue;
            }
            await appendTextToActiveEditor(content);
          } catch (error) {
            console.error(
              "Could not JSON parse stream message",
              message,
              error
            );
          }
        }
      }
      vscode.window.showInformationMessage(JSON.stringify(response));
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
